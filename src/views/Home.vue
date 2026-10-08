<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  AlertTriangle,
  Clock,
  FileText,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  ClipboardList
} from 'lucide-vue-next'
import api from '../api'

const user = localStorage.getItem('user') || ''

const employee = ref(null)
const attendanceRecords = ref([])
const leaveApplications = ref([])
const attendanceRequests = ref([])
const leaveCancellationRequests = ref([])
const timesheets = ref([])
const leaveAllocations = ref([])

const loading = ref(true)
const errors = ref([])

function localDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = localDate()
const monthStart = localDate(
  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
)

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const todayLabel = new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})

const monthLabel = new Date().toLocaleDateString('en-IN', {
  month: 'long',
  year: 'numeric'
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const firstName = computed(() =>
  (employee.value?.employee_name || user.split('@')[0] || 'there')
    .trim()
    .split(/\s+/)[0]
)

function leaveStatus(leave) {
  return leave.workflow_state || leave.status || 'Unknown'
}

/* ---------- icon helpers (UI only) ---------- */
function toneIcon(tone) {
  if (tone === 'danger') return AlertTriangle
  if (tone === 'warning') return Clock
  return ClipboardList
}

function activityIcon(type) {
  if (type === 'attendance') return Clock
  if (type === 'leave') return CalendarDays
  return FileText
}

const todayAttendance = computed(
  () =>
    attendanceRecords.value.find(
      record =>
        String(record.attendance_date || '').slice(0, 10) === today
    ) || null
)

const attendanceStats = computed(() => {
  const records = attendanceRecords.value

  return {
    present: records.filter(r => r.status === 'Present').length,
    absent: records.filter(r => r.status === 'Absent').length,
    halfDay: records.filter(r => r.status === 'Half Day').length,
    onLeave: records.filter(r => r.status === 'On Leave').length,
    total: records.length
  }
})

const attendanceRate = computed(() => {
  const { present, halfDay, absent } = attendanceStats.value
  const worked = present + halfDay * 0.5
  const eligible = present + halfDay + absent

  return eligible ? Math.round((worked / eligible) * 100) : null
})

const attendanceBreakdown = computed(() => {
  const stats = attendanceStats.value
  const total = stats.total || 1

  return [
    {
      label: 'Present',
      count: stats.present,
      width: (stats.present / total) * 100,
      color: '#159568'
    },
    {
      label: 'On leave',
      count: stats.onLeave,
      width: (stats.onLeave / total) * 100,
      color: '#6558df'
    },
    {
      label: 'Half day',
      count: stats.halfDay,
      width: (stats.halfDay / total) * 100,
      color: '#e5a037'
    },
    {
      label: 'Absent',
      count: stats.absent,
      width: (stats.absent / total) * 100,
      color: '#dc5965'
    }
  ]
})

const pendingLeaves = computed(() =>
  leaveApplications.value.filter(
    leave => leaveStatus(leave) === 'Pending' ||
      (
        !leave.workflow_state &&
        leave.status === 'Open'
      )
  )
)

const upcomingLeaves = computed(() =>
  leaveApplications.value.filter(leave => {
    const status = leaveStatus(leave)

    return (
      status === 'Approved' &&
      leave.from_date &&
      String(leave.from_date).slice(0, 10) >= today
    )
  })
)

const currentRequests = computed(() => {
  const requests = []

  if (pendingLeaves.value.length) {
    requests.push({
      id: 'leave-requests',
      type: 'leave',
      title: 'Leave approval pending',
      description:
        `${pendingLeaves.value.length} leave request(s) awaiting approval.`,
      date: pendingLeaves.value
        .map(leave => leave.from_date)
        .filter(Boolean)
        .sort()
        .at(-1) || '',
      count: pendingLeaves.value.length,
      to: {
        path: '/leaves',
        query: {
          tab: 'my-leaves',
          status: 'Pending'
        }
      },
      action: 'View requests'
    })
  }

  const pendingLeaveCancellations =
    leaveCancellationRequests.value.filter(
      request =>
        String(request.status || '')
          .trim()
          .toLowerCase() === 'pending'
    )

  if (pendingLeaveCancellations.length) {
    requests.push({
      id: 'leave-cancellation-requests',
      type: 'leave',
      title: 'Leave cancellation pending',
      description:
        `${pendingLeaveCancellations.length} leave cancellation request(s) awaiting HR review.`,
      date: pendingLeaveCancellations
        .map(request => String(request.creation || ''))
        .filter(Boolean)
        .sort()
        .at(-1) || '',
      count: pendingLeaveCancellations.length,
      to: {
        path: '/leaves',
        query: {
          tab: 'my-leaves'
        }
      },
      action: 'View requests'
    })
  }

  const activeAttendanceRequests = attendanceRequests.value.filter(request => {
    const state = String(request.workflow_state || '')
      .trim()
      .toLowerCase()

    const status = String(request.status || '')
      .trim()
      .toLowerCase()

    const resolvedStates = [
      'approved',
      'rejected',
      'cancelled',
      'closed'
    ]

    const isResolved =
      resolvedStates.some(value => state.includes(value)) ||
      resolvedStates.some(value => status.includes(value))

    return !isResolved
  })

  const correctionRequests = activeAttendanceRequests.filter(
    request => request.request_type === 'Correct'
  )

  const cancellationRequests = activeAttendanceRequests.filter(
    request => request.request_type === 'Cancel'
  )

  if (correctionRequests.length) {
    requests.push({
      id: 'attendance-correction-requests',
      type: 'attendance',
      title: 'Attendance correction pending',
      description:
        `${correctionRequests.length} attendance correction request(s) awaiting review.`,
      date: correctionRequests
        .map(request => String(request.attendance_date || '').slice(0, 10))
        .filter(Boolean)
        .sort()
        .at(-1) || '',
      count: correctionRequests.length,
      to: '/attendance/correction',
      action: 'View requests'
    })
  }

  if (cancellationRequests.length) {
    requests.push({
      id: 'attendance-cancellation-requests',
      type: 'attendance',
      title: 'Attendance cancellation pending',
      description:
        `${cancellationRequests.length} attendance cancellation request(s) awaiting review.`,
      date: cancellationRequests
        .map(request => String(request.attendance_date || '').slice(0, 10))
        .filter(Boolean)
        .sort()
        .at(-1) || '',
      count: cancellationRequests.length,
      to: '/attendance/correction',
      action: 'View requests'
    })
  }

  return requests
    .sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || ''))
    )
})

