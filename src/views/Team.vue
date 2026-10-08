<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../api'

const router = useRouter()
const email = localStorage.getItem('user')
const today = new Date().toLocaleDateString('en-CA')

const viewDate = ref(today)
const apps = ref([])
const team = ref([])
const loading = ref(true)
const error = ref('')

const tab = ref('all')
const search = ref('')
const selectedIds = ref([])
const weekTarget = 40

const tabs = [
  { key: 'all', label: 'Team Members' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'onleave', label: 'On Leave' },
  { key: 'pending', label: 'Pending' }
]

const attendanceRecords = ref([])
const attendanceLoading = ref(false)
const attendanceError = ref('')

const timesheetRecords = ref([])
const timesheetLoading = ref(false)
const timesheetError = ref('')

function state(l) {
  return l.workflow_state || l.status
}

const open = (id) => id && router.push(`/team/employee/${id}`)

const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0)

function fmt(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function abbr(type = '') {
  const words = type.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length > 1) return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4)
  return (words[0] || '').slice(0, 4).toUpperCase()
}

function conic(segments, total) {
  if (!total) return '#e5e7eb'
  let acc = 0
  const parts = []
  segments.forEach((s) => {
    if (!s.v) return
    const a = (acc / total) * 100
    acc += s.v
    parts.push(`${s.c} ${a}% ${(acc / total) * 100}%`)
  })
  if (acc < total) parts.push(`#e5e7eb ${(acc / total) * 100}% 100%`)
  return `conic-gradient(${parts.join(',')})`
}

/* ---------- week range (Mon–Sun) of the selected date ---------- */

const bounds = computed(() => {
  const d = new Date(viewDate.value + 'T00:00:00')
  const day = (d.getDay() + 6) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toLocaleDateString('en-CA'),
    end: end.toLocaleDateString('en-CA')
  }
})

const rangeLabel = computed(() => `${fmt(bounds.value.start)} – ${fmt(bounds.value.end)}`)

/* ---------- LOADERS ---------- */

async function loadTeamAttendance() {
  if (!team.value.length) {
    attendanceRecords.value = []
    return
  }

  attendanceLoading.value = true
  attendanceError.value = ''

  try {
    const res = await api.get('/api/resource/Attendance', {
      params: {
        filters: JSON.stringify([
          ['employee', 'in', team.value.map((m) => m.id)],
          ['attendance_date', '=', viewDate.value],
          ['docstatus', '!=', 2]
        ]),
        fields: JSON.stringify([
          'name',
          'employee',
          'employee_name',
          'attendance_date',
          'status',
          'leave_type'
        ]),
        order_by: 'employee_name asc',
        limit_page_length: 500
      }
    })
    attendanceRecords.value = res.data.data || []
  } catch (e) {
    attendanceError.value = errMsg(e, 'Could not load team attendance')
    attendanceRecords.value = []
  } finally {
    attendanceLoading.value = false
  }
}

async function loadTeamTimesheets() {
  if (!team.value.length) {
    timesheetRecords.value = []
    return
  }

  timesheetLoading.value = true
  timesheetError.value = ''

  try {
    const res = await api.get('/api/resource/Timesheet', {
      params: {
        filters: JSON.stringify([
          ['employee', 'in', team.value.map((m) => m.id)],
          ['docstatus', '!=', 2],
          ['start_date', '<=', bounds.value.end],
          ['end_date', '>=', bounds.value.start]
        ]),
        fields: JSON.stringify([
          'name',
          'employee',
          'employee_name',
          'status',
          'start_date',
          'end_date',
          'total_hours'
        ]),
        order_by: 'start_date desc',
        limit_page_length: 500
      }
    })
    timesheetRecords.value = res.data.data || []
  } catch (e) {
    timesheetError.value = errMsg(e, 'Could not load team timesheets')
    timesheetRecords.value = []
  } finally {
    timesheetLoading.value = false
  }
}

