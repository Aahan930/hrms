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
const selected = ref(null)

/* -----------------------------
   TEAM ATTENDANCE
------------------------------ */

const attendanceRecords = ref([])
const attendanceLoading = ref(false)
const attendanceError = ref('')

/* -----------------------------
   TEAM TIMESHEETS
------------------------------ */

const timesheetRecords = ref([])
const timesheetLoading = ref(false)
const timesheetError = ref('')

function state(l) {
  return l.workflow_state || l.status
}

function pct(b) {
  return b.total_leaves
    ? Math.min(
        100,
        Math.round(
          (b.leaves_taken / b.total_leaves) * 100
        )
      )
    : 0
}

const open = (id) =>
  id && router.push(`/team/employee/${id}`)

function pick(name) {
  selected.value =
    selected.value === name ? null : name
}

/* -----------------------------
   LOAD TEAM ATTENDANCE
------------------------------ */

async function loadTeamAttendance() {
  if (!team.value.length) {
    attendanceRecords.value = []
    return
  }

  attendanceLoading.value = true
  attendanceError.value = ''

  try {
    const employeeIds = team.value.map(
      (member) => member.id
    )

    const res = await api.get(
      '/api/resource/Attendance',
      {
        params: {
          filters: JSON.stringify([
            ['employee', 'in', employeeIds],
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
      }
    )

    attendanceRecords.value =
      res.data.data || []
  } catch (e) {
    attendanceError.value = errMsg(
      e,
      'Could not load team attendance'
    )

    attendanceRecords.value = []
  } finally {
    attendanceLoading.value = false
  }
}

/* -----------------------------
   ATTENDANCE COMPUTED DATA
------------------------------ */

const attendanceStats = computed(() => {
  const present =
    attendanceRecords.value.filter(
      (r) => r.status === 'Present'
    ).length

  const absent =
    attendanceRecords.value.filter(
      (r) => r.status === 'Absent'
    ).length

  const halfDay =
    attendanceRecords.value.filter(
      (r) => r.status === 'Half Day'
    ).length

  const onLeave =
    attendanceRecords.value.filter(
      (r) => r.status === 'On Leave'
    ).length

  return {
    present,
    absent,
    halfDay,
    onLeave
  }
})

const attendanceRows = computed(() => {
  return team.value.map((member) => {
    const record =
      attendanceRecords.value.find(
        (r) => r.employee === member.id
      )

    return {
      id: member.id,
      name: member.name,
      status:
        record?.status || 'Not Marked',
      leaveType:
        record?.leave_type || ''
    }
  })
})

const attendancePercentage = computed(() => {
  const total =
    attendanceStats.value.present +
    attendanceStats.value.absent +
    attendanceStats.value.halfDay +
    attendanceStats.value.onLeave

  if (!total) return 0

  return Math.round(
    (
      (
        attendanceStats.value.present +
        attendanceStats.value.halfDay * 0.5
      ) /
      total
    ) *
      100
  )
})

/* -----------------------------
   LOAD TEAM TIMESHEETS
------------------------------ */

async function loadTeamTimesheets() {
  if (!team.value.length) {
    timesheetRecords.value = []
    return
  }

  timesheetLoading.value = true
  timesheetError.value = ''

  try {
    const employeeIds = team.value.map(
      (member) => member.id
    )

    const res = await api.get(
      '/api/resource/Timesheet',
      {
        params: {
          filters: JSON.stringify([
            ['employee', 'in', employeeIds]
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
      }
    )

    timesheetRecords.value =
      res.data.data || []
  } catch (e) {
    timesheetError.value = errMsg(
      e,
      'Could not load team timesheets'
    )

    timesheetRecords.value = []
  } finally {
    timesheetLoading.value = false
  }
}

/* -----------------------------
   TIMESHEET COMPUTED DATA
------------------------------ */

const timesheetStats = computed(() => {
  const records =
    timesheetRecords.value

  return {
    total: records.length,

    draft: records.filter(
      (r) => r.status === 'Draft'
    ).length,

    submitted: records.filter(
      (r) => r.status === 'Submitted'
    ).length,

    cancelled: records.filter(
      (r) => r.status === 'Cancelled'
    ).length,

    totalHours: records.reduce(
      (sum, r) =>
        sum + Number(r.total_hours || 0),
      0
    )
  }
})

const timesheetEmployeeRows = computed(() => {
  return team.value.map((member) => {
    const records =
      timesheetRecords.value.filter(
        (r) => r.employee === member.id
      )

    const hours = records.reduce(
      (sum, r) =>
        sum + Number(r.total_hours || 0),
      0
    )

    return {
      id: member.id,
      name: member.name,
      timesheets: records.length,
      hours
    }
  })
})

/* -----------------------------
   LOAD TEAM DATA
------------------------------ */

onMounted(async () => {
  try {
    const res = await api.get(
      '/api/resource/Leave Application',
      {
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
      }
    )

    apps.value = res.data.data.filter(
      (l) =>
        !['Rejected', 'Cancelled'].includes(
          state(l)
        )
    )

    const members = new Map()

    apps.value.forEach((l) => {
      members.set(
        l.employee,
        l.employee_name
      )
    })

    try {
      const emp = await api.get(
        '/api/resource/Employee',
        {
          params: {
            filters: JSON.stringify([
              ['leave_approver', '=', email],
              ['status', '=', 'Active']
            ]),
            fields: JSON.stringify([
              'name',
              'employee_name'
            ]),
            limit_page_length: 200
          }
        }
      )

      emp.data.data.forEach((e) => {
        members.set(
          e.name,
          e.employee_name
        )
      })
    } catch {}

    team.value = await Promise.all(
      [...members.entries()].map(
        async ([id, name]) => {
          try {
            const r = await api.get(
              '/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details',
              {
                params: {
                  employee: id,
                  date: today
                }
              }
            )

            const alloc =
              r.data.message.leave_allocation ||
              {}

            const balances =
              Object.entries(alloc).map(
                ([type, v]) => ({
                  type,
                  ...v
                })
              )

            return {
              id,
              name,
              balances,
              ok: true
            }
          } catch {
            return {
              id,
              name,
              balances: [],
              ok: false
            }
          }
        }
      )
    )

    await loadTeamAttendance()
    await loadTeamTimesheets()
  } catch (e) {
    if (
      e.response?.status === 401 ||
      e.response?.status === 403
    ) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(
        e,
        'Could not load team data'
      )
    }
  }

  loading.value = false
})

/* -----------------------------
   WATCH DATE / TEAM
------------------------------ */

watch(
  () => [
    viewDate.value,
    team.value.map(
      (member) => member.id
    ).join(',')
  ],
  () => {
    if (!loading.value) {
      loadTeamAttendance()
    }
  }
)

/* -----------------------------
   LEAVE COMPUTED DATA
------------------------------ */

const onLeave = computed(() =>
  apps.value.filter(
    (l) =>
      state(l) === 'Approved' &&
      l.from_date <= viewDate.value &&
      l.to_date >= viewDate.value
  )
)

const onLeaveIds = computed(
  () =>
    new Set(
      onLeave.value.map(
        (l) => l.employee
      )
    )
)

const upcoming = computed(() =>
  apps.value
    .filter(
      (l) =>
        state(l) === 'Approved' &&
        l.from_date > viewDate.value
    )
    .sort((a, b) =>
      a.from_date.localeCompare(
        b.from_date
      )
    )
    .slice(0, 8)
)

const pendingList = computed(() =>
  apps.value.filter((l) =>
    ['Pending', 'Open'].includes(
      state(l)
    )
  )
)

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

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, days]) => ({
      type,
      days,
      percentage: team.value.length
        ? Math.min(100, Math.round((days / team.value.length) * 100))
        : 0
    }))
})