const draftTimesheets = computed(() =>
  timesheets.value.filter(t => t.status === 'Draft')
)

const pendingTimesheets = computed(() =>
  timesheets.value.filter(
    t => t.status === 'Submitted' ||
      t.status === 'Pending'
  )
)

const pendingCount = computed(() =>
  pendingLeaves.value.reduce(
    (sum, leave) => sum + Number(leave.total_leave_days || 0),
    0
  )
)

const totalRecordedHours = computed(() =>
  timesheets.value.reduce(
    (sum, item) => sum + Number(item.total_hours || 0),
    0
  )
)

const primaryLeave = computed(() =>
  leaveAllocations.value[0] || null
)

function leaveDays(leave) {
  const total = Number(leave.total_leave_days || 0)

  if (total > 0) return total

  if (leave.from_date && leave.to_date) {
    const from = new Date(
      `${String(leave.from_date).slice(0, 10)}T00:00:00`
    )

    const to = new Date(
      `${String(leave.to_date).slice(0, 10)}T00:00:00`
    )

    const diff = Math.round(
      (to - from) / 86400000
    )

    return diff >= 0 ? diff + 1 : 1
  }

  return 1
}

const leavePieData = computed(() => {
  const colors = [
    '#6366f1',
    '#ec4899',
    '#14b8a6',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#84cc16'
  ]

  const items = []

  upcomingLeaves.value.forEach((leave, index) => {
    const days = leaveDays(leave)

    items.push({
      id: leave.name,
      name: leave.leave_type || 'Leave',
      value: days,
      days,
      color: colors[index % colors.length],
      detail: `${days} ${days === 1 ? 'day' : 'days'}`,
      tooltip:
        `${leave.leave_type || 'Leave'}\n` +
        `${formatDate(leave.from_date)} → ` +
        `${formatDate(leave.to_date)}\n` +
        `${days} ${days === 1 ? 'day' : 'days'}`
    })
  })

  pendingLeaves.value.forEach((leave, index) => {
    const days = leaveDays(leave)

    items.push({
      id: `pending-${leave.name || index}`,
      name: leave.leave_type || 'Leave',
      value: days,
      days,
      color: colors[index % colors.length],
      detail:
        `${days} ${days === 1 ? 'day' : 'days'} · Pending`,
      tooltip:
        `${leave.leave_type || 'Leave'} · Pending approval\n` +
        `${formatDate(leave.from_date)} → ` +
        `${formatDate(leave.to_date)}\n` +
        `${days} ${days === 1 ? 'day' : 'days'}`
    })
  })

  return items
})