onMounted(async () => {
  try {
    const res = await api.get('/api/resource/Leave Application', {
      params: {
        filters: JSON.stringify([
          ['leave_approver', '=', email],
          ['owner', '!=', email]
        ]),
        fields: JSON.stringify([
          'name',
          'employee',
          'employee_name',
          'leave_type',
          'from_date',
          'to_date',
          'total_leave_days',
          'status',
          'workflow_state'
        ]),
        order_by: 'from_date desc',
        limit_page_length: 500
      }
    })

    apps.value = res.data.data.filter(
      (l) => !['Rejected', 'Cancelled'].includes(state(l))
    )

    const members = new Map()
    apps.value.forEach((l) => members.set(l.employee, l.employee_name))

    try {
      const emp = await api.get('/api/resource/Employee', {
        params: {
          filters: JSON.stringify([
            ['leave_approver', '=', email],
            ['status', '=', 'Active']
          ]),
          fields: JSON.stringify(['name', 'employee_name']),
          limit_page_length: 200
        }
      })
      emp.data.data.forEach((e) => members.set(e.name, e.employee_name))
    } catch {}

    team.value = await Promise.all(
      [...members.entries()].map(async ([id, name]) => {
        try {
          const r = await api.get(
            '/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details',
            { params: { employee: id, date: today } }
          )
          const alloc = r.data.message.leave_allocation || {}
          const balances = Object.entries(alloc).map(([type, v]) => ({ type, ...v }))
          return { id, name, balances, ok: true }
        } catch {
          return { id, name, balances: [], ok: false }
        }
      })
    )

    /* designation + joining date for the table and "new this month" */
    try {
      const ids = team.value.map((m) => m.id)
      if (ids.length) {
        const r = await api.get('/api/resource/Employee', {
          params: {
            filters: JSON.stringify([['name', 'in', ids]]),
            fields: JSON.stringify(['name', 'designation', 'date_of_joining']),
            limit_page_length: 200
          }
        })
        const info = new Map(r.data.data.map((e) => [e.name, e]))
        team.value = team.value.map((m) => ({
          ...m,
          designation: info.get(m.id)?.designation || '',
          joined: info.get(m.id)?.date_of_joining || ''
        }))
      }
    } catch {}

    await Promise.all([loadTeamAttendance(), loadTeamTimesheets()])
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(e, 'Could not load team data')
    }
  }

  loading.value = false
})

watch(
  () => [viewDate.value, team.value.map((m) => m.id).join(',')],
  () => {
    if (!loading.value) {
      loadTeamAttendance()
      loadTeamTimesheets()
    }
  }
)

/* ---------- ATTENDANCE ---------- */

const attendanceStats = computed(() => {
  const count = (s) => attendanceRecords.value.filter((r) => r.status === s).length
  return {
    present: count('Present'),
    absent: count('Absent'),
    halfDay: count('Half Day'),
    onLeave: count('On Leave'),
    wfh: count('Work From Home')
  }
})

const total = computed(() => team.value.length)
const presentPct = computed(() => pctOf(attendanceStats.value.present, total.value))

const attendanceLegend = computed(() => [
  { label: 'Present', v: attendanceStats.value.present, c: '#22c55e' },
  { label: 'Absent', v: attendanceStats.value.absent, c: '#ef4444' },
  { label: 'On Leave', v: attendanceStats.value.onLeave, c: '#f59e0b' },
  { label: 'Half Day', v: attendanceStats.value.halfDay, c: '#8b5cf6' },
  { label: 'WFH', v: attendanceStats.value.wfh, c: '#94a3b8' }
])

const attendanceBg = computed(() => conic(attendanceLegend.value, total.value))

/* ---------- TIMESHEETS (selected week) ---------- */

const timesheetByEmp = computed(() => {
  const map = new Map()
  team.value.forEach((m) => {
    const recs = timesheetRecords.value.filter((r) => r.employee === m.id)
    const hours = recs.reduce((s, r) => s + Number(r.total_hours || 0), 0)
    const status = recs.some((r) => r.status !== 'Draft')
      ? 'Submitted'
      : recs.length
        ? 'Pending'
        : 'Not Started'
    map.set(m.id, { hours, status })
  })
  return map
})

const timesheetStats = computed(() => {
  const vals = [...timesheetByEmp.value.values()]
  return {
    submitted: vals.filter((v) => v.status === 'Submitted').length,
    pending: vals.filter((v) => v.status === 'Pending').length,
    notStarted: vals.filter((v) => v.status === 'Not Started').length
  }
})

const timesheetPct = computed(() => pctOf(timesheetStats.value.submitted, total.value))

const timesheetBg = computed(() =>
  conic(
    [
      { v: timesheetStats.value.submitted, c: '#2563eb' },
      { v: timesheetStats.value.pending, c: '#93c5fd' },
      { v: timesheetStats.value.notStarted, c: '#9ca3af' }
    ],
    total.value
  )
)

/* ---------- LEAVE ---------- */

const onLeaveIds = computed(
  () =>
    new Set(
      apps.value
        .filter(
          (l) =>
            state(l) === 'Approved' &&
            l.from_date <= viewDate.value &&
            l.to_date >= viewDate.value
        )
        .map((l) => l.employee)
    )
)

const pendingIds = computed(
  () =>
    new Set(
      apps.value
        .filter((l) => ['Pending', 'Open'].includes(state(l)))
        .map((l) => l.employee)
    )
)

const leaveColorByType = {
  CL: '#22c55e',
  SL: '#ef4444',
  EL: '#8b5cf6',
  CO: '#f59e0b',
  CF: '#3b82f6'
}

