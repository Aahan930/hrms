<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../api'
import { useHrData } from '../composables/useHrData'
import PayrollRunModal from '../components/hr/PayrollRunModal.vue'

const router = useRouter()
const hr = useHrData()
const { employees, attendance, notMarked } = hr

const email = localStorage.getItem('user')
const today = hr.today()
const monthKey = today.slice(0, 7)
const monthStart = `${monthKey}-01`
const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' })
const weekEndDate = new Date()
weekEndDate.setDate(weekEndDate.getDate() + 6)
const weekEnd = weekEndDate.toLocaleDateString('en-CA')

const todayLabel = new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', weekday: 'short'
})

const draftTimesheets = ref(0)
const draftExpenses = ref(0)
const loading = ref(true)
const actionError = ref('')
const error = computed(() => actionError.value || hr.error.value)
const success = ref('')
const busy = ref('')
const selected = ref(null)
const showPayroll = ref(false)

/* ---------- icons (one consistent line-icon set, replaces emojis) ---------- */
const icons = {
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'
}

/* ---------- quick actions: one style, primary action first ---------- */
const quickActions = [
  { label: 'Add New Employee', icon: 'plus', path: '/hr/employees?new=1', primary: true },
  { label: 'Employee Directory', icon: 'users', path: '/hr/employees' },
  { label: 'Run Payroll', icon: 'dollar', action: 'payroll' },
  { label: 'Reports & Export', icon: 'chart', path: '/hr/reports' }
]
function onQuick(q) {
  if (q.action === 'payroll') showPayroll.value = true
  else router.push(q.path)
}

/* ---------- "View all" targets: ONE place to change them ----------
   panel = opens the detail panel on this page, path = navigates.
   Adjust the paths once you confirm your router. */
const moreTargets = {
  attendance: { panel: 'present' },
  approvals: { panel: 'pending' },
  headcount: { panel: 'all' },
  joiners: { panel: 'joiners' },
  department: { path: '/hr/employees' },
  leaveTaken: { path: '/hr-tasks' },
  compliance: { path: '/hr-tasks' },
  upcomingLeaves: { path: '/hr-tasks' },
  onboarding: { path: '/hr-tasks' },
  offboarding: { path: '/hr-tasks' },
  documents: { path: '/hr-tasks' },
  milestones: { path: '/hr/employees' }
}
function more(key) {
  const t = moreTargets[key]
  if (!t) return
  if (t.panel) pick(t.panel)
  else router.push(t.path)
}

const open = (id) => id && router.push(`/hr/employee/${id}`)
const initials = (n = '') => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
const total = computed(() => employees.value.length)
const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
/* "Engineering - TC" -> "Engineering" */
const deptLabel = (d) => (d || '').replace(/\s-\s[A-Za-z0-9]{1,6}$/, '')

function abbr(type = '') {
  const w = type.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean)
  return w.length > 1 ? w.map((x) => x[0]).join('').toUpperCase().slice(0, 4) : (w[0] || '').slice(0, 4).toUpperCase()
}
function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtStr(s) {
  return s ? fmtDate(new Date(s.slice(0, 10) + 'T00:00:00')) : '—'
}

/* ---------- onboarding / offboarding / documents (from shared data) ---------- */
const obTone = (s) => (s === 'Completed' ? 'g' : s === 'In Process' ? 'b' : 'o')
const mapOb = (o) => ({
  name: o.employee_name || o.name,
  position: o.designation || '—',
  date: fmtStr(o.date_of_joining),
  status: o.boarding_status || 'Pending',
  tone: obTone(o.boarding_status)
})
const onboarding = computed(() => hr.onboardingOpen.value.slice(0, 4).map(mapOb))
const onboardingSummary = computed(() => ({
  inProgress: hr.onboardingOpen.value.length,
  completed: hr.onboardingDone.value.length
}))
const offboarding = computed(() =>
  hr.offboarding.value.slice(0, 4).map((s) => ({
    name: s.name,
    lastDay: fmtStr(s.lastDay),
    tasks: `${s.tasks} task${s.tasks === 1 ? '' : 's'}`,
    status: s.status,
    tone: s.status === 'In Process' ? 'b' : 'o'
  }))
)
const docQueue = computed(() =>
  hr.pendingDocuments.value.slice(0, 4).map((d) => ({
    name: d.employee, doc: d.document, date: fmtStr(d.uploaded), status: d.status
  }))
)

/* ---------- attendance ---------- */
const presentList = computed(() => attendance.value.filter((a) => ['Present', 'Half Day'].includes(a.status)))
const absentList = computed(() => attendance.value.filter((a) => a.status === 'Absent'))
const onLeaveList = computed(() => attendance.value.filter((a) => a.status === 'On Leave'))
const presentPct = computed(() => pctOf(presentList.value.length, total.value))

/* ---------- leaves ---------- */
const pending = hr.pendingLeaves
const thisWeek = computed(() =>
  hr.approvedLeaves.value.filter((l) => l.from_date <= weekEnd && l.to_date >= today)
)

