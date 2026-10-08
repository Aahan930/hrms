<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { errMsg } from '../../api'

const route = useRoute()
const router = useRouter()
const today = new Date().toLocaleDateString('en-CA')

const from = ref(`${today.slice(0, 7)}-01`)
const to = ref(today)
const selected = ref('payroll')
const rows = ref([])
const ran = ref(false)
const loading = ref(false)
const error = ref('')

async function fetchAll(doctype, fields, filters, order) {
  const r = await api.get(`/api/resource/${doctype}`, {
    params: {
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      order_by: order,
      limit_page_length: 5000
    }
  })
  return r.data.data || []
}

const reports = [
  {
    key: 'payroll',
    title: 'Payroll Input',
    desc: 'Payable days per employee for the period. Feed this into your payroll run.',
    dates: true,
    columns: [
      { key: 'employee', label: 'Employee ID' },
      { key: 'employee_name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'present', label: 'Present' },
      { key: 'half', label: 'Half Day' },
      { key: 'leave', label: 'On Leave' },
      { key: 'wfh', label: 'WFH' },
      { key: 'absent', label: 'Absent' },
      { key: 'payable', label: 'Payable Days' }
    ],
    async compute(f, t) {
      const [emps, att] = await Promise.all([
        fetchAll('Employee', ['name', 'employee_name', 'department'], [['status', '=', 'Active']], 'employee_name asc'),
        fetchAll('Attendance', ['employee', 'status'], [
          ['attendance_date', '>=', f], ['attendance_date', '<=', t], ['docstatus', '=', 1]
        ], 'employee asc')
      ])
      const m = {}
      emps.forEach((e) => {
        m[e.name] = {
          employee: e.name, employee_name: e.employee_name, department: e.department || '',
          present: 0, half: 0, leave: 0, wfh: 0, absent: 0, payable: 0
        }
      })
      att.forEach((a) => {
        const r = m[a.employee]
        if (!r) return
        if (a.status === 'Present') r.present++
        else if (a.status === 'Half Day') r.half++
        else if (a.status === 'On Leave') r.leave++
        else if (a.status === 'Work From Home') r.wfh++
        else if (a.status === 'Absent') r.absent++
      })
      return Object.values(m).map((r) => ({
        ...r,
        payable: r.present + r.wfh + r.leave + r.half * 0.5
      }))
    }
  },
  {
    key: 'headcount',
    title: 'Headcount',
    desc: 'Every active employee with department, designation and joining date.',
    dates: false,
    columns: [
      { key: 'name', label: 'Employee ID' },
      { key: 'employee_name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'employment_type', label: 'Employment Type' },
      { key: 'date_of_joining', label: 'Date of Joining' }
    ],
    doctype: 'Employee',
    filters: () => [['status', '=', 'Active']],
    order: 'employee_name asc'
  },
  {
    key: 'attendance',
    title: 'Attendance',
    desc: 'Daily attendance records across the company.',
    dates: true,
    columns: [
      { key: 'attendance_date', label: 'Date' },
      { key: 'employee', label: 'Employee ID' },
      { key: 'employee_name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' }
    ],
    doctype: 'Attendance',
    filters: (f, t) => [['attendance_date', '>=', f], ['attendance_date', '<=', t], ['docstatus', '!=', 2]],
    order: 'attendance_date desc'
  },
  {
    key: 'leave',
    title: 'Leave',
    desc: 'Leave applications overlapping the period.',
    dates: true,
    columns: [
      { key: 'employee', label: 'Employee ID' },
      { key: 'employee_name', label: 'Name' },
      { key: 'leave_type', label: 'Leave Type' },
      { key: 'from_date', label: 'From' },
      { key: 'to_date', label: 'To' },
      { key: 'total_leave_days', label: 'Days' },
      { key: 'status', label: 'Status' }
    ],
    doctype: 'Leave Application',
    filters: (f, t) => [['from_date', '<=', t], ['to_date', '>=', f], ['docstatus', '!=', 2]],
    order: 'from_date desc'
  },
  {
    key: 'timesheet',
    title: 'Timesheets',
    desc: 'Timesheets and logged hours overlapping the period.',
    dates: true,
    columns: [
      { key: 'employee', label: 'Employee ID' },
      { key: 'employee_name', label: 'Name' },
      { key: 'start_date', label: 'Start' },
      { key: 'end_date', label: 'End' },
      { key: 'total_hours', label: 'Hours' },
      { key: 'status', label: 'Status' }
    ],
    doctype: 'Timesheet',
    filters: (f, t) => [['start_date', '<=', t], ['end_date', '>=', f], ['docstatus', '!=', 2]],
    order: 'start_date desc'
  }
]

const def = computed(() => reports.find((r) => r.key === selected.value))
const preview = computed(() => rows.value.slice(0, 200))

function choose(key) {
  selected.value = key
  rows.value = []
  ran.value = false
  error.value = ''
}

async function run() {
  error.value = ''
  loading.value = true
  rows.value = []
  try {
    const d = def.value
    if (d.compute) {
      rows.value = await d.compute(from.value, to.value)
    } else {
      rows.value = await fetchAll(d.doctype, d.columns.map((c) => c.key), d.filters(from.value, to.value), d.order)
    }
    ran.value = true
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      error.value = 'You do not have permission to read this report.'
    } else {
      error.value = errMsg(e, 'Could not run report')
    }
  }
  loading.value = false
}

function download() {
  const d = def.value
  const head = d.columns.map((c) => c.label)
  const lines = rows.value.map((r) =>
    d.columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const blob = new Blob(['\ufeff' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${d.key}-${d.dates ? from.value + '_to_' + to.value : today}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

onMounted(() => {
  const k = route.query.report
  if (k && reports.some((r) => r.key === k)) selected.value = k
})
</script>

<template>
  <div class="rp-page">
    <div class="rp-head">
      <div>
        <h2>Reports &amp; Export</h2>
        <p>Run a report for any period and download it for payroll, audits or management.</p>
      </div>
      <button type="button" class="rp-btn ghost" @click="router.push('/hr')">← HR Dashboard</button>
    </div>

    <section class="rp-tabs">
      <button
        v-for="r in reports"
        :key="r.key"
        type="button"
        class="rp-tab"
        :class="{ on: selected === r.key }"
        @click="choose(r.key)"
      >
        {{ r.title }}
      </button>
    </section>

    <section class="rp-card">
      <h3>{{ def.title }}</h3>
      <p class="rp-desc">{{ def.desc }}</p>

      <div class="rp-controls">
        <template v-if="def.dates">
          <label>From<input v-model="from" class="rp-input" type="date" /></label>
          <label>To<input v-model="to" class="rp-input" type="date" /></label>
        </template>
        <button type="button" class="rp-btn" :disabled="loading" @click="run">
          {{ loading ? 'Running...' : 'Run report' }}
        </button>
        <button v-if="ran && rows.length" type="button" class="rp-btn green" @click="download">
          ⬇ Download CSV
        </button>
      </div>

      <p v-if="error" class="rp-err">{{ error }}</p>
      <p v-if="selected === 'payroll'" class="rp-note">
        Payable Days = Present + WFH + On Leave + ½ × Half Day. Only submitted attendance is counted, so mark and submit attendance before exporting.
      </p>

      <p v-if="!ran && !loading" class="rp-empty">Choose the period and click “Run report”.</p>
      <p v-else-if="ran && !rows.length" class="rp-empty">No records found for this selection.</p>

      <template v-if="ran && rows.length">
        <div class="rp-scroll">
          <table class="rp-table">
            <thead>
              <tr><th v-for="c in def.columns" :key="c.key">{{ c.label }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in preview" :key="i">
                <td v-for="c in def.columns" :key="c.key">{{ r[c.key] ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="rp-count">
          {{ rows.length }} row(s)<span v-if="rows.length > preview.length"> · preview shows the first {{ preview.length }}, the download has all of them</span>
        </p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.rp-page { width: 100%; box-sizing: border-box; padding: 24px 32px 40px; color: #172033; }
.rp-page, .rp-page * { box-sizing: border-box; text-align: left; }

.rp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.rp-head h2 { margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2; color: #172033; }
.rp-head p { margin: 6px 0 0; color: #718096; font-size: 13px; }

.rp-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.rp-tab { height: 36px; padding: 0 16px; border: 1px solid #dce2ec; border-radius: 8px; background: #fff; color: #475569; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.rp-tab.on { border-color: #2563eb; background: #eff6ff; color: #2563eb; }

.rp-card { padding: 22px; border: 1px solid #e6eaf0; border-radius: 12px; background: #fff; box-shadow: 0 2px 8px rgba(15,23,42,.05); }
.rp-card h3 { margin: 0; font-size: 17px; }
.rp-desc { margin: 4px 0 16px; color: #64748b; font-size: 13px; }

.rp-controls { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.rp-controls label { color: #64748b; font-size: 11.5px; font-weight: 600; }
.rp-input { display: block; width: 170px; height: 36px; margin-top: 5px; padding: 0 10px; border: 1px solid #dce2ec; border-radius: 8px; background: #fff; color: #334155; font: inherit; font-size: 12.5px; }

.rp-btn { height: 36px; padding: 0 18px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.rp-btn:hover { background: #1d4ed8; }
.rp-btn:disabled { opacity: .6; cursor: default; }
.rp-btn.ghost { border: 1px solid #dce2ec; background: #fff; color: #475569; }
.rp-btn.green { background: #16a34a; }
.rp-btn.green:hover { background: #15803d; }

.rp-err { margin: 14px 0 0; padding: 10px 14px; border-radius: 8px; background: #fef2f2; color: #b91c1c; font-size: 13px; }
.rp-note { margin: 14px 0 0; padding: 10px 14px; border-radius: 8px; background: #eff6ff; color: #1e40af; font-size: 12px; }
.rp-empty { padding: 36px 0; color: #94a3b8; font-size: 13px; text-align: center !important; }

.rp-scroll { margin-top: 18px; overflow-x: auto; }
.rp-table { width: 100%; border-collapse: collapse; }
.rp-table th { padding: 10px; background: #fafbfc; color: #7b8494; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.rp-table td { padding: 10px; border-bottom: 1px solid #f1f3f7; color: #475569; font-size: 12.5px; white-space: nowrap; }
.rp-count { margin: 12px 0 0; color: #94a3b8; font-size: 11.5px; }

@media (max-width: 650px) {
  .rp-page { padding: 16px; }
  .rp-head { flex-direction: column; }
  .rp-input { width: 100%; }
}
</style>