const leavePieSegments = computed(() => {
  const total = leavePieData.value.reduce(
    (sum, item) => sum + item.value,
    0
  )

  if (!total) return []

  const radius = 72
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return leavePieData.value.map(item => {
    const length =
      (item.value / total) * circumference

    const segment = {
      ...item,
      circumference,
      length,
      offset
    }

    offset += length
    return segment
  })
})

const leavePieStyle = computed(() => {
  if (!leavePieData.value.length) {
    return {
      background: '#e5e7eb'
    }
  }

  const total = leavePieData.value.reduce(
    (sum, leave) => sum + leave.value,
    0
  )

  let start = 0
  const segments = leavePieData.value.map(leave => {
    const end = start + (leave.value / total) * 360
    const segment = `${leave.color} ${start}deg ${end}deg`
    start = end
    return segment
  })

  return {
    background: `conic-gradient(${segments.join(', ')})`
  }
})

const attentionItems = computed(() => {
  const items = []

  if (!todayAttendance.value) {
    items.push({
      title: "Today's attendance not marked",
      description:
        "You haven't marked attendance for today.",
      count: 1,
      tone: 'warning',
      to: '/attendance',
      action: 'Mark attendance'
    })
  } else if (todayAttendance.value.status === 'Absent') {
    items.push({
      title: "Today's attendance is absent",
      description:
        "Today's attendance is currently marked Absent.",
      count: 1,
      tone: 'danger',
      to: '/attendance',
      action: 'Review attendance'
    })
  }

  if (draftTimesheets.value.length) {
    items.push({
      title: 'Timesheet submission pending',
      description:
        `${draftTimesheets.value.length} timesheet(s) are saved as draft and need submission.`,
      count: draftTimesheets.value.length,
      tone: 'warning',
      to: { path: '/timesheet', query: { status: 'Draft' } },
      action: 'Submit timesheets'
    })
  }

  if (attendanceStats.value.absent) {
    items.push({
      title: 'Recorded absences',
      description:
        `${attendanceStats.value.absent} absent day(s) recorded this month.`,
      count: attendanceStats.value.absent,
      tone: 'danger',
      to: '/attendance',
      action: 'Review attendance'
    })
  }

  return items
})