/* one hue (indigo) for leave types so it never clashes with status colors */
const leaveColors = { CL: '#4f46e5', SL: '#6366f1', EL: '#818cf8', CO: '#a5b4fc', CF: '#3730a3' }
const DAY = 86400000
const toD = (s) => new Date(s.slice(0, 10) + 'T00:00:00')
const CHART_H = 100

/* days taken from the 1st of this month up to TODAY only (future days are not "taken") */
function takenThisMonth(l) {
  const from = toD(l.from_date)
  const to = toD(l.to_date || l.from_date)
  const a = from > toD(monthStart) ? from : toD(monthStart)
  const b = to < toD(today) ? to : toD(today)
  if (b < a) return 0
  const span = Math.round((to - from) / DAY) + 1
  const inside = Math.round((b - a) / DAY) + 1
  return Math.round(((Number(l.total_leave_days) || 0) * inside) / span * 2) / 2
}

const leaveUsage = computed(() => {
  const counts = {}
  hr.approvedLeaves.value.forEach((l) => {
    const d = takenThisMonth(l)
    if (!d) return
    const t = l.leave_type || 'Other'
    counts[t] = (counts[t] || 0) + d
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 4)
  const rest = sorted.slice(4).reduce((s, [, d]) => s + d, 0)
  if (rest) top.push(['Others', rest])
  return top.map(([type, days]) => ({
    type,
    days,
    key: type === 'Others' ? 'Others' : abbr(type),
    color: type === 'Others' ? '#cbd5e1' : leaveColors[abbr(type)] || '#6366f1'
  }))
})
const leaveTop = computed(() => {
  const max = Math.max(1, ...leaveUsage.value.map((i) => i.days))
  return Math.max(4, Math.ceil(max / 2) * 2)
})
const leaveTicks = computed(() => [leaveTop.value, leaveTop.value / 2, 0])

/* ---------- headcount / joiners ---------- */
const palette = ['#4f46e5', '#0891b2', '#7c3aed', '#db2777', '#0d9488', '#94a3b8']
const byDept = computed(() => {
  const m = {}
  employees.value.forEach((e) => {
    const d = deptLabel(e.department) || 'No department'
    m[d] = (m[d] || 0) + 1
  })
  const sorted = Object.entries(m).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 5)
  const rest = sorted.slice(5).reduce((s, [, n]) => s + n, 0)
  if (rest) top.push(['Others', rest])
  return top.map(([name, n], i) => ({ name, n, color: palette[i % palette.length] }))
})
const deptCount = computed(
  () => new Set(employees.value.map((e) => deptLabel(e.department) || 'No department')).size
)
const deptGradient = computed(() => {
  if (!total.value) return '#e5e7eb'
  let acc = 0
  const parts = byDept.value.map((d) => {
    const a = (acc / total.value) * 100
    acc += d.n
    return `${d.color} ${a}% ${(acc / total.value) * 100}%`
  })
  return `conic-gradient(${parts.join(',')})`
})

const contractors = computed(
  () => employees.value.filter((e) => /contract|freelanc/i.test(e.employment_type || '')).length
)
const newJoiners = computed(() =>
  employees.value.filter((e) => (e.date_of_joining || '').slice(0, 7) === monthKey)
)

/* ---------- milestones ---------- */
function nextOccur(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const now = new Date(today + 'T00:00:00')
  let n = new Date(now.getFullYear(), m - 1, d)
  if (n < now) n = new Date(now.getFullYear() + 1, m - 1, d)
  return { date: n, days: Math.round((n - now) / DAY), years: n.getFullYear() - y }
}
const milestones = computed(() => {
  const list = []
  employees.value.forEach((e) => {
    if (e.date_of_birth) {
      const o = nextOccur(e.date_of_birth)
      list.push({ name: e.employee_name, emp: e.name, kind: 'Birthday', icon: 'gift', tone: 'r', ...o })
    }
    if (e.date_of_joining) {
      const o = nextOccur(e.date_of_joining)
      if (o.years >= 1)
        list.push({
          name: e.employee_name, emp: e.name,
          kind: `Work Anniversary (${o.years} year${o.years > 1 ? 's' : ''})`,
          icon: 'award', tone: 'p', ...o
        })
    }
  })
  return list.filter((m) => m.days <= 30).sort((a, b) => a.days - b.days).slice(0, 4)
})

/* ---------- compliance alerts: same source as HR Tasks ---------- */
const compliance = computed(() => hr.alerts.value)