const detail = computed(() => {
  switch (selected.value) {
    case 'members':
      return {
        title: 'Team members',
        empty: 'No team members yet.',
        rows: team.value.map((m) => ({
          key: m.id,
          emp: m.id,
          title: m.name,
          sub: m.id,
          tag: onLeaveIds.value.has(m.id)
            ? 'On leave'
            : 'Available'
        }))
      }

    case 'onleave':
      return {
        title: `On leave on ${viewDate.value}`,
        empty:
          'Nobody is on approved leave on this date.',
        rows: onLeave.value.map((l) => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date}`,
          tag: `${l.total_leave_days} day(s)`
        }))
      }

    case 'pending':
      return {
        title: 'Pending requests',
        empty: 'No pending requests.',
        rows: pendingList.value.map((l) => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date} · ${l.total_leave_days} day(s)`,
          tag: 'Pending'
        })),
        approvals: true
      }

    case 'upcoming':
      return {
        title: 'Upcoming approved leaves',
        empty:
          'No upcoming approved leaves.',
        rows: upcoming.value.map((l) => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date}`,
          tag: `${l.total_leave_days} day(s)`
        }))
      }

    default:
      return null
  }
})
</script>

<template>
  <div class="team-dashboard">
    <!-- HEADER -->
    <div class="dashboard-header">
      <div>
        <h2>My Team</h2>
        <p>Overview of your team's attendance, timesheets, leaves and activity.</p>
      </div>

      <div class="header-date">
        <input type="date" v-model="viewDate" />
        <button type="button" @click="viewDate = today">Today</button>
      </div>
    </div>

    <p v-if="error" class="error-message">{{ error }}</p>

    <p v-if="loading" class="loading-message">
      Loading team dashboard...
    </p>

    <template v-else>

      <!-- SUMMARY CARDS -->
      <section class="summary-grid">

        <button
          type="button"
          class="summary-card"
          @click="pick('members')"
        >
          <div class="summary-icon blue-icon">👥</div>
          <div class="summary-content">
            <span>Total Team Members</span>
            <strong>{{ team.length }}</strong>
            <small>Active team members</small>
          </div>
        </button>

        <button
          type="button"
          class="summary-card"
          @click="pick('present')"
        >
          <div class="summary-icon green-icon">✓</div>
          <div class="summary-content">
            <span>Present Today</span>
            <strong>{{ attendanceStats.present }}</strong>
            <small>Marked present</small>
          </div>
        </button>

        <button
          type="button"
          class="summary-card"
          @click="pick('onleave')"
        >
          <div class="summary-icon purple-icon">◷</div>
          <div class="summary-content">
            <span>On Leave Today</span>
            <strong>{{ attendanceStats.onLeave }}</strong>
            <small>Approved leave</small>
          </div>
        </button>

        <button
          type="button"
          class="summary-card"
          @click="pick('absent')"
        >
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

        <!-- ATTENDANCE -->
        <div class="dashboard-card attendance-card">
          <div class="card-heading">
            <div>
              <h3>Attendance Overview</h3>
              <p>Team attendance for {{ viewDate }}</p>
            </div>
          </div>

          <div v-if="attendanceLoading" class="empty-state">
            Loading attendance...
          </div>

          <div v-else class="attendance-overview">
            <div
              class="attendance-ring"
              :style="{
                '--present-pct': team.length ? (attendanceStats.present / team.length) * 100 : 0,
                '--absent-pct': team.length ? (attendanceStats.absent / team.length) * 100 : 0,
                '--leave-pct': team.length ? (attendanceStats.onLeave / team.length) * 100 : 0,
                '--half-pct': team.length ? (attendanceStats.halfDay / team.length) * 100 : 0
              }"
            >
              <div class="ring-value">
                <strong>{{ team.length }}</strong>
                <span>Team Members</span>
              </div>
            </div>

            <div class="legend-list">
              <div class="legend-item">
                <span class="legend-dot present-dot"></span>
                <span>Present</span>
                <strong>{{ attendanceStats.present }}</strong>
                <small>{{ team.length ? Math.round((attendanceStats.present / team.length) * 100) : 0 }}%</small>
              </div>

              <div class="legend-item">
                <span class="legend-dot absent-dot"></span>
                <span>Absent</span>
                <strong>{{ attendanceStats.absent }}</strong>
                <small>{{ team.length ? Math.round((attendanceStats.absent / team.length) * 100) : 0 }}%</small>
              </div>

              <div class="legend-item">
                <span class="legend-dot leave-dot"></span>
                <span>On Leave</span>
                <strong>{{ attendanceStats.onLeave }}</strong>
                <small>{{ team.length ? Math.round((attendanceStats.onLeave / team.length) * 100) : 0 }}%</small>
              </div>

              <div class="legend-item">
                <span class="legend-dot half-dot"></span>
                <span>Half Day</span>
                <strong>{{ attendanceStats.halfDay }}</strong>
                <small>{{ team.length ? Math.round((attendanceStats.halfDay / team.length) * 100) : 0 }}%</small>
              </div>
            </div>
          </div>
        </div>

        <!-- TIMESHEETS -->
        <div class="dashboard-card">
          <div class="card-heading">
            <div>
              <h3>Timesheet Overview</h3>
              <p>Timesheet activity across your team</p>
            </div>
          </div>

          <div v-if="timesheetLoading" class="empty-state">
            Loading timesheets...
          </div>

          <div v-else class="timesheet-overview">
            <div
              class="timesheet-ring"
              :style="{
                '--completion': timesheetStats.total
                  ? Math.round((timesheetStats.submitted / timesheetStats.total) * 100)
                  : 0
              }"
            >
              <div class="ring-value">
                <strong>
                  {{ timesheetStats.total
                    ? Math.round((timesheetStats.submitted / timesheetStats.total) * 100)
                    : 0 }}%
                </strong>
                <span>Submitted</span>
              </div>
            </div>

            <div class="timesheet-status-list">
              <div>
                <span>Submitted</span>
                <strong class="status-green">{{ timesheetStats.submitted }}</strong>
              </div>

              <div>
                <span>Pending</span>
                <strong class="status-amber">{{ timesheetStats.draft }}</strong>
              </div>

              <div>
                <span>Cancelled</span>
                <strong class="status-red">{{ timesheetStats.cancelled }}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- LEAVE -->
        <div class="dashboard-card">
          <div class="card-heading">
            <div>
              <h3>Leave Overview</h3>
              <p>Approved leave by type</p>
            </div>
          </div>

          <div class="leave-overview">
            <div v-if="monthlyLeaveTypes.length" class="leave-bars">
              <div
                v-for="item in monthlyLeaveTypes"
                :key="item.type"
                class="leave-bar-row"
              >
                <span>{{ item.type }}</span>

                <div class="leave-bar-track">
                  <div
                    class="leave-bar-fill purple-fill"
                    :style="{ width: item.percentage + '%' }"
                  ></div>
                </div>

                <strong>{{ item.days }}</strong>
              </div>
            </div>

            <div v-else class="empty-state">
              No approved leave this month.
            </div>
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

          <div class="members-actions">
            <button
              type="button"
              :class="{ active: selected === 'members' }"
              @click="pick('members')"
            >
              All Members
            </button>

            <button
              type="button"
              :class="{ active: selected === 'onleave' }"
              @click="pick('onleave')"
            >
              On Leave
            </button>

            <button
              type="button"
              :class="{ active: selected === 'pending' }"
              @click="pick('pending')"
            >
              Pending
            </button>
          </div>
        </div>

        <!-- SEARCH / FILTER BAR -->
        <div class="table-toolbar">
          <div class="search-box">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search team members..."
            />
          </div>

          <div class="toolbar-actions">
            <button type="button">Filter</button>
            <button type="button">Export</button>
          </div>
        </div>

        <!-- ATTENDANCE TABLE -->
        <div class="table-container">
          <table class="members-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status Today</th>
                <th>Timesheets</th>
                <th>Leave Balance</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="member in team"
                :key="member.id"
              >
                <td>
                  <div class="employee-cell">
                    <div class="employee-avatar">
                      {{ member.name?.charAt(0)?.toUpperCase() || '?' }}
                    </div>

                    <div>
                      <button
                        type="button"
                        class="employee-name"
                        @click="open(member.id)"
                      >
                        {{ member.name }}
                      </button>

                      <span>{{ member.id }}</span>
                    </div>
                  </div>
                </td>

                <td>
                  <span
                    v-if="attendanceRows.find(r => r.id === member.id)"
                    :class="[
                      'status-badge',
                      (attendanceRows.find(r => r.id === member.id)?.status || '')
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                    ]"
                  >
                    {{ attendanceRows.find(r => r.id === member.id)?.status }}
                  </span>
                  <span v-else class="status-badge not-marked">
                    Not Marked
                  </span>
                </td>

                <td>
                  <span class="table-number">
                    {{
                      timesheetEmployeeRows.find(
                        r => r.id === member.id
                      )?.timesheets || 0
                    }}
                  </span>
                </td>

                <td>
                  <div
                    v-if="member.ok && member.balances.length"
                    class="balance-cell"
                  >
                    <div
                      v-for="balance in member.balances.slice(0, 2)"
                      :key="balance.type"
                    >
                      <div class="balance-line">
                        <span>{{ balance.type }}</span>
                        <strong>
                          {{ balance.remaining_leaves }}
                        </strong>
                      </div>

                      <div class="balance-bar">
                        <div
                          :style="{
                            width: pct(balance) + '%'
                          }"
                        ></div>
                      </div>
                    </div>
                  </div>

                  <span
                    v-else-if="member.ok"
                    class="muted-text"
                  >
                    No leave allocated
                  </span>

                  <span
                    v-else
                    class="muted-text"
                  >
                    Unavailable
                  </span>
                </td>

                <td>
                  <button
                    type="button"
                    class="view-button"
                    @click="open(member.id)"
                  >
                    View
                  </button>
                </td>
              </tr>

              <tr v-if="!team.length">
                <td colspan="5" class="empty-table">
                  No team members found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>


    </template>
  </div>
</template>

<style scoped>
.team-dashboard {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 22px 28px 36px;
  box-sizing: border-box;
  color: #172033;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
}

.dashboard-header h2 {
  margin: 0;
  color: #172033;
  font-size: 27px;
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
  gap: 8px;
}

.header-date input,
.header-date button,
.toolbar-actions button,
.members-actions button,
.secondary-action,
.view-button,
.primary-action,
.close-action {
  font: inherit;
}

.header-date input {
  height: 36px;
  padding: 0 11px;
  border: 1px solid #dce2ec;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 12px;
}

.header-date button {
  height: 36px;
  padding: 0 13px;
  border: 1px solid #dce2ec;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
}

.header-date button:hover {
  background: #f8fafc;
}

.error-message {
  margin: 0 0 18px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 14px;
}

.loading-message {
  padding: 30px 0;
  color: #64748b;
  text-align: center;
}

/* SUMMARY */

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 100px;
  padding: 16px;
  box-sizing: border-box;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 7px rgba(15, 23, 42, .045);
  text-align: left;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease;
}

.summary-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 14px rgba(15, 23, 42, .07);
}

.summary-icon {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border-radius: 9px;
  font-size: 18px;
  font-weight: 700;
}

.blue-icon {
  background: #eef2ff;
  color: #4f46e5;
}

.green-icon {
  background: #ecfdf3;
  color: #16a34a;
}

.purple-icon {
  background: #f3e8ff;
  color: #7c3aed;
}

.red-icon {
  background: #fef2f2;
  color: #dc2626;
}

.summary-content {
  min-width: 0;
}

.summary-content span,
.summary-content small {
  display: block;
}

.summary-content span {
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
}

.summary-content strong {
  display: block;
  margin: 4px 0 3px;
  color: #172033;
  font-size: 26px;
  line-height: 1;
}

.summary-content small {
  color: #94a3b8;
  font-size: 10px;
}

/* OVERVIEW */

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.dashboard-card,
.team-members-card,
.selected-detail {
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 7px rgba(15, 23, 42, .045);
}

.dashboard-card {
  min-width: 0;
  height: 220px;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  margin-bottom: 6px;
}

.card-heading > div:first-child {
  min-width: 0;
}

.card-heading h3,
.members-header h3,
.detail-header h3 {
  margin: 0;
  color: #172033;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 700;
}

.card-heading p,
.members-header p,
.detail-header p {
  margin: 4px 0 0;
  color: #8a94a6;
  font-size: 11px;
  line-height: 1.35;
}

.percentage-pill,
.overview-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 30px;
  padding: 0 8px;
  border-radius: 7px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
}

.purple-count {
  background: #f3e8ff;
  color: #7c3aed;
}

/* ATTENDANCE */

.attendance-card {
  display: grid !important;
  grid-template-rows: auto 1fr !important;
  align-items: stretch !important;
  width: 100% !important;
  align-self: stretch !important;
}

.attendance-card .attendance-overview {
  display: grid !important;
  grid-template-columns: 96px minmax(0, 1fr) !important;
  align-items: center !important;
  gap: 12px;
  width: 100%;
  height: 130px;
  margin: 0;
  box-sizing: border-box;
}

.attendance-card .attendance-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 104px !important;
  height: 104px !important;
  margin: 0;
  border-radius: 50%;
  background:
    conic-gradient(
      #22c55e 0 calc(var(--present-pct) * 1%),
      #ef4444 0 calc(
        (var(--present-pct) + var(--absent-pct)) * 1%
      ),
      #8b5cf6 0 calc(
        (var(--present-pct) + var(--absent-pct) + var(--leave-pct)) * 1%
      ),
      #f59e0b 0 calc(
        (var(--present-pct) + var(--absent-pct) + var(--leave-pct) + var(--half-pct)) * 1%
      ),
      #e5e7eb 0 100%
    );
}

.attendance-card .attendance-ring::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 50%;
  background: #fff;
}

.attendance-card .ring-value {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.attendance-card .ring-value strong {
  color: #172033;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.attendance-card .ring-value span {
  margin-top: 4px;
  color: #64748b;
  font-size: 8px;
  line-height: 1;
  white-space: nowrap;
}

.attendance-card .legend-list {
  display: flex !important;
  flex-direction: column;
  gap: 0;
  width: 100%;
  min-width: 0;
  padding: 0 !important;
}

.attendance-card .legend-item {
  display: grid !important;
  grid-template-columns: 8px minmax(0, 1fr) 20px 30px !important;
  align-items: center !important;
  min-width: 0;
  min-height: 25px;
  padding: 0 !important;
  column-gap: 5px;
}

.attendance-card .legend-item > span:nth-child(2) {
  min-width: 0;
  color: #64748b;
  font-size: 10px;
  font-weight: 500;
}

.attendance-card .legend-item strong {
  color: #172033;
  font-size: 10px;
  font-weight: 600;
  text-align: right;
}

.attendance-card .legend-item small {
  color: #64748b;
  font-size: 9px;
  text-align: right;
}

/* TIMESHEET */

.timesheet-overview {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 130px;
}

.timesheet-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background:
    conic-gradient(
      #2563eb calc(var(--completion, 0) * 1%),
      #e8eef8 0
    );
}

.timesheet-ring::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 50%;
  background: #fff;
}

.timesheet-ring .ring-value {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: auto;
  text-align: center;
}

.timesheet-ring .ring-value strong {
  display: block;
  margin: 0;
  font-size: 18px;
  line-height: 1;
}

.timesheet-ring .ring-value span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 8px;
  line-height: 1;
  white-space: nowrap;
}

.timesheet-status-list {
  width: 100%;
  min-width: 0;
}

.timesheet-status-list > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: 29px;
  padding: 4px 0;
  border-bottom: 1px solid #f0f2f6;
  color: #64748b;
  font-size: 10px;
}

.timesheet-status-list > div:last-child {
  border-bottom: 0;
}

.timesheet-status-list > div strong {
  min-width: 20px;
  text-align: right;
  font-size: 11px;
}

.status-green {
  color: #16a34a !important;
}

.status-amber {
  color: #d97706 !important;
}

.status-red {
  color: #dc2626 !important;
}

/* LEAVE */

.leave-overview {
  display: flex;
  align-items: center;
  min-height: 130px;
  margin: 0;
}

.leave-bars {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.leave-bar-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  font-size: 10px;
}

.leave-bar-row > span {
  color: #64748b;
  white-space: nowrap;
}

.leave-bar-row > strong {
  color: #172033;
  font-size: 11px;
  text-align: right;
}

.leave-bar-track {
  width: 100%;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf0f4;
}

.leave-bar-fill {
  height: 100%;
  min-width: 0;
  border-radius: 999px;
  transition: width .2s ease;
}

.purple-fill {
  background: #8b5cf6;
}

.amber-fill {
  background: #f59e0b;
}

.green-fill {
  background: #22c55e;
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 130px;
  color: #94a3b8;
  font-size: 11px;
  text-align: center;
}

/* TEAM MEMBERS */

.team-members-card {
  padding: 18px;
  box-sizing: border-box;
}

.members-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.members-header > div:first-child {
  min-width: 0;
}

.members-header h3 {
  margin: 0;
  color: #172033;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 700;
}

.members-header p {
  margin: 5px 0 0;
  color: #8a94a6;
  font-size: 11px;
  line-height: 1.35;
}

.members-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: #f1f3f7;
  flex-shrink: 0;
}

.members-actions button {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.members-actions button:hover,
.members-actions button.active {
  background: #fff;
  color: #4338ca;
  box-shadow: 0 1px 4px rgba(15, 23, 42, .08);
}

/* SEARCH / FILTER */

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 275px;
  height: 34px;
  padding: 0 10px;
  box-sizing: border-box;
  border: 1px solid #dfe4ec;
  border-radius: 7px;
  background: #fff;
}

.search-box span {
  color: #94a3b8;
  font-size: 15px;
  line-height: 1;
}

.search-box input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #334155;
  font-size: 11px;
}

.search-box input::placeholder {
  color: #9aa3b2;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.toolbar-actions button {
  height: 34px;
  padding: 0 13px;
  border: 1px solid #dfe4ec;
  border-radius: 7px;
  background: #fff;
  color: #475569;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.toolbar-actions button:hover {
  background: #f8fafc;
}

/* TABLE */

.table-container {
  width: 100%;
  overflow-x: auto;
}

.members-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.members-table th,
.members-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #edf0f4;
  text-align: left;
  vertical-align: middle;
}

.members-table th {
  background: #fafbfc;
  color: #7b8494;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.members-table td {
  height: 58px;
  color: #475569;
  font-size: 11px;
}

.members-table th:nth-child(1),
.members-table td:nth-child(1) {
  width: 29%;
}

.members-table th:nth-child(2),
.members-table td:nth-child(2) {
  width: 15%;
}

.members-table th:nth-child(3),
.members-table td:nth-child(3) {
  width: 13%;
}

.members-table th:nth-child(4),
.members-table td:nth-child(4) {
  width: 30%;
}

.members-table th:nth-child(5),
.members-table td:nth-child(5) {
  width: 13%;
}

.members-table tbody tr:hover {
  background: #fafbff;
}

/* EMPLOYEE */

.employee-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
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
  font-size: 11px;
  font-weight: 700;
}

.employee-cell > div:last-child {
  min-width: 0;
}

.employee-name {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: #334155;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.employee-name:hover {
  color: #4f46e5;
}

.employee-cell span {
  display: block;
  margin-top: 2px;
  color: #9aa3b2;
  font-size: 9px;
}

/* STATUS */

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 99px;
  background: #eef2f7;
  color: #64748b;
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.status-badge.present,
.status-badge.approved,
.status-badge.available {
  background: #dcfce7;
  color: #166534;
}

.status-badge.absent,
.status-badge.rejected {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.on-leave {
  background: #ede9fe;
  color: #6d28d9;
}

.status-badge.half-day {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.not-marked {
  background: #f1f5f9;
  color: #64748b;
}

.table-number {
  color: #334155;
  font-weight: 600;
}

/* LEAVE BALANCE */

.balance-cell {
  min-width: 0;
}

.balance-cell > div {
  margin-bottom: 6px;
}

.balance-cell > div:last-child {
  margin-bottom: 0;
}

.balance-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 3px;
  color: #64748b;
  font-size: 9px;
}

.balance-line strong {
  color: #334155;
  font-weight: 600;
}

.balance-bar {
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: #e8ebf0;
}

.balance-bar div {
  height: 100%;
  border-radius: 99px;
  background: #6366f1;
}

.muted-text {
  color: #9aa3b2;
  font-size: 10px;
}

/* ACTION */

.view-button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #dce2ec;
  border-radius: 6px;
  background: #fff;
  color: #4f46e5;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.view-button:hover {
  background: #eef2ff;
}

.empty-table {
  padding: 30px !important;
  color: #94a3b8 !important;
  text-align: center !important;
}

/* SELECTED DETAILS */

.selected-detail {
  margin-top: 20px;
  padding: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
  margin-bottom: 15px;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.primary-action,
.close-action {
  height: 36px;
  padding: 0 13px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.primary-action {
  border: 0;
  background: #4f46e5;
  color: #fff;
}

.primary-action:hover {
  background: #4338ca;
}

.close-action {
  border: 1px solid #dce2ec;
  background: #fff;
  color: #475569;
}

.detail-list {
  border-top: 1px solid #edf0f4;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  padding: 13px 4px;
  border-bottom: 1px solid #edf0f4;
  cursor: pointer;
}

.detail-row:hover {
  background: #fafbff;
}

.detail-row strong,
.detail-row span {
  display: block;
}

.detail-row strong {
  color: #334155;
  font-size: 12px;
}

.detail-row div span {
  margin-top: 3px;
  color: #8a94a6;
  font-size: 11px;
}




</style>