const recentActivity = computed(() => {
  const attendance = attendanceRecords.value.map(record => ({
    id: `attendance-${record.name}`,
    title: `Attendance: ${record.status}`,
    description: record.leave_type || 'Attendance record',
    date: record.attendance_date,
    to: '/attendance',
    type: 'attendance'
  }))

  const leaves = leaveApplications.value.map(leave => ({
    id: `leave-${leave.name}`,
    title: `${leave.leave_type || 'Leave'}: ${leaveStatus(leave)}`,
    description: `${formatDate(leave.from_date)} – ${formatDate(leave.to_date)}`,
    date: leave.from_date,
    to: '/leaves',
    type: 'leave'
  }))

  const sheets = timesheets.value.map(sheet => ({
    id: `timesheet-${sheet.name}`,
    title: `Timesheet: ${sheet.status || 'Recorded'}`,
    description: sheet.name,
    date: sheet.start_date,
    to: '/timesheet',
    type: 'timesheet'
  }))

  return [...attendance, ...leaves, ...sheets]
    .filter(item => item.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
})

async function loadEmployee() {
  const response = await api.get('/api/resource/Employee', {
    params: {
      filters: JSON.stringify([['user_id', '=', user]]),
      fields: JSON.stringify([
        'name',
        'employee_name',
        'designation',
        'department',
        'status'
      ]),
      limit_page_length: 1
    }
  })

  const record = response.data.data?.[0]

  if (!record) {
    throw new Error('No employee record is linked to this account.')
  }

  employee.value = record
}

async function loadLeaveBalance() {
  const response = await api.get(
    '/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details',
    {
      params: {
        employee: employee.value.name,
        date: today
      }
    }
  )

  const allocations = response.data.message?.leave_allocation || {}

  leaveAllocations.value = Object.entries(allocations).map(
    ([name, allocation]) => ({
      name,
      remaining: Number(allocation.remaining_leaves || 0),
      total: Number(allocation.total_leaves || 0)
    })
  )
}

async function loadAttendance() {
  const response = await api.get('/api/resource/Attendance', {
    params: {
      filters: JSON.stringify([
        ['employee', '=', employee.value.name],
        ['attendance_date', '>=', monthStart],
        ['attendance_date', '<=', today],
        ['docstatus', '!=', 2]
      ]),
      fields: JSON.stringify([
        'name',
        'attendance_date',
        'status',
        'leave_type'
      ]),
      order_by: 'attendance_date desc',
      limit_page_length: 500
    }
  })

  attendanceRecords.value = response.data.data || []
}

async function loadLeaves() {
  const response = await api.get('/api/resource/Leave Application', {
    params: {
      filters: JSON.stringify([
        ['employee', '=', employee.value.name]
      ]),
      fields: JSON.stringify([
        'name',
        'leave_type',
        'from_date',
        'to_date',
          'total_leave_days',
        'status',
        'workflow_state'
      ]),
      order_by: 'creation desc',
      limit_page_length: 100
    }
  })

  leaveApplications.value = response.data.data || []
}

async function loadLeaveCancellationRequests() {
  const response = await api.get(
    '/api/method/hr_portal_custom.api.leave_cancellation_request.my_cancellation_requests'
  )

  leaveCancellationRequests.value = response.data.message || []
}

async function loadAttendanceRequests() {
  const response = await api.get(
    '/api/method/hr_portal_custom.api.attendance_correction.my_requests'
  )

  attendanceRequests.value = response.data.message || []
}

async function loadTimesheets() {
  const response = await api.get('/api/resource/Timesheet', {
    params: {
      filters: JSON.stringify([
        ['employee', '=', employee.value.name]
      ]),
      fields: JSON.stringify([
        'name',
        'start_date',
        'end_date',
        'total_hours',
        'status'
      ]),
      order_by: 'creation desc',
      limit_page_length: 100
    }
  })

  timesheets.value = response.data.data || []
}

async function loadDashboard() {
  loading.value = true
  errors.value = []

  try {
    await loadEmployee()

    const results = await Promise.allSettled([
      loadLeaveBalance(),
      loadAttendance(),
      loadLeaves(),
      loadAttendanceRequests(),
      loadLeaveCancellationRequests(),
      loadTimesheets()
    ])

    const sections = [
      'leave balance',
      'attendance',
      'leave applications',
      'attendance requests',
      'leave cancellation requests',
      'timesheets'
    ]

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`${sections[index]} failed:`, result.reason)
        errors.value.push(
          `Unable to load ${sections[index]}. Some information may be unavailable.`
        )
      }
    })
  } catch (error) {
    console.error('Dashboard failed:', error)
    errors.value = [
      error.response?.data?.message ||
      error.message ||
      'Unable to load dashboard.'
    ]
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <main class="dashboard-page">
    <div class="page-heading">
      <div>
        <span class="eyebrow">EMPLOYEE WORKSPACE</span>
        <h1>Dashboard</h1>
        <p>Your workday overview, attendance and requests.</p>
      </div>
      <span class="page-date">
        <CalendarDays :size="14" />
        {{ todayLabel }}
      </span>
    </div>

    <div v-if="errors.length" class="dashboard-alert" role="alert">
      <AlertTriangle :size="16" />
      <div>
        <p v-for="message in errors" :key="message">
          {{ message }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="dashboard-loading" role="status">
      <div class="spinner"></div>
      Loading your workspace...
    </div>

    <template v-else-if="employee">
      <!-- WELCOME BANNER -->
      <section class="welcome-banner">
        <div class="welcome-content">
          <span class="welcome-label">YOUR WORKSPACE</span>

          <h2>{{ greeting }}, {{ firstName }}.</h2>

          <p>
            Here's an overview of your workday and
            the latest updates that need your attention.
          </p>

          <div class="employee-meta">
            <span v-if="employee.designation">
              {{ employee.designation }}
            </span>

            <span v-if="employee.department">
              {{ employee.department }}
            </span>
          </div>
        </div>

      </section>

      <!-- OVERVIEW CARDS -->
      <section class="dashboard-overview-grid" aria-label="Work overview">

        <!-- ATTENDANCE OVERVIEW -->
        <article class="dashboard-panel overview-chart-card">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">MONTHLY OVERVIEW</span>
              <h2>Attendance overview</h2>
              <p>{{ monthLabel }}</p>
            </div>
          </div>

          <div class="chart-primary">
            <strong>
              {{ attendanceRate === null ? '—' : `${attendanceRate}%` }}
            </strong>
            <span>Attendance rate</span>
          </div>

          <div class="stacked-bar" aria-label="Attendance breakdown">
            <div
              v-for="item in attendanceBreakdown"
              :key="item.label"
              :style="{
                width: `${item.width}%`,
                backgroundColor: item.color
              }"
            ></div>
          </div>

          <p v-if="!attendanceStats.total" class="chart-empty">
            No attendance recorded yet this month.
          </p>

          <div class="breakdown-list">
            <div
              v-for="item in attendanceBreakdown"
              :key="item.label"
              class="breakdown-row"
            >
              <span class="breakdown-label">
                <i :style="{ backgroundColor: item.color }"></i>
                {{ item.label }}
              </span>

              <strong>{{ item.count }}</strong>
            </div>
          </div>
        </article>

        <!-- LEAVE OVERVIEW -->
        <article class="dashboard-panel overview-chart-card">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">TIME OFF</span>
              <h2>Leave overview</h2>
              <p>Upcoming leaves and pending approvals</p>
            </div>
          </div>

          <div
            v-if="leavePieData.length"
            class="leave-pie-layout"
          >
            <div class="leave-pie-chart">
              <svg
                class="leave-pie-svg"
                viewBox="0 0 200 200"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="#eef2f7"
                  stroke-width="40"
                />

                <circle
                  v-for="segment in leavePieSegments"
                  :key="segment.id"
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  :stroke="segment.color"
                  stroke-width="40"
                  :stroke-dasharray="`${segment.length} ${segment.circumference - segment.length}`"
                  :stroke-dashoffset="-segment.offset"
                  transform="rotate(-90 100 100)"
                  class="leave-pie-segment"
                >
                  <title>{{ segment.tooltip }}</title>
                </circle>
              </svg>

              <div class="leave-pie-center">
                <strong>
                  {{
                    pendingLeaves.reduce(
                      (sum, leave) => sum + leaveDays(leave),
                      0
                    )
                  }}
                </strong>
                <span>Pending approval</span>
              </div>
            </div>

            <div
              class="leave-pie-legend"
            >
              <div
                v-for="leave in leavePieData"
                :key="leave.name"
                class="leave-pie-legend-item"
              >
                <span
                  class="leave-pie-legend-dot"
                  :style="{ background: leave.color }"
                ></span>

                <div class="leave-pie-legend-copy">
                  <strong>{{ leave.name }}</strong>
                  <span>
                    {{ leave.detail }}
                  </span>
                </div>
              </div>
            </div>

          </div>

          <div
            v-else
            class="leave-overview-empty"
          >
            <strong>No upcoming leaves</strong>
            <span>You don't have any upcoming leave scheduled.</span>
          </div>
        </article>

        <!-- ATTENTION REQUIRED -->
        <section class="dashboard-panel action-panel attention-card">
          <div class="panel-heading">
            <div class="attention-heading">
              <span
                class="attention-heading-icon"
                :class="{ pulse: attentionItems.length }"
              >
                <AlertTriangle :size="20" />
              </span>
              <div>
                <span class="eyebrow warn-eyebrow">ACTION REQUIRED</span>
                <h2>Attention required</h2>
                <p>Items that need your attention.</p>
              </div>
            </div>

            <span
              class="section-count"
              :class="{ 'count-warn': attentionItems.length }"
            >
              {{ attentionItems.length }} items
            </span>
          </div>

          <div
            v-if="!attentionItems.length"
            class="empty-attention"
          >
            <span class="empty-check">
              <CheckCircle2 :size="20" />
            </span>
            <div>
              <strong>You're all caught up</strong>
              <p>No actions are currently required.</p>
            </div>
          </div>

          <div v-else class="attention-list">
            <router-link
              v-for="item in attentionItems"
              :key="item.title"
              :to="item.to"
              class="attention-item"
              :class="item.tone"
            >
              <span
                class="attention-symbol"
                :class="item.tone"
              >
                <component :is="toneIcon(item.tone)" :size="18" />
              </span>

              <div class="attention-copy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>

              <span
                class="attention-count"
                :class="item.tone"
              >
                {{ item.count }}
              </span>

              <span class="attention-action">
                {{ item.action }}
                <ArrowRight :size="14" />
              </span>
            </router-link>
          </div>
        </section>

        <!-- CURRENT REQUESTS -->
        <section class="dashboard-panel action-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">REQUESTS</span>
              <h2>Current requests</h2>
              <p>Requests currently waiting for action.</p>
            </div>

            <span class="section-count">
              {{ currentRequests.length }} active
            </span>
          </div>

          <div
            v-if="!currentRequests.length"
            class="empty-attention"
          >
            <span class="empty-check">
              <CheckCircle2 :size="20" />
            </span>

            <div>
              <strong>No active requests</strong>
              <p>You don't have any requests awaiting review.</p>
            </div>
          </div>

          <div v-else class="attention-list">
            <router-link
              v-for="request in currentRequests"
              :key="request.id"
              :to="request.to"
              class="attention-item"
              :class="request.type === 'attendance' ? 'danger' : 'info'"
            >
              <span
                class="attention-symbol"
                :class="request.type === 'attendance' ? 'danger' : 'info'"
              >
                <component
                  :is="request.type === 'attendance' ? Clock : CalendarDays"
                  :size="18"
                />
              </span>

              <div class="attention-copy">
                <strong>{{ request.title }}</strong>
                <p>{{ request.description }}</p>
              </div>

              <span
                class="attention-count"
                :class="request.type === 'attendance' ? 'danger' : 'info'"
              >
                {{ request.count }}
              </span>

              <span class="attention-action">
                {{ request.action }}
                <ArrowRight :size="14" />
              </span>
            </router-link>
          </div>
        </section>
      </section>

      <!-- RECENT ACTIVITY -->
      <section class="dashboard-panel activity-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">YOUR RECORDS</span>
            <h2>Recent activity</h2>
            <p>Latest attendance, leave and timesheet records.</p>
          </div>

          <span class="section-count">
            Latest {{ recentActivity.length }}
          </span>
        </div>

        <div v-if="!recentActivity.length" class="activity-empty">
          No recent records available.
        </div>

        <div v-else class="activity-list">
          <router-link
            v-for="item in recentActivity"
            :key="item.id"
            :to="item.to"
            class="activity-row"
          >
            <span class="activity-icon" :class="item.type">
              <component :is="activityIcon(item.type)" :size="18" />
            </span>

            <div class="activity-copy">
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </div>

            <span class="activity-date">
              {{ formatDate(item.date) }}
            </span>

            <ArrowRight class="activity-arrow" :size="16" />
          </router-link>
        </div>
      </section>

      <div class="dashboard-footer">
        <span>Employee data provided by NestorBird HRMS</span>
        <span>
          {{ totalRecordedHours.toFixed(1) }} recorded timesheet hours
        </span>
      </div>
    </template>
  </main>
</template>

<style scoped>
.dashboard-page {
  --ink: #172033;
  --muted: #77849c;
  --line: #e3e9f4;
  --indigo: #5b4fe0;
  --indigo-soft: #eef0ff;
  --green: #159568;
  --green-soft: #e7f8ef;
  --amber: #e5a037;
  --amber-ink: #a76a13;
  --amber-soft: #fff4e0;
  --red: #dc5965;
  --red-ink: #c74958;
  --red-soft: #fff0f1;
  --blue: #456bd4;
  --blue-soft: #eaf0ff;

  width: 100%;
  min-width: 0;
  padding: 28px 32px 44px;
  box-sizing: border-box;
  color: var(--ink);
}

.dashboard-page > *,
.dashboard-page template > * {
  animation: rise .35s ease both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ---------- headings ---------- */
.page-heading,
.panel-heading,
.dashboard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-heading {
  margin-bottom: 24px;
}

.eyebrow {
  display: block;
  margin-bottom: 8px;
  color: #5e6e8d;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.3px;
}

.page-heading h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -.7px;
}

.page-heading p,
.panel-heading p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.page-date {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

/* ---------- hero ---------- */
.welcome-banner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 160px;
  margin-bottom: 20px;
  padding: 30px 34px;
  overflow: hidden;
  border-radius: 18px;
  background:
    radial-gradient(circle at 85% 20%, rgba(124, 108, 255, .35), transparent 45%),
    linear-gradient(115deg, #1a2540, #2e4168);
  color: #fff;
  box-shadow: 0 14px 30px rgba(25, 39, 67, .14);
}

.welcome-banner::after {
  content: '';
  position: absolute;
  width: 300px;
  height: 300px;
  right: -80px;
  top: -125px;
  border: 1px solid rgba(255, 255, 255, .09);
  border-radius: 50%;
  box-shadow:
    0 0 0 45px rgba(255, 255, 255, .025),
    0 0 0 95px rgba(255, 255, 255, .025);
  pointer-events: none;
}

.welcome-content {
  position: relative;
  z-index: 1;
}

.welcome-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #bac9e5;
}

.welcome-banner h2 {
  margin: 12px 0 8px;
  font-size: clamp(24px, 3vw, 32px);
  font-weight: 800;
  letter-spacing: -.7px;
}

.welcome-banner p {
  max-width: 510px;
  margin: 0;
  color: #d1daeb;
  font-size: 13px;
  line-height: 1.7;
}

.employee-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.employee-meta span {
  padding: 6px 11px;
  border: 1px solid rgba(255, 255, 255, .16);
  border-radius: 999px;
  background: rgba(255, 255, 255, .08);
  color: #e6ecf8;
  font-size: 11px;
}

.dashboard-panel {
  border: 1px solid var(--line);
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(26, 43, 76, .04);
}

/* ---------- panels ---------- */
.dashboard-panel {
  min-width: 0;
  padding: 22px;
}

.dashboard-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 20px;
}