/* ---------- stat cards: ONE template, driven by data ---------- */
const approvalsTotal = computed(() => pending.value.length + draftTimesheets.value + draftExpenses.value)
const stats = computed(() => [
  {
    key: 'attendance', label: "Today's Attendance", icon: 'calendar', tone: 'green',
    value: presentPct.value + '%',
    ctx: `${presentList.value.length} of ${total.value} employees present`,
    rows: [
      { label: 'Present', n: presentList.value.length, dot: 'g', panel: 'present' },
      { label: 'Absent', n: absentList.value.length, dot: 'r', panel: 'absent' },
      { label: 'On leave', n: onLeaveList.value.length, dot: 'o', panel: 'leave' },
      { label: 'Not marked yet', n: notMarked.value.length, dot: 'b', panel: 'notmarked' }
    ]
  },
  {
    key: 'approvals', label: 'Pending Approvals', icon: 'check', tone: 'red',
    value: approvalsTotal.value,
    ctx: approvalsTotal.value ? 'waiting for your review' : 'nothing waiting for review',
    rows: [
      { label: 'Leave requests', n: pending.value.length, dot: 'n', panel: 'pending' },
      { label: 'Timesheets', n: draftTimesheets.value, dot: 'n' },
      { label: 'Expense claims', n: draftExpenses.value, dot: 'n' }
    ]
  },
  {
    key: 'headcount', label: 'Active Headcount', icon: 'users', tone: 'blue',
    value: total.value,
    ctx: `across ${plural(deptCount.value, 'department')}`,
    rows: [
      { label: 'Employees', n: total.value - contractors.value, dot: 'n', panel: 'all' },
      { label: 'Contractors / Freelancers', n: contractors.value, dot: 'n' },
      { label: 'Departments', n: deptCount.value, dot: 'n' }
    ]
  },
  {
    key: 'joiners', label: 'New Joiners', icon: 'userplus', tone: 'purple',
    value: newJoiners.value.length,
    ctx: `joined in ${monthName}`,
    rows: [
      { label: 'Onboarding in progress', n: onboardingSummary.value.inProgress, dot: 'n' },
      { label: 'Onboarding completed', n: onboardingSummary.value.completed, dot: 'n' }
    ]
  }
])

/* ---------- "Needs your attention": the first thing a new user should see ---------- */
const attention = computed(() => {
  const a = []
  if (approvalsTotal.value)
    a.push({ key: 'approvals', tone: 'r', label: plural(approvalsTotal.value, 'pending approval'), act: () => pick('pending') })
  if (notMarked.value.length)
    a.push({ key: 'att', tone: 'o', label: `${plural(notMarked.value.length, 'employee')} without attendance today`, act: () => pick('notmarked') })
  if (compliance.value.length)
    a.push({ key: 'comp', tone: 'o', label: plural(compliance.value.length, 'compliance alert'), act: () => more('compliance') })
  return a
})

/* ---------- permissions ---------- */
const approverUsers = computed(() => new Set(employees.value.map((e) => e.leave_approver).filter(Boolean)))
const managerEmps = computed(
  () => new Set(employees.value.filter((e) => e.user_id && approverUsers.value.has(e.user_id)).map((e) => e.name))
)
const ownEmp = computed(() => employees.value.find((e) => e.user_id === email)?.name)
function canAct(l) {
  return managerEmps.value.has(l.employee) && l.employee !== ownEmp.value && l.owner !== email
}

/* ---------- detail panel ---------- */
const mkRow = (o) => ({ key: '', emp: '', title: '', sub: '', tag: '', leave: null, ...o })