const monthlyLeaveTypes = computed(() => {
  const month = viewDate.value.slice(0, 7)
  const counts = {}

  apps.value
    .filter((l) => {
      const start = l.from_date || ''
      const end = l.to_date || start
      return (
        state(l) === 'Approved' &&
        start.slice(0, 7) <= month &&
        end.slice(0, 7) >= month
      )
    })
    .forEach((l) => {
      const type = l.leave_type || 'Other'
      counts[type] = (counts[type] || 0) + Number(l.total_leave_days || 0)
    })

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 4)
  const rest = sorted.slice(4).reduce((s, [, d]) => s + d, 0)
  if (rest) top.push(['Others', rest])

  return top.map(([type, days]) => ({
    type,
    days,
    key: type === 'Others' ? 'Others' : abbr(type),
    color:
      type === 'Others'
        ? '#94a3b8'
        : leaveColorByType[abbr(type)] || '#64748b'
  }))
})

const leaveTop = computed(() => {
  const max = Math.max(1, ...monthlyLeaveTypes.value.map((i) => i.days))
  return Math.max(4, Math.ceil(max / 2) * 2)
})

const leaveTicks = computed(() => [leaveTop.value, leaveTop.value / 2, 0])

/* ---------- STAT CARDS ---------- */

const newThisMonth = computed(
  () =>
    team.value.filter((m) => (m.joined || '').slice(0, 7) === viewDate.value.slice(0, 7))
      .length
)

/* ---------- TABLE ---------- */

const memberRows = computed(() =>
  team.value.map((m) => {
    const rec = attendanceRecords.value.find((r) => r.employee === m.id)
    const ts = timesheetByEmp.value.get(m.id) || { hours: 0, status: 'Not Started' }
    return {
      id: m.id,
      name: m.name,
      designation: m.designation || '—',
      status: rec?.status || 'Not Marked',
      hours: Math.round(ts.hours * 10) / 10,
      hoursPct: Math.min(100, pctOf(ts.hours, weekTarget)),
      tsStatus: ts.status,
      balances: m.ok ? m.balances.slice(0, 3) : [],
      balanceOk: m.ok
    }
  })
)

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return memberRows.value.filter((r) => {
    if (tab.value === 'present' && r.status !== 'Present') return false
    if (tab.value === 'absent' && r.status !== 'Absent') return false
    if (tab.value === 'onleave' && !(r.status === 'On Leave' || onLeaveIds.value.has(r.id)))
      return false
    if (tab.value === 'pending' && !pendingIds.value.has(r.id)) return false
    if (q && !`${r.name} ${r.id} ${r.designation}`.toLowerCase().includes(q)) return false
    return true
  })
})

const allSelected = computed(
  () =>
    filteredRows.value.length > 0 &&
    filteredRows.value.every((r) => selectedIds.value.includes(r.id))
)

function toggleAll(e) {
  selectedIds.value = e.target.checked ? filteredRows.value.map((r) => r.id) : []
}

function statusClass(s) {
  return (
    {
      Present: 'g',
      Absent: 'r',
      'On Leave': 'o',
      'Half Day': 'p',
      'Work From Home': 'b'
    }[s] || 'n'
  )
}

function tsClass(s) {
  return { Submitted: 'g', Pending: 'o' }[s] || 'n'
}