.overview-chart-card {
  min-height: 280px;
}

.panel-heading {
  align-items: flex-start;
  margin-bottom: 20px;
}

.panel-heading .eyebrow {
  color: #5e61bf;
}

.panel-heading h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -.25px;
}

.section-count {
  padding: 7px 11px;
  border-radius: 999px;
  background: #f1f4fa;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.section-count.count-warn {
  background: var(--amber);
  color: #fff;
}

/* ---------- attendance chart ---------- */
.chart-primary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 0 16px;
}

.chart-primary strong {
  font-size: 32px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -.8px;
}

.chart-primary span {
  color: #7b879c;
  font-size: 11px;
}

.stacked-bar {
  display: flex;
  width: 100%;
  height: 10px;
  margin-bottom: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf1f7;
}

.stacked-bar > div {
  min-width: 0;
  transition: width .25s;
}

.chart-empty {
  margin: 0 0 14px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #f6f8fc;
  color: #7b879c;
  font-size: 12px;
}

.breakdown-list {
  display: grid;
  gap: 4px;
}

.breakdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  color: #66748a;
  font-size: 12px;
}

.breakdown-row:hover {
  background: #f7f9fd;
}

.breakdown-row strong {
  color: var(--ink);
  font-size: 13px;
}

.breakdown-label {
  display: flex;
  align-items: center;
  gap: 9px;
}