const detail = computed(() => {
  const base = { title: '', empty: '', rows: [], action: false }
  const deptSub = (e) => `${e.name} · ${deptLabel(e.department) || 'No department'}`
  switch (selected.value) {
    case 'all':
      return { ...base, title: 'All employees', empty: 'No employees.',
        rows: employees.value.map((e) => mkRow({ key: e.name, emp: e.name, title: e.employee_name, sub: deptSub(e) })) }
    case 'present':
      return { ...base, title: 'Present today', empty: 'Nobody is marked present yet.',
        rows: presentList.value.map((a) => mkRow({ key: a.employee, emp: a.employee, title: a.employee_name, sub: a.employee, tag: a.status })) }
    case 'absent':
      return { ...base, title: 'Absent today', empty: 'Nobody is marked absent.',
        rows: absentList.value.map((a) => mkRow({ key: a.employee, emp: a.employee, title: a.employee_name, sub: a.employee, tag: 'Absent' })) }
    case 'leave':
      return { ...base, title: 'On leave today', empty: 'Nobody is on leave today.',
        rows: onLeaveList.value.map((a) => mkRow({ key: a.employee, emp: a.employee, title: a.employee_name, sub: a.employee, tag: 'On Leave' })) }
    case 'notmarked':
      return { ...base, title: 'No attendance record today', empty: 'Everyone is marked for today.', action: true,
        rows: notMarked.value.map((e) => mkRow({ key: e.name, emp: e.name, title: e.employee_name, sub: deptSub(e), tag: 'Not marked' })) }
    case 'pending':
      return { ...base, title: 'Pending leave requests', empty: 'No pending requests.',
        rows: pending.value.map((l) => mkRow({
          key: l.name, emp: l.employee, title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date} · ${l.total_leave_days} day(s) · Approver: ${l.leave_approver || 'none set'}`,
          tag: 'Pending', leave: l
        })) }
    case 'joiners':
      return { ...base, title: 'New joiners this month', empty: 'No new joiners this month.',
        rows: newJoiners.value.map((e) => mkRow({ key: e.name, emp: e.name, title: e.employee_name, sub: `${e.name} · Joined ${e.date_of_joining}` })) }
    default:
      return null
  }
})

function pick(name) {
  selected.value = selected.value === name ? null : name
}
function goAlert(c) {
  if (c.tab) router.push({ path: '/hr-tasks', query: { tab: c.tab } })
}

/* ---------- actions ---------- */
async function act(l, action) {
  actionError.value = ''
  success.value = ''
  busy.value = l.name
  try {
    const doc = (await api.get(`/api/resource/Leave Application/${l.name}`)).data.data
    await api.post('/api/method/frappe.model.workflow.apply_workflow', {
      doc: JSON.stringify(doc),
      action
    })
    success.value = `${l.employee_name}: ${action} done`
    await hr.refresh({ silent: true })
  } catch (e) {
    actionError.value = errMsg(e, `Could not ${action.toLowerCase()}`)
  }
  busy.value = ''
}

async function loadDraftCounts() {
  const count = async (doctype) => {
    try {
      const r = await api.get(`/api/resource/${doctype}`, {
        params: { filters: JSON.stringify([['docstatus', '=', 0]]), fields: JSON.stringify(['name']), limit_page_length: 500 }
      })
      return r.data.data.length
    } catch {
      return 0
    }
  }
  draftTimesheets.value = await count('Timesheet')
  draftExpenses.value = await count('Expense Claim')
}

watch(() => hr.authFailed.value, (v) => {
  if (v) {
    localStorage.removeItem('user')
    router.push('/login')
  }
})

onMounted(async () => {
  await Promise.all([hr.refresh({ silent: hr.loaded.value }), loadDraftCounts()])
  loading.value = false
})
</script>

<template>
  <div class="hd-page">
    <!-- HEADER: title, date, then ONE row of quick actions -->
    <div class="hd-header">
      <div>
        <h2>HR Dashboard</h2>
        <p>Overview of your organization's people, processes and key HR activities.</p>
      </div>
      <div class="hd-date">
        <small>Today</small>
        <span>{{ todayLabel }}</span>
      </div>
    </div>

    <div class="hd-actions">
      <button
        v-for="q in quickActions"
        :key="q.label"
        type="button"
        class="hd-action"
        :class="{ primary: q.primary }"
        @click="onQuick(q)"
      >
        <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons[q.icon]"></svg>
        {{ q.label }}
      </button>
    </div>

    <p v-if="error" class="hd-err">{{ error }}</p>
    <p v-if="success" class="hd-ok">{{ success }}</p>
    <p v-if="loading" class="hd-muted">Loading...</p>

    <template v-else>
      <!-- NEEDS YOUR ATTENTION -->
      <section class="hd-attn" :class="{ ok: !attention.length }">
        <template v-if="attention.length">
          <span class="hd-attn-title">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.alert"></svg>
            Needs your attention
          </span>
          <button
            v-for="a in attention"
            :key="a.key"
            type="button"
            class="hd-attn-chip"
            :class="a.tone"
            @click="a.act()"
          >{{ a.label }} →</button>
        </template>
        <span v-else class="hd-attn-title">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.shield"></svg>
          You're all caught up. Nothing needs your attention right now.
        </span>
      </section>

      <!-- STAT CARDS (4 x 3 columns, identical structure) -->
      <section class="hd-stats">
        <article v-for="s in stats" :key="s.key" class="hd-card hd-stat">
          <header class="hd-head">
            <span class="hd-ico" :class="s.tone">
              <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons[s.icon]"></svg>
            </span>
            <h3 class="hd-title">{{ s.label }}</h3>
            <button type="button" class="hd-more" @click="more(s.key)">View all →</button>
          </header>
          <div class="hd-value">{{ s.value }}</div>
          <p class="hd-ctx">{{ s.ctx }}</p>
          <ul class="hd-rows">
            <li
              v-for="r in s.rows"
              :key="r.label"
              class="hd-rowline"
              :class="{ click: r.panel }"
              @click="r.panel && pick(r.panel)"
            >
              <i class="dot" :class="r.dot"></i>
              <span class="l">{{ r.label }}</span>
              <b>{{ r.n }}</b>
            </li>
          </ul>
        </article>
      </section>

      <!-- DETAIL PANEL -->
      <section v-if="detail" class="hd-card hd-detail">
        <header class="hd-head">
          <h3 class="hd-title">{{ detail.title }}</h3>
          <div class="hd-acts">
            <button v-if="detail.action" type="button" class="hd-btn" @click="router.push('/mark-attendance')">Mark attendance</button>
            <button type="button" class="hd-btn ghost" @click="selected = null">Close</button>
          </div>
        </header>
        <p v-if="!detail.rows.length" class="hd-muted">{{ detail.empty }}</p>
        <div v-for="r in detail.rows" :key="r.key" class="hd-row link" @click="open(r.emp)">
          <div>
            <b>{{ r.title }}</b>
            <div class="hd-sub">{{ r.sub }}</div>
          </div>
          <div class="hd-acts" @click.stop>
            <template v-if="r.leave && canAct(r.leave)">
              <button type="button" class="hd-btn" :disabled="busy === r.leave.name" @click="act(r.leave, 'Approve')">Approve</button>
              <button type="button" class="hd-btn bad" :disabled="busy === r.leave.name" @click="act(r.leave, 'Reject')">Reject</button>
            </template>
            <span v-else-if="r.tag" class="hd-chip o">{{ r.tag }}</span>
          </div>
        </div>
      </section>

      <!-- ALL CONTENT CARDS: 2 per row, equal height, same header -->
      <section class="hd-grid">
        <!-- Department Headcount -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Department Headcount</h3>
            <button type="button" class="hd-more" @click="more('department')">View all →</button>
          </header>
          <div v-if="!total" class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.inbox"></svg>
            <p>No employees yet.</p>
          </div>
          <div v-else class="hd-donut-wrap">
            <div class="hd-donut" :style="{ background: deptGradient }">
              <div class="hd-hole"><strong>{{ total }}</strong><span>Employees</span></div>
            </div>
            <ul class="hd-legend">
              <li v-for="d in byDept" :key="d.name">
                <i :style="{ background: d.color }"></i>
                <span class="n">{{ d.name }}</span>
                <b>{{ d.n }} ({{ pctOf(d.n, total) }}%)</b>
              </li>
            </ul>
          </div>
        </article>

        <!-- Leave Taken -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Leave Taken (This Month, so far)</h3>
            <button type="button" class="hd-more" @click="more('leaveTaken')">View all →</button>
          </header>
          <div v-if="leaveUsage.length" class="hd-chart">
            <div class="hd-axis"><span v-for="t in leaveTicks" :key="t">{{ t }}</span></div>
            <div class="hd-plot">
              <div class="hd-gridlines"><i v-for="t in leaveTicks" :key="t"></i></div>
              <div class="hd-bars">
                <div v-for="b in leaveUsage" :key="b.type" class="hd-col" :title="b.type + ': ' + b.days + ' day(s)'">
                  <span class="v">{{ b.days }}</span>
                  <div class="b" :style="{ height: (b.days / leaveTop) * CHART_H + 'px', background: b.color }"></div>
                  <span class="k">{{ b.key }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.calendar"></svg>
            <p>No approved leave taken so far this month.</p>
          </div>
        </article>

        <!-- Compliance Alerts -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Compliance Alerts</h3>
            <button type="button" class="hd-more" @click="more('compliance')">View all →</button>
          </header>
          <div v-if="!compliance.length" class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.shield"></svg>
            <p>All clear. No alerts right now.</p>
          </div>
          <div
            v-for="c in compliance"
            :key="c.key"
            class="hd-alert"
            :class="[c.tone, { click: c.tab }]"
            @click="goAlert(c)"
          >
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.alert"></svg>
            <div><b>{{ c.title }}</b><small>{{ c.sub }}</small></div>
          </div>
        </article>

        <!-- Upcoming Leaves -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Upcoming Leaves (Next 7 Days)</h3>
            <button type="button" class="hd-more" @click="more('upcomingLeaves')">View all →</button>
          </header>
          <div v-if="!thisWeek.length" class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.calendar"></svg>
            <p>Nobody has approved leave this week.</p>
          </div>
          <table v-else class="hd-table">
            <thead><tr><th>Employee</th><th>Leave Type</th><th>Dates</th><th>Duration</th></tr></thead>
            <tbody>
              <tr v-for="l in thisWeek" :key="l.name" class="clickable" @click="open(l.employee)">
                <td><div class="hd-person"><span class="av">{{ initials(l.employee_name) }}</span>{{ l.employee_name }}</div></td>
                <td class="m">{{ l.leave_type }}</td>
                <td class="m">{{ fmtStr(l.from_date) }}<template v-if="l.to_date !== l.from_date"> – {{ fmtStr(l.to_date) }}</template></td>
                <td class="m">{{ l.total_leave_days }} day{{ l.total_leave_days > 1 ? 's' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <!-- Onboarding Pipeline -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Onboarding Pipeline</h3>
            <button type="button" class="hd-more" @click="more('onboarding')">View all →</button>
          </header>
          <div v-if="!onboarding.length" class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.userplus"></svg>
            <p>No employees are being onboarded.</p>
          </div>
          <table v-else class="hd-table">
            <thead><tr><th>Name</th><th>Position</th><th>Joining Date</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="o in onboarding" :key="o.name + o.date">
                <td><div class="hd-person"><span class="av">{{ initials(o.name) }}</span>{{ o.name }}</div></td>
                <td class="m">{{ o.position }}</td>
                <td class="m">{{ o.date }}</td>
                <td><span class="hd-chip" :class="o.tone">{{ o.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </article>

        <!-- Offboarding Tasks -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Offboarding Tasks</h3>
            <button type="button" class="hd-more" @click="more('offboarding')">View all →</button>
          </header>
          <div v-if="!offboarding.length" class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.inbox"></svg>
            <p>No open separations.</p>
          </div>
          <table v-else class="hd-table">
            <thead><tr><th>Employee</th><th>Last Working Day</th><th>Tasks</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="o in offboarding" :key="o.name + o.lastDay">
                <td><div class="hd-person"><span class="av">{{ initials(o.name) }}</span>{{ o.name }}</div></td>
                <td class="m">{{ o.lastDay }}</td>
                <td class="m">{{ o.tasks }}</td>
                <td><span class="hd-chip" :class="o.tone">{{ o.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </article>

        <!-- Document Verification Queue -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Document Verification Queue</h3>
            <button type="button" class="hd-more" @click="more('documents')">View all →</button>
          </header>
          <div v-if="!docQueue.length" class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.check"></svg>
            <p>No documents waiting for review.</p>
          </div>
          <table v-else class="hd-table">
            <thead><tr><th>Employee</th><th>Document</th><th>Uploaded On</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="d in docQueue" :key="d.name + d.doc">
                <td><div class="hd-person"><span class="av">{{ initials(d.name) }}</span>{{ d.name }}</div></td>
                <td class="m">{{ d.doc }}</td>
                <td class="m">{{ d.date }}</td>
                <td><span class="hd-chip o">{{ d.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </article>

        <!-- Upcoming Milestones -->
        <article class="hd-card">
          <header class="hd-head">
            <h3 class="hd-title">Upcoming Milestones</h3>
            <button type="button" class="hd-more" @click="more('milestones')">View all →</button>
          </header>
          <div v-if="!milestones.length" class="hd-empty">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.gift"></svg>
            <p>No birthdays or anniversaries in the next 30 days.</p>
          </div>
          <div v-for="m in milestones" :key="m.emp + m.kind" class="hd-ms">
            <span class="ms-ic" :class="m.tone">
              <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons[m.icon]"></svg>
            </span>
            <div class="t">
              <b>{{ m.name }}</b>
              <small>{{ m.kind }}</small>
            </div>
            <div class="dt">
              <b>{{ fmtDate(m.date) }}</b>
              <small :class="m.tone">({{ m.days === 0 ? 'today' : m.days + ' day' + (m.days > 1 ? 's' : '') }})</small>
            </div>
          </div>
        </article>
      </section>
    </template>
    <PayrollRunModal v-if="showPayroll" @close="showPayroll = false" />
  </div>
</template>

<style scoped>
/* ===== Design tokens: change here, applies everywhere ===== */
.hd-page {
  --c-text: #172033;
  --c-muted: #64748b;
  --c-faint: #94a3b8;
  --c-border: #e6eaf0;
  --c-line: #eef1f5;
  --c-primary: #2563eb;
  --c-primary-soft: #eff6ff;
  /* status colors: used ONLY for status */
  --c-ok: #16a34a;     --c-ok-soft: #dcfce7;   --c-ok-text: #15803d;
  --c-warn: #f59e0b;   --c-warn-soft: #fef3c7; --c-warn-text: #b45309;
  --c-bad: #ef4444;    --c-bad-soft: #fee2e2;  --c-bad-text: #b91c1c;
  --gap: 16px;
  --pad: 20px;
  --radius: 12px;
  --fs-xs: 12px;   /* minimum text size */
  --fs-sm: 13px;   /* body, table cells, rows */
  --fs-title: 15px;/* every card title */
  --fs-big: 30px;  /* key numbers */

  width: 100%;
  padding: 24px 32px 40px;
  color: var(--c-text);
  font-size: var(--fs-sm);
}

.hd-page,
.hd-page * {
  box-sizing: border-box;
  text-align: left;
}

.svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ===== Header ===== */
.hd-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--gap);
  margin-bottom: 16px;
}
.hd-header h2 { margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2; }
.hd-header p { margin: 6px 0 0; color: var(--c-muted); font-size: var(--fs-sm); }

.hd-date {
  flex: 0 0 auto;
  padding: 8px 14px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fff;
}
.hd-date small { display: block; color: var(--c-faint); font-size: var(--fs-xs); }
.hd-date span { font-size: var(--fs-sm); font-weight: 600; white-space: nowrap; }

/* ===== Quick actions (one button style) ===== */
.hd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: var(--gap);
}
.hd-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: #fff;
  color: var(--c-text);
  font: inherit;
  font-size: var(--fs-sm);
  font-weight: 600;
  cursor: pointer;
}
.hd-action:hover { border-color: var(--c-primary); color: var(--c-primary); }
.hd-action.primary { border-color: var(--c-primary); background: var(--c-primary); color: #fff; }
.hd-action.primary:hover { filter: brightness(0.94); color: #fff; }

/* ===== Messages ===== */
.hd-err, .hd-ok {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: var(--fs-sm);
}
.hd-err { background: #fef2f2; color: var(--c-bad-text); }
.hd-ok { background: #f0fdf4; color: var(--c-ok-text); }
.hd-muted { color: var(--c-muted); font-size: var(--fs-sm); }

/* ===== Needs attention ===== */
.hd-attn {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  margin-bottom: var(--gap);
  padding: 12px 16px;
  border: 1px solid #fde68a;
  border-radius: var(--radius);
  background: #fffbeb;
}
.hd-attn.ok { border-color: #bbf7d0; background: #f0fdf4; }
.hd-attn-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
  font-size: 14px;
  font-weight: 700;
}
.hd-attn.ok .hd-attn-title { color: var(--c-ok-text); }
.hd-attn:not(.ok) .hd-attn-title { color: var(--c-warn-text); }
.hd-attn-chip {
  height: 30px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 99px;
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
}
.hd-attn-chip.r { background: var(--c-bad-soft); color: var(--c-bad-text); }
.hd-attn-chip.o { background: var(--c-warn-soft); color: var(--c-warn-text); }
.hd-attn-chip:hover { filter: brightness(0.96); }

/* ===== Card: the ONE card + header used everywhere ===== */
.hd-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--pad);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
}

.hd-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  margin-bottom: 14px;
}
.hd-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: var(--fs-title);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hd-more {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-primary);
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.hd-more:hover { text-decoration: underline; }

/* ===== Grids: only two layouts on the whole page ===== */
.hd-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--gap);
  margin-bottom: var(--gap);
}
.hd-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--gap);
  align-items: stretch;
}
.hd-grid .hd-card { min-height: 250px; }

/* ===== Stat card ===== */
.hd-ico {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
}
.hd-ico.green { background: var(--c-ok-soft); color: var(--c-ok-text); }
.hd-ico.red { background: var(--c-bad-soft); color: var(--c-bad-text); }
.hd-ico.blue { background: #dbeafe; color: #1d4ed8; }
.hd-ico.purple { background: #ede9fe; color: #6d28d9; }

.hd-stat .hd-head { margin-bottom: 8px; }
.hd-stat .hd-title { color: var(--c-muted); font-size: var(--fs-sm); font-weight: 600; }
.hd-value { font-size: var(--fs-big); font-weight: 700; line-height: 1.15; }
.hd-ctx { min-height: 18px; margin: 2px 0 0; color: var(--c-muted); font-size: var(--fs-xs); }

.hd-rows {
  min-height: 124px; /* room for 4 rows, so all four cards line up */
  margin: 14px 0 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--c-line);
  list-style: none;
}
.hd-rowline {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 4px;
  border-radius: 6px;
  color: #475569;
  font-size: var(--fs-sm);
}
.hd-rowline.click { cursor: pointer; }
.hd-rowline.click:hover { background: #f5f8ff; }
.hd-rowline .l { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hd-rowline b { color: var(--c-text); font-weight: 700; }

.dot { display: inline-block; flex: 0 0 8px; width: 8px; height: 8px; border-radius: 50%; }
.dot.g { background: var(--c-ok); }
.dot.r { background: var(--c-bad); }
.dot.o { background: var(--c-warn); }
.dot.b { background: var(--c-primary); }
.dot.n { background: #cbd5e1; }

/* ===== Empty state (same look in every card) ===== */
.hd-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0;
  color: var(--c-faint);
}
.hd-empty .svg { width: 28px; height: 28px; stroke-width: 1.6; }
.hd-empty p { margin: 0; color: var(--c-muted); font-size: var(--fs-sm); text-align: center !important; }

/* ===== Detail panel ===== */
.hd-detail { margin-bottom: var(--gap); border-color: #c7d2fe; }
.hd-acts { display: flex; align-items: center; gap: 8px; }

.hd-btn {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: var(--c-primary);
  color: #fff;
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
}
.hd-btn:disabled { opacity: 0.6; cursor: default; }
.hd-btn.ghost { background: #e5e7eb; color: #1f2937; }
.hd-btn.bad { background: #dc2626; }

.hd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 8px;
  border-bottom: 1px solid #f1f5f9;
  border-radius: 8px;
}
.hd-row:last-child { border-bottom: 0; }
.hd-row.link { cursor: pointer; }
.hd-row.link:hover { background: #f5f8ff; }
.hd-row b { font-size: var(--fs-sm); }
.hd-sub { margin-top: 2px; color: var(--c-muted); font-size: var(--fs-xs); }

/* ===== Donut ===== */
.hd-donut-wrap { display: flex; flex: 1; align-items: center; gap: 28px; }
.hd-donut {
  display: grid;
  place-items: center;
  flex: 0 0 150px;
  width: 150px;
  height: 150px;
  border-radius: 50%;
}
.hd-hole {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 108px;
  height: 108px;
  border-radius: 50%;
  background: #fff;
}
.hd-hole strong { font-size: 26px; font-weight: 800; line-height: 1; text-align: center !important; }
.hd-hole span { margin-top: 3px; color: var(--c-muted); font-size: var(--fs-xs); text-align: center !important; }

.hd-legend { flex: 1; min-width: 0; margin: 0; padding: 0; list-style: none; }
.hd-legend li {
  display: grid;
  grid-template-columns: 9px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  font-size: var(--fs-sm);
}
.hd-legend i { width: 9px; height: 9px; border-radius: 50%; }
.hd-legend .n { overflow: hidden; color: #475569; text-overflow: ellipsis; white-space: nowrap; }
.hd-legend b { font-weight: 600; white-space: nowrap; }

/* ===== Leave chart ===== */
.hd-chart { display: flex; flex: 1; align-items: flex-start; gap: 8px; padding-top: 8px; }
.hd-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 150px;
  color: var(--c-faint);
  font-size: var(--fs-xs);
  line-height: 1;
  text-align: right !important;
}
.hd-plot { position: relative; flex: 1; min-width: 0; padding-bottom: 26px; }
.hd-gridlines {
  position: absolute;
  top: 0; left: 0; right: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 150px;
  pointer-events: none;
}
.hd-gridlines i { display: block; height: 0; border-top: 1px dashed var(--c-border); }
.hd-bars { position: relative; display: flex; align-items: flex-end; justify-content: space-around; height: 150px; }
.hd-col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 150px;
  min-width: 40px;
}
.hd-col .b { width: 34px; min-height: 2px; border-radius: 4px 4px 0 0; }
.hd-col .v { margin-bottom: 3px; font-size: var(--fs-xs); font-weight: 600; text-align: center !important; }
.hd-col .k {
  position: absolute;
  bottom: -24px;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  white-space: nowrap;
  text-align: center !important;
}

/* ===== Tables ===== */
.hd-table { width: 100%; border-collapse: collapse; }
.hd-table th {
  padding: 8px 8px;
  background: #fafbfc;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
}
.hd-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--c-line);
  font-size: var(--fs-sm);
  vertical-align: middle;
}
.hd-table tr:last-child td { border-bottom: 0; }
.hd-table td.m { color: var(--c-muted); }
.hd-table tr.clickable { cursor: pointer; }
.hd-table tr.clickable:hover { background: #f8fafc; }

.hd-person { display: flex; align-items: center; gap: 8px; font-weight: 600; white-space: nowrap; }
.av {
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: var(--fs-xs);
  font-weight: 700;
}

/* status chips: green = done, blue = in progress, amber = pending */
.hd-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 6px;
  background: #f1f5f9;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  white-space: nowrap;
}
.hd-chip.g { background: var(--c-ok-soft); color: var(--c-ok-text); }
.hd-chip.o { background: var(--c-warn-soft); color: var(--c-warn-text); }
.hd-chip.b { background: #dbeafe; color: #1d4ed8; }

/* ===== Milestones ===== */
.hd-ms { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--c-line); }
.hd-ms:last-child { border-bottom: 0; }
.ms-ic {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 8px;
}
.ms-ic.r { background: var(--c-bad-soft); color: var(--c-bad-text); }
.ms-ic.p { background: #ede9fe; color: #6d28d9; }
.hd-ms .t { flex: 1; min-width: 0; }
.hd-ms b { display: block; font-size: var(--fs-sm); }
.hd-ms small { display: block; margin-top: 1px; color: var(--c-muted); font-size: var(--fs-xs); }
.hd-ms .dt, .hd-ms .dt b, .hd-ms .dt small { text-align: right !important; }
.hd-ms .dt small.r { color: var(--c-bad-text); }
.hd-ms .dt small.p { color: #6d28d9; }

/* ===== Compliance ===== */
.hd-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 10px 12px;
  border-radius: 8px;
}
.hd-alert:last-child { margin-bottom: 0; }
.hd-alert.click { cursor: pointer; }
.hd-alert.click:hover { filter: brightness(0.97); }
.hd-alert b { display: block; font-size: var(--fs-sm); }
.hd-alert small { display: block; margin-top: 1px; font-size: var(--fs-xs); opacity: 0.85; }
.hd-alert.r { background: #fef2f2; color: var(--c-bad-text); }
.hd-alert.o { background: #fffbeb; color: var(--c-warn-text); }

/* ===== Responsive ===== */
@media (max-width: 1350px) {
  .hd-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .hd-grid { grid-template-columns: 1fr; }
}
@media (max-width: 800px) {
  .hd-page { padding: 16px; }
  .hd-stats { grid-template-columns: 1fr; }
  .hd-header { flex-direction: column; }
  .hd-donut-wrap { flex-direction: column; align-items: flex-start; }
  .hd-card { overflow-x: auto; }
}
.hd-grid .hd-card { min-height: 0; }
</style>