function exportCsv() {
  const rows = selectedIds.value.length
    ? filteredRows.value.filter((r) => selectedIds.value.includes(r.id))
    : filteredRows.value

  const head = ['Employee ID', 'Name', 'Designation', 'Status Today', 'Week Hours', 'Timesheet', 'Leave Balance']
  const lines = rows.map((r) =>
    [
      r.id,
      r.name,
      r.designation,
      r.status,
      r.hours,
      r.tsStatus,
      r.balances.map((b) => `${abbr(b.type)} ${b.remaining_leaves}`).join(' | ')
    ]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  )

  const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `team-${viewDate.value}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

/* ---------- TEAM TIMESHEETS POPUP ---------- */

const tsOpen = ref(false)
const tsEmployee = ref('all')
const tsRange = ref('week') // 'week' | 'all'
const tsRows = ref([])
const tsLoading = ref(false)
const tsErr = ref('')
const expanded = ref('')
const logsByName = ref({})
const logsLoading = ref('')

async function loadTsPopup() {
  if (!team.value.length) {
    tsRows.value = []
    return
  }
  tsLoading.value = true
  tsErr.value = ''
  try {
    const filters = [
      ['employee', 'in', team.value.map((m) => m.id)],
      ['docstatus', '!=', 2]
    ]
    if (tsRange.value === 'week') {
      filters.push(['start_date', '<=', bounds.value.end])
      filters.push(['end_date', '>=', bounds.value.start])
    }
    const res = await api.get('/api/resource/Timesheet', {
      params: {
        filters: JSON.stringify(filters),
        fields: JSON.stringify([
          'name',
          'employee',
          'employee_name',
          'start_date',
          'end_date',
          'total_hours',
          'status'
        ]),
        order_by: 'start_date desc',
        limit_page_length: 500
      }
    })
    tsRows.value = res.data.data || []
  } catch (e) {
    tsErr.value = errMsg(e, 'Could not load team timesheets')
    tsRows.value = []
  } finally {
    tsLoading.value = false
  }
}

function openTimesheets(empId = 'all') {
  tsEmployee.value = empId
  expanded.value = ''
  tsOpen.value = true
  loadTsPopup()
}

function closeTimesheets() {
  tsOpen.value = false
}

async function toggleLogs(name) {
  if (expanded.value === name) {
    expanded.value = ''
    return
  }
  expanded.value = name
  if (logsByName.value[name]) return
  logsLoading.value = name
  try {
    const res = await api.get(`/api/resource/Timesheet/${encodeURIComponent(name)}`)
    logsByName.value = {
      ...logsByName.value,
      [name]: res.data.data?.time_logs || []
    }
  } catch (e) {
    logsByName.value = { ...logsByName.value, [name]: [] }
    tsErr.value = errMsg(e, 'Could not load time logs')
  } finally {
    logsLoading.value = ''
  }
}

watch(tsRange, () => {
  if (tsOpen.value) loadTsPopup()
})

watch(
  () => viewDate.value,
  () => {
    if (tsOpen.value && tsRange.value === 'week') loadTsPopup()
  }
)

const tsFiltered = computed(() =>
  tsRows.value.filter((r) => tsEmployee.value === 'all' || r.employee === tsEmployee.value)
)

const tsTotalHours = computed(
  () =>
    Math.round(tsFiltered.value.reduce((s, r) => s + Number(r.total_hours || 0), 0) * 100) / 100
)

const tsChip = (s) => (s === 'Draft' ? 'o' : s === 'Cancelled' ? 'r' : 'g')
</script>

<template>
  <div class="team-dashboard">
    <!-- HEADER -->
    <div class="dashboard-header">
      <div>
        <h2>My Team</h2>
        <p>Overview of your team's attendance, timesheets, leaves and overall activity.</p>
      </div>

      <div class="header-date">
        <span class="range-pill">📅 {{ rangeLabel }}</span>
        <input type="date" v-model="viewDate" />
        <button type="button" @click="viewDate = today">Today</button>
      </div>
    </div>

    <p v-if="error" class="error-message">{{ error }}</p>
    <p v-if="attendanceError" class="error-message">{{ attendanceError }}</p>
    <p v-if="timesheetError" class="error-message">{{ timesheetError }}</p>
    <p v-if="loading" class="loading-message">Loading team dashboard...</p>

    <template v-else>
      <!-- SUMMARY CARDS -->
      <section class="summary-grid">
        <button type="button" class="summary-card" @click="tab = 'all'">
          <div class="summary-icon blue-icon">👥</div>
          <div class="summary-content">
            <span>Total Team Members</span>
            <strong>{{ total }}</strong>
            <small class="up">↑ {{ newThisMonth }} new this month</small>
          </div>
        </button>

        <button type="button" class="summary-card" @click="tab = 'present'">
          <div class="summary-icon green-icon">✓</div>
          <div class="summary-content grow">
            <span>Present Today</span>
            <strong>
              {{ attendanceStats.present }} / {{ total }}
              <em>{{ presentPct }}%</em>
            </strong>
            <div class="mini-bar"><i :style="{ width: presentPct + '%' }"></i></div>
          </div>
        </button>

        <button type="button" class="summary-card" @click="tab = 'onleave'">
          <div class="summary-icon amber-icon">✈</div>
          <div class="summary-content">
            <span>On Leave Today</span>
            <strong>{{ attendanceStats.onLeave }}</strong>
            <small class="link">View Leave Details →</small>
          </div>
        </button>

        <button type="button" class="summary-card" @click="tab = 'absent'">
          <div class="summary-icon red-icon">!</div>
          <div class="summary-content">
            <span>Absent Today</span>
            <strong>{{ attendanceStats.absent }}</strong>
            <small>Not present</small>
          </div>
        </button>
      </section>

      <!-- OVERVIEW -->
      <section class="overview-grid">
        <!-- Attendance -->
        <div class="dashboard-card attendance-card">
          <div class="oc-head">
            <h3>Attendance Overview</h3>
            <p>Team attendance for {{ viewDate }}</p>
          </div>

          <div class="oc-body">
            <div v-if="attendanceLoading" class="empty-state">Loading attendance...</div>
            <template v-else>
              <div class="donut" :style="{ background: attendanceBg }">
                <div class="hole">
                  <strong>{{ total }}</strong>
                  <span>Team Members</span>
                </div>
              </div>

              <ul class="legend">
                <li v-for="r in attendanceLegend" :key="r.label">
                  <i :style="{ background: r.c }"></i>
                  <span class="lg-label">{{ r.label }}</span>
                  <strong>{{ r.v }}</strong>
                  <small>{{ pctOf(r.v, total) }}%</small>
                </li>
              </ul>
            </template>
          </div>
        </div>

        <!-- Timesheets -->
        <div class="dashboard-card ts-card">
          <div class="oc-head">
            <h3>Timesheet Completion</h3>
          </div>

          <div class="oc-body">
            <div v-if="timesheetLoading" class="empty-state">Loading timesheets...</div>
            <template v-else>
              <div class="donut" :style="{ background: timesheetBg }">
                <div class="hole">
                  <strong>{{ timesheetPct }}%</strong>
                  <span>{{ timesheetStats.submitted }} / {{ total }}<br />Submitted</span>
                </div>
              </div>

              <div class="legend-wrap">
                <ul class="legend">
                  <li>
                    <i style="background: #2563eb"></i>
                    <span class="lg-label">Submitted</span>
                    <b>{{ timesheetStats.submitted }} ({{ pctOf(timesheetStats.submitted, total) }}%)</b>
                  </li>
                  <li>
                    <i style="background: #93c5fd"></i>
                    <span class="lg-label">Pending</span>
                    <b>{{ timesheetStats.pending }} ({{ pctOf(timesheetStats.pending, total) }}%)</b>
                  </li>
                  <li>
                    <i style="background: #9ca3af"></i>
                    <span class="lg-label">Not Started</span>
                    <b>{{ timesheetStats.notStarted }} ({{ pctOf(timesheetStats.notStarted, total) }}%)</b>
                  </li>
                </ul>

                <button type="button" class="ts-view-btn" @click="openTimesheets()">
                  View Timesheets →
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- Leave -->
        <div class="dashboard-card">
          <div class="oc-head">
            <h3>Leave Overview (This Month)</h3>
            <p>Approved leave days by type</p>
          </div>

          <div class="oc-body">
            <div v-if="monthlyLeaveTypes.length" class="leave-chart">
              <div class="leave-axis">
                <span v-for="t in leaveTicks" :key="t">{{ t }}</span>
              </div>

              <div class="leave-plot">
                <div class="leave-grid">
                  <i v-for="t in leaveTicks" :key="t"></i>
                </div>

                <div class="leave-bars-row">
                  <div
                    v-for="item in monthlyLeaveTypes"
                    :key="item.type"
                    class="leave-col"
                    :title="item.type + ': ' + item.days + ' day(s)'"
                  >
                    <span class="leave-val">{{ item.days }}</span>
                    <div
                      class="leave-bar"
                      :style="{ height: (item.days / leaveTop) * 120 + 'px', background: item.color }"
                    ></div>
                    <span class="leave-key">{{ item.key }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">No approved leave this month.</div>
          </div>
        </div>
      </section>

      <!-- TEAM MEMBERS -->
      <section class="team-members-card">
        <div class="members-header">
          <div>
            <h3>Team Members</h3>
            <p>View attendance, timesheet and leave information for your team.</p>
          </div>
        </div>

        <div class="table-toolbar">
          <div class="tab-row">
            <button
              v-for="t in tabs"
              :key="t.key"
              type="button"
              :class="{ active: tab === t.key }"
              @click="tab = t.key"
            >
              {{ t.label }}
            </button>
          </div>

          <div class="toolbar-actions">
            <div class="search-box">
              <span>⌕</span>
              <input v-model="search" type="text" placeholder="Search team members..." />
            </div>
            <button type="button" @click="exportCsv">Export</button>
          </div>
        </div>

        <div class="table-container">
          <table class="members-table">
            <thead>
              <tr>
                <th class="chk">
                  <input type="checkbox" :checked="allSelected" @change="toggleAll" />
                </th>
                <th>Employee</th>
                <th>Designation</th>
                <th>Status (Today)</th>
                <th>This Week Hours</th>
                <th>Timesheet Status</th>
                <th>Leave Balance</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="row in filteredRows" :key="row.id">
                <td class="chk">
                  <input type="checkbox" :value="row.id" v-model="selectedIds" />
                </td>

                <td>
                  <div class="employee-cell">
                    <div class="employee-avatar">{{ row.name?.charAt(0)?.toUpperCase() || '?' }}</div>
                    <div>
                      <button type="button" class="employee-name" @click="open(row.id)">
                        {{ row.name }}
                      </button>
                      <span>{{ row.id }}</span>
                    </div>
                  </div>
                </td>

                <td>{{ row.designation }}</td>

                <td>
                  <span class="chip" :class="statusClass(row.status)">● {{ row.status }}</span>
                </td>

                <td>
                  <div class="hours-cell">
                    <span>{{ row.hours }} / {{ weekTarget }}</span>
                    <div class="mini-bar"><i :style="{ width: row.hoursPct + '%' }"></i></div>
                    <small>{{ row.hoursPct }}%</small>
                  </div>
                </td>

                <td>
                  <span class="chip" :class="tsClass(row.tsStatus)">{{ row.tsStatus }}</span>
                </td>

                <td>
                  <div v-if="row.balances.length" class="balance-chips">
                    <span v-for="b in row.balances" :key="b.type" :title="b.type">
                      {{ abbr(b.type) }} <strong>{{ b.remaining_leaves }}</strong>
                    </span>
                  </div>
                  <span v-else-if="row.balanceOk" class="muted-text">No leave allocated</span>
                  <span v-else class="muted-text">Unavailable</span>
                </td>

                <td>
                  <div class="action-group">
                    <button type="button" class="view-button" @click="open(row.id)">View</button>
                    <button type="button" class="view-button" @click="openTimesheets(row.id)">
                      Timesheets
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="!filteredRows.length">
                <td colspan="8" class="empty-table">No team members found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- TEAM TIMESHEETS POPUP -->
    <Teleport to="body">
      <div v-if="tsOpen" class="ts-overlay" @click.self="closeTimesheets">
        <div class="ts-modal" role="dialog" aria-label="Team timesheets">
          <div class="ts-head">
            <div>
              <h3>Team Timesheets</h3>
              <p>
                {{ tsRange === 'week' ? rangeLabel : 'All time' }} ·
                {{ tsFiltered.length }} timesheet(s) · {{ tsTotalHours }} hrs
              </p>
            </div>
            <button type="button" class="ts-close" @click="closeTimesheets">✕</button>
          </div>

          <div class="ts-filters">
            <select v-model="tsEmployee">
              <option value="all">All team members</option>
              <option v-for="m in team" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>

            <div class="ts-toggle">
              <button type="button" :class="{ on: tsRange === 'week' }" @click="tsRange = 'week'">
                This week
              </button>
              <button type="button" :class="{ on: tsRange === 'all' }" @click="tsRange = 'all'">
                All time
              </button>
            </div>
          </div>

          <p v-if="tsErr" class="error-message ts-error">{{ tsErr }}</p>

          <div class="ts-body">
            <p v-if="tsLoading" class="ts-empty">Loading timesheets...</p>
            <p v-else-if="!tsFiltered.length" class="ts-empty">
              No timesheets found for this selection.
            </p>

            <table v-else class="ts-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Employee</th>
                  <th>Timesheet</th>
                  <th>Period</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="r in tsFiltered" :key="r.name">
                  <tr class="ts-row" @click="toggleLogs(r.name)">
                    <td class="ts-arrow">{{ expanded === r.name ? '▾' : '▸' }}</td>
                    <td>
                      <strong>{{ r.employee_name }}</strong>
                      <small>{{ r.employee }}</small>
                    </td>
                    <td>{{ r.name }}</td>
                    <td>{{ fmt(r.start_date) }} – {{ fmt(r.end_date) }}</td>
                    <td>{{ Number(r.total_hours || 0).toFixed(2) }}</td>
                    <td><span class="chip" :class="tsChip(r.status)">{{ r.status }}</span></td>
                  </tr>

                  <tr v-if="expanded === r.name" class="ts-logs-row">
                    <td colspan="6">
                      <p v-if="logsLoading === r.name" class="ts-empty small">Loading time logs...</p>
                      <p v-else-if="!(logsByName[r.name] || []).length" class="ts-empty small">
                        No time logs in this timesheet.
                      </p>
                      <table v-else class="ts-inner">
                        <thead>
                          <tr>
                            <th>Activity</th>
                            <th>Project</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Hours</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(l, i) in logsByName[r.name]" :key="i">
                            <td>{{ l.activity_type || '—' }}</td>
                            <td>{{ l.project || '—' }}</td>
                            <td>{{ l.from_time || '—' }}</td>
                            <td>{{ l.to_time || '—' }}</td>
                            <td>{{ Number(l.hours || 0).toFixed(2) }}</td>
                            <td>{{ l.description || '—' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* The parent page (ManageMyTeam) owns the page padding — none here */
.team-dashboard {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  color: #172033;
}

/* neutralise global text-align leaks */
.team-dashboard,
.team-dashboard * {
  text-align: left;
}

.team-dashboard .hole,
.team-dashboard .hole *,
.team-dashboard .empty-state,
.team-dashboard .empty-table,
.team-dashboard .leave-col,
.team-dashboard .leave-col * {
  text-align: center;
}

/* ===== HEADER ===== */
.dashboard-header {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.dashboard-header > div:first-child {
  flex: 1;
  min-width: 0;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
}

.dashboard-header p {
  margin: 6px 0 0;
  color: #718096;
  font-size: 13px;
}

.header-date {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 8px;
}

.range-pill,
.header-date input,
.header-date button {
  height: 36px;
  box-sizing: border-box;
  border: 1px solid #dce2ec;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 12px;
}

.range-pill {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  width: auto;
  padding: 0 12px;
  white-space: nowrap;
}

.header-date input {
  width: 140px;
  flex: 0 0 auto;
  padding: 0 11px;
}

.header-date button {
  width: auto;
  flex: 0 0 auto;
  padding: 0 13px;
  cursor: pointer;
}

.header-date button:hover {
  background: #f8fafc;
}

.error-message {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
}

.loading-message {
  color: #64748b;
  font-size: 13px;
}

/* ===== GRIDS ===== */
.summary-grid,
.overview-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
  align-items: stretch;
}

.summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.overview-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* ===== SUMMARY CARDS ===== */
.summary-card {
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: 14px;
  width: 100%;
  min-height: 118px;
  margin: 0;
  padding: 20px;
  box-sizing: border-box;
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
  font: inherit;
  cursor: pointer;
  transform: none;
}

.summary-card:hover {
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.09);
}

.summary-icon {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  font-size: 20px;
  font-weight: 700;
}

.blue-icon { background: #eef2ff; color: #4f46e5; }
.green-icon { background: #ecfdf3; color: #16a34a; }
.amber-icon { background: #fff7e6; color: #d97706; }
.red-icon { background: #fef2f2; color: #dc2626; }

.summary-content {
  min-width: 0;
}

.summary-content.grow {
  flex: 1;
}

.summary-content span,
.summary-content small {
  display: block;
}

.summary-content span {
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.summary-content strong {
  display: block;
  margin: 4px 0;
  color: #172033;
  font-size: 27px;
  line-height: 1.1;
}

.summary-content strong em {
  float: right;
  margin-top: 10px;
  color: #64748b;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
}

.summary-content small {
  color: #94a3b8;
  font-size: 11px;
}

.summary-content small.up { color: #16a34a; }
.summary-content small.link { color: #2563eb; }

.mini-bar {
  flex: 1;
  height: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: #e8ebf0;
}

.mini-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: #22c55e;
}

/* ===== OVERVIEW CARDS ===== */
.dashboard-card,
.team-members-card {
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
}

.dashboard-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  min-height: 240px;
  padding: 20px;
  box-sizing: border-box;
}

.oc-head {
  flex-shrink: 0;
  width: 100%;
}

.oc-head h3,
.members-header h3 {
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 700;
}

.oc-head p,
.members-header p {
  margin: 5px 0 0;
  color: #8a94a6;
  font-size: 12px;
  line-height: 1.35;
}

.oc-body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  min-width: 0;
  margin-top: 10px;
}

.empty-state {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 120px;
  color: #94a3b8;
  font-size: 12px;
}

/* donut */
.donut {
  display: grid;
  place-items: center;
  flex: 0 0 130px;
  width: 130px;
  height: 130px;
  border-radius: 50%;
}

.hole {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 94px;
  height: 94px;
  border-radius: 50%;
  background: #fff;
}

.hole strong {
  font-size: 22px;
  line-height: 1;
  font-weight: 800;
}

.hole span {
  margin-top: 4px;
  padding: 0 6px;
  color: #8a94a6;
  font-size: 10px;
  line-height: 1.25;
}

/* legend (shared) */
.legend {
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.lg-label {
  color: #64748b;
  font-size: 12.5px;
  white-space: nowrap;
}

.legend strong {
  color: #172033;
  font-size: 13px;
  text-align: right;
}

.legend small {
  color: #64748b;
  font-size: 11.5px;
  text-align: right;
}

/* ===== Attendance card ===== */
.attendance-card .oc-body {
  justify-content: center;
  gap: 32px;
}

.attendance-card .legend {
  flex: 0 1 230px;
  max-width: 230px;
  width: 100%;
}

.attendance-card .legend li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 28px 40px;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  border-bottom: 1px solid #f1f3f7;
}

.attendance-card .legend li:last-child {
  border-bottom: 0;
}

/* ===== Timesheet Completion card ===== */
.ts-card .oc-body {
  justify-content: space-between;
  gap: 28px;
}

.ts-card .donut {
  flex: 0 0 132px;
  width: 132px;
  height: 132px;
}

.ts-card .hole {
  width: 92px;
  height: 92px;
}

.ts-card .legend-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.ts-card .legend li {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 10px;
  min-height: 30px;
}

.ts-card .lg-label {
  color: #334155;
}

.ts-card .legend b {
  color: #172033;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  text-align: right;
}

.ts-view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  width: 100%;
  height: 36px;
  margin: 14px 0 0;
  padding: 0 14px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #fff;
  color: #2563eb;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease;
}

.ts-view-btn:hover {
  background: #eff6ff;
}

/* ===== Leave chart ===== */
.leave-chart {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding-top: 6px;
}

.leave-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 120px;
  color: #94a3b8;
  font-size: 10px;
  line-height: 1;
  text-align: right;
}

.leave-plot {
  position: relative;
  flex: 1;
  min-width: 0;
  padding-bottom: 22px;
}

.leave-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.leave-grid i {
  display: block;
  height: 0;
  border-top: 1px dashed #e6eaf0;
}

.leave-bars-row {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 26px;
  height: 120px;
}

.leave-col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 120px;
  min-width: 36px;
}

.leave-bar {
  width: 36px;
  border-radius: 4px 4px 0 0;
}

.leave-val {
  margin-bottom: 3px;
  font-size: 11px;
  font-weight: 600;
}

.leave-key {
  position: absolute;
  bottom: -20px;
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}

/* ===== TEAM MEMBERS ===== */
.team-members-card {
  padding: 20px;
  box-sizing: border-box;
}

.members-header {
  margin-bottom: 14px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  border-bottom: 1px solid #e6eaf0;
}

.tab-row {
  display: flex;
  gap: 4px;
}

.tab-row button {
  padding: 10px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.tab-row button.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  height: 34px;
  padding: 0 10px;
  box-sizing: border-box;
  border: 1px solid #dfe4ec;
  border-radius: 7px;
  background: #fff;
}

.search-box span {
  color: #94a3b8;
  font-size: 16px;
}

.search-box input {
  width: 100%;
  max-width: none;
  border: 0;
  outline: 0;
  color: #334155;
  font-size: 11px;
}

.toolbar-actions > button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid #dfe4ec;
  border-radius: 7px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.table-container {
  width: 100%;
  overflow-x: auto;
}

.members-table {
  width: 100%;
  border-collapse: collapse;
}

.members-table th,
.members-table td {
  padding: 11px 12px;
  border-bottom: 1px solid #edf0f4;
  text-align: left;
  vertical-align: middle;
}

.members-table th {
  background: #fafbfc;
  color: #7b8494;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.members-table td {
  color: #475569;
  font-size: 12px;
}

.chk {
  width: 32px;
}

.employee-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.employee-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
}

.employee-name {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: #172033;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.employee-cell span {
  display: block;
  margin-top: 2px;
  color: #9aa3b2;
  font-size: 10px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.chip.g { background: #dcfce7; color: #15803d; }
.chip.r { background: #fee2e2; color: #b91c1c; }
.chip.o { background: #fef3c7; color: #b45309; }
.chip.p { background: #ede9fe; color: #6d28d9; }
.chip.b { background: #dbeafe; color: #1d4ed8; }

.hours-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.hours-cell .mini-bar {
  flex: 0 0 80px;
}

.hours-cell .mini-bar i {
  background: #2563eb;
}

.hours-cell small {
  color: #94a3b8;
  font-size: 11px;
}

.balance-chips {
  display: flex;
  gap: 12px;
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}

.balance-chips strong {
  color: #334155;
}

.muted-text {
  color: #94a3b8;
  font-size: 11px;
}

.action-group {
  display: flex;
  gap: 6px;
  white-space: nowrap;
}

.view-button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #dce2ec;
  border-radius: 6px;
  background: #fff;
  color: #4f46e5;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.empty-table {
  padding: 28px;
  color: #94a3b8;
  text-align: center;
}

/* ===== Team timesheets popup ===== */
.ts-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.ts-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1000px;
  max-height: 86vh;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
  color: #172033;
  text-align: left;
}

.ts-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 12px;
}

.ts-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.ts-head p {
  margin: 5px 0 0;
  color: #718096;
  font-size: 12px;
}

.ts-close {
  width: 32px;
  height: 32px;
  border: 1px solid #dce2ec;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}

.ts-error {
  margin: 0 24px 8px;
}

.ts-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 24px 14px;
  border-bottom: 1px solid #e6eaf0;
}

.ts-filters select {
  width: 240px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #dce2ec;
  border-radius: 8px;
  background: #fff;
  color: #334155;
  font: inherit;
  font-size: 12px;
}

.ts-toggle {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 8px;
  background: #f1f3f7;
}

.ts-toggle button {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ts-toggle button.on {
  background: #fff;
  color: #2563eb;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1);
}

.ts-body {
  flex: 1;
  overflow: auto;
  padding: 8px 24px 24px;
}

.ts-empty {
  padding: 36px 0;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

.ts-empty.small {
  padding: 14px 0;
}

.ts-table,
.ts-inner {
  width: 100%;
  border-collapse: collapse;
}

.ts-table th,
.ts-table td {
  padding: 11px 10px;
  border-bottom: 1px solid #edf0f4;
  color: #475569;
  font-size: 12px;
  text-align: left;
  vertical-align: middle;
}

.ts-table th {
  position: sticky;
  top: 0;
  background: #fafbfc;
  color: #7b8494;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.ts-table td strong {
  display: block;
  color: #172033;
}

.ts-table td small {
  color: #9aa3b2;
  font-size: 10px;
}

.ts-row {
  cursor: pointer;
}

.ts-row:hover {
  background: #f8fafc;
}

.ts-arrow {
  width: 22px;
  color: #94a3b8;
}

.ts-logs-row > td {
  padding: 0 10px 14px 32px !important;
  background: #f8fafc;
}

.ts-inner th,
.ts-inner td {
  position: static;
  padding: 8px 10px;
  border-bottom: 1px solid #e8ecf2;
  background: transparent;
  font-size: 11px;
  text-align: left;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1250px) {
  .attendance-card .oc-body,
  .ts-card .oc-body {
    gap: 18px;
  }

  .attendance-card .legend {
    flex-basis: 190px;
  }
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 750px) {
  .dashboard-header,
  .table-toolbar {
    flex-direction: column;
    flex-wrap: wrap;
    align-items: stretch;
  }

  .header-date {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .search-box {
    flex: 1;
    width: auto;
  }

  .tab-row {
    overflow-x: auto;
  }
}
</style>