.breakdown-label i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* ---------- leave chart ---------- */
.leave-chart {
  margin-top: 16px;
}

.leave-chart-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.leave-chart-label {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.leave-chart-label > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.leave-chart-label strong {
  font-size: 13px;
  font-weight: 700;
  color: #253352;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leave-chart-label span:not(.leave-chart-dot) {
  font-size: 11px;
  color: #8a95ab;
}

.leave-chart-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border-radius: 50%;
}

.leave-chart-dot.upcoming { background: #6d5ce7; }
.leave-chart-dot.pending  { background: var(--amber); }

.leave-chart-count {
  font-size: 18px;
  font-weight: 800;
  color: var(--ink);
}

.leave-chart-track {
  height: 8px;
  margin: 10px 0 24px 19px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf0f6;
}

.leave-chart-fill {
  height: 100%;
  border-radius: inherit;
  transition: width .2s ease;
}

.upcoming-fill { background: linear-gradient(90deg, #6257d7, #847af0); }
.pending-fill  { background: linear-gradient(90deg, #e5a037, #f2c06b); }

/* ---------- attention + requests ---------- */
.action-panel {
  height: 100%;
}

.attention-card {
  border-left: 4px solid var(--amber);
  background: linear-gradient(180deg, #fffaf0 0%, #ffffff 120px);
}

.attention-heading {
  display: flex;
  align-items: flex-start;
  gap: 13px;
}

.attention-heading-icon {
  display: grid;
  flex: 0 0 42px;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #fde8bd;
  color: #c47a0c;
}

.attention-heading-icon.pulse {
  animation: warnPulse 2s infinite;
}

@keyframes warnPulse {
  0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, .5); }
  70%  { box-shadow: 0 0 0 11px rgba(245, 158, 11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}

.panel-heading .eyebrow.warn-eyebrow {
  margin-bottom: 4px;
  color: #c47a0c;
}

.attention-list,
.activity-list {
  display: flex;
  flex-direction: column;
}

.attention-list {
  gap: 10px;
}

.attention-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 15px;
  border: 1px solid #eef1f7;
  border-radius: 13px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  transition: transform .15s, box-shadow .15s, border-color .15s;
}

.attention-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(26, 43, 76, .08);
}

.attention-item.warning { border-left: 3px solid var(--amber); }
.attention-item.danger  { border-left: 3px solid var(--red); }
.attention-item.info    { border-left: 3px solid #7166df; }

.attention-symbol,
.activity-icon {
  display: grid;
  flex: 0 0 40px;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
}

.attention-symbol.warning,
.attention-count.warning {
  background: var(--amber-soft);
  color: var(--amber-ink);
}

.attention-symbol.info,
.attention-count.info {
  background: var(--indigo-soft);
  color: #5850c7;
}

.attention-symbol.danger,
.attention-count.danger {
  background: var(--red-soft);
  color: var(--red-ink);
}

.attention-copy,
.activity-copy {
  flex: 1;
  min-width: 0;
}

.attention-copy strong,
.activity-copy strong {
  font-size: 13px;
  font-weight: 750;
}

.attention-copy p,
.activity-copy p {
  margin: 4px 0 0;
  color: #8290a6;
  font-size: 11px;
  line-height: 1.5;
}

.action-panel .attention-copy strong,
.action-panel .attention-copy p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-count {
  min-width: 28px;
  padding: 6px 9px;
  border-radius: 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
}

.attention-action {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border-radius: 9px;
  background: var(--indigo-soft);
  color: #4338ca;
  font-size: 12px;
  font-weight: 750;
  transition: background .15s;
}

.attention-item:hover .attention-action {
  background: #e0e3ff;
}

.empty-attention {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 22px;
  border: 1px dashed #cce7d8;
  border-radius: 12px;
  background: #f8fdfa;
}

.empty-check {
  display: grid;
  flex: 0 0 38px;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #dff6e9;
  color: #148b58;
}

.empty-attention strong {
  font-size: 13px;
}

.empty-attention p {
  margin: 5px 0 0;
  color: #77849a;
  font-size: 12px;
}

/* ---------- activity ---------- */
.activity-panel {
  margin-bottom: 18px;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 13px 12px;
  border-top: 1px solid #edf1f7;
  color: inherit;
  text-decoration: none;
  transition: background .15s;
}

.activity-row:first-child {
  border-top: none;
}

.activity-row:hover {
  background: #f8f9ff;
  border-radius: 10px;
}

.activity-icon.attendance { background: var(--blue-soft); color: #4c70c7; }
.activity-icon.leave      { background: #f0edff; color: #6858d8; }
.activity-icon.timesheet  { background: var(--green-soft); color: var(--green); }

.activity-date {
  color: #8591a5;
  font-size: 11px;
  white-space: nowrap;
}

.activity-arrow {
  color: #766ce0;
  transition: transform .15s;
}

.activity-row:hover .activity-arrow {
  transform: translateX(3px);
}

.activity-empty {
  padding: 26px 0;
  color: #8793a7;
  font-size: 12px;
}

.dashboard-footer {
  padding: 5px 2px;
  color: #97a2b5;
  font-size: 10px;
}

/* ---------- alert + loading ---------- */
.dashboard-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 17px;
  padding: 12px 16px;
  border: 1px solid #fecdd3;
  border-radius: 10px;
  background: #fff1f2;
  color: #b42318;
  font-size: 12px;
}

.dashboard-alert p {
  margin: 2px 0;
}

.dashboard-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 250px;
  color: #75829a;
  font-size: 13px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e1e5f9;
  border-top-color: #6257d7;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---------- responsive ---------- */
@media (max-width: 1050px) {
  .dashboard-overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .dashboard-page {
    padding: 18px 15px 32px;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .welcome-banner {
    flex-direction: column;
    align-items: flex-start;
    padding: 26px 22px;
  }

  .dashboard-panel {
    padding: 17px;
  }

  .attention-item {
    flex-wrap: wrap;
  }

  .attention-action {
    width: 100%;
    justify-content: center;
  }

  .activity-date {
    display: none;
  }

  .dashboard-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-page > *,
  .attention-heading-icon.pulse {
    animation: none;
  }
}

.leave-overview-empty {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #64748b;
}

.leave-overview-empty strong {
  color: #25324a;
  font-size: 14px;
  font-weight: 700;
}

.leave-overview-empty span {
  margin-top: 6px;
  color: #94a3b8;
  font-size: 11px;
}

.leave-pie-layout {
  display: flex;
  align-items: center;
  gap: 28px;
  min-height: 220px;
}

.leave-pie-chart {
  position: relative;
  width: 190px;
  height: 190px;
  min-width: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.leave-pie {
  width: 190px;
  height: 190px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}

.leave-pie-center {
  position: absolute;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
}

.leave-pie-center strong {
  font-size: 24px;
  line-height: 1;
  color: #172554;
}

.leave-pie-center span {
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
}

.leave-pie-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.leave-pie-legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.leave-pie-legend-dot {
  width: 10px;
  height: 10px;
  min-width: 10px;
  border-radius: 50%;
}

.leave-pie-legend-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.leave-pie-legend-copy strong {
  font-size: 13px;
  color: #1e293b;
}

.leave-pie-legend-copy span {
  font-size: 11px;
  color: #64748b;
}

.leave-pie-empty {
  flex: 1;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 700px) {
  .leave-pie-layout {
    flex-direction: column;
    align-items: flex-start;
  }

  .leave-pie-chart {
    align-self: center;
  }
}


.leave-pie-svg {
  width: 190px;
  height: 190px;
  display: block;
}

.leave-pie-segment {
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    stroke-width 0.15s ease;
}

.leave-pie-segment:hover {
  opacity: 0.82;
  stroke-width: 44;
}

</style>
