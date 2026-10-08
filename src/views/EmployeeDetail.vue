<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { errMsg } from '../api'

const route = useRoute()
const router = useRouter()
const id = route.params.id
const today = new Date().toLocaleDateString('en-CA')
const month = today.slice(0, 7)

const emp = ref(null)
const balances = ref([])
const balanceOk = ref(true)
const leaves = ref([])
const attendance = ref([])
const sheets = ref([])
const loading = ref(true)
const error = ref('')
const showUnused = ref(false)

const state = (l) => l.workflow_state || l.status
const count = (s) => attendance.value.filter((a) => a.status === s).length
const initials = computed(() =>
  (emp.value?.employee_name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
)

function fmt(d) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function abbr(type = '') {
  const w = type.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean)
  return w.length > 1
    ? w.map((x) => x[0]).join('').toUpperCase().slice(0, 3)
    : (w[0] || '').slice(0, 3).toUpperCase()
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/team?tab=dashboard')
}

const chip = (s) =>
  ({ Approved: 'g', Submitted: 'g', Rejected: 'r', Cancelled: 'r', Pending: 'o', Open: 'o', Draft: 'o' }[s] || 'n')

const info = computed(() => {
  const e = emp.value || {}
  return [
    ['Employee ID', e.name],
    ['Company', e.company],
    ['Department', e.department],
    ['Designation', e.designation],
    ['Employment type', e.employment_type],
    ['Date of joining', fmt(e.date_of_joining)],
    ['Reports to', e.reports_to],
    ['Leave approver', e.leave_approver],
    ['Login user', e.user_id],
    ['Gender', e.gender],
    ['Date of birth', fmt(e.date_of_birth)],
    ['Phone', e.cell_number],
    ['Email', e.company_email || e.personal_email]
  ]
})

const used = (b) => Number(b.leaves_taken || 0)
const pending = (b) => Number(b.leaves_pending_approval || 0)
const pct = (b) =>
  b.total_leaves ? Math.min(100, Math.round((used(b) / Number(b.total_leaves)) * 100)) : 0

const visibleBalances = computed(() =>
  showUnused.value ? balances.value : balances.value.filter((b) => used(b) > 0 || pending(b) > 0)
)
const hiddenCount = computed(
  () => balances.value.filter((b) => !(used(b) > 0 || pending(b) > 0)).length
)

onMounted(async () => {
  try {
    const res = await api.get(`/api/resource/Employee/${id}`)
    emp.value = res.data.data
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(e, 'Could not load employee')
    }
    loading.value = false
    return
  }

  try {
    const r = await api.get(
      '/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details',
      { params: { employee: id, date: today } }
    )
    const alloc = r.data.message.leave_allocation || {}
    balances.value = Object.entries(alloc).map(([type, v]) => ({ type, ...v }))
  } catch {
    balanceOk.value = false
  }

  try {
    const [lv, att] = await Promise.all([
      api.get('/api/resource/Leave Application', {
        params: {
          filters: JSON.stringify([['employee', '=', id]]),
          fields: JSON.stringify([
            'name',
            'leave_type',
            'from_date',
            'to_date',
            'total_leave_days',
            'status',
            'workflow_state'
          ]),
          order_by: 'from_date desc',
          limit_page_length: 10
        }
      }),
      api.get('/api/resource/Attendance', {
        params: {
          filters: JSON.stringify([
            ['employee', '=', id],
            ['attendance_date', '>=', `${month}-01`],
            ['attendance_date', '<=', today],
            ['docstatus', '!=', 2]
          ]),
          fields: JSON.stringify(['attendance_date', 'status']),
          limit_page_length: 100
        }
      })
    ])
    leaves.value = lv.data.data
    attendance.value = att.data.data
  } catch {}

  try {
    const t = await api.get('/api/resource/Timesheet', {
      params: {
        filters: JSON.stringify([
          ['employee', '=', id],
          ['docstatus', '!=', 2]
        ]),
        fields: JSON.stringify(['name', 'start_date', 'end_date', 'total_hours', 'status']),
        order_by: 'start_date desc',
        limit_page_length: 5
      }
    })
    sheets.value = t.data.data || []
  } catch {}

  loading.value = false
})
</script>

<template>
  <div class="ep-page">
    <button type="button" class="ep-back" @click="goBack">← Back to My Team</button>

    <p v-if="error" class="ep-err">{{ error }}</p>
    <p v-if="loading" class="ep-muted">Loading...</p>

    <template v-else-if="emp">
      <!-- PROFILE HEADER -->
      <section class="ep-card ep-hero">
        <div class="ep-avatar">{{ initials }}</div>
        <div class="ep-who">
          <h2 class="ep-name">{{ emp.employee_name }}</h2>
          <p class="ep-role">
            {{ emp.designation || 'No designation' }} · {{ emp.department || 'No department' }}
          </p>
          <span class="ep-id">{{ emp.name }}</span>
        </div>
       
      </section>

      <!-- THIS MONTH -->
      <section class="ep-stats">
        <div class="ep-card ep-stat">
          <div class="ep-lbl">Present this month</div>
          <div class="ep-num ep-green">{{ count('Present') + count('Half Day') }}</div>
        </div>
        <div class="ep-card ep-stat">
          <div class="ep-lbl">On leave this month</div>
          <div class="ep-num ep-blue">{{ count('On Leave') }}</div>
        </div>
        <div class="ep-card ep-stat">
          <div class="ep-lbl">Absent this month</div>
          <div class="ep-num ep-red">{{ count('Absent') }}</div>
        </div>
      </section>

      <div class="ep-cols">
        <!-- LEFT -->
        <div class="ep-col">
          <section class="ep-card">
            <h3 class="ep-title">Employee information</h3>
            <div class="ep-info-grid">
              <div v-for="[k, v] in info" :key="k" class="ep-info-item">
                <span>{{ k }}</span>
                <b>{{ v || '-' }}</b>
              </div>
            </div>
          </section>

          <section class="ep-card">
            <h3 class="ep-title">Recent timesheets</h3>
            <p v-if="!sheets.length" class="ep-muted">No timesheets yet.</p>
            <div v-for="t in sheets" :key="t.name" class="ep-row">
              <div>
                <b>{{ fmt(t.start_date) }} – {{ fmt(t.end_date) }}</b>
                <div class="ep-sub">{{ t.name }}</div>
              </div>
              <div class="ep-right">
                <b>{{ Number(t.total_hours || 0).toFixed(1) }} hrs</b>
                <span class="ep-chip" :class="chip(t.status)">{{ t.status }}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- RIGHT -->
        <div class="ep-col">
          <section class="ep-card">
            <div class="ep-head-row">
              <h3 class="ep-title">Leave balance</h3>
              <label v-if="balanceOk && balances.length" class="ep-toggle">
                <input type="checkbox" v-model="showUnused" />
                <span>Show unused types ({{ hiddenCount }})</span>
              </label>
            </div>

            <p v-if="!balanceOk" class="ep-muted">Balance is not available for this employee.</p>
            <p v-else-if="!balances.length" class="ep-muted">No leave allocated.</p>
            <p v-else-if="!visibleBalances.length" class="ep-muted">
              No leave used yet. Tick "Show unused types" to see all balances.
            </p>

            <div class="ep-bal-grid">
              <div v-for="b in visibleBalances" :key="b.type" class="ep-bal">
                <div class="ep-bal-top">
                  <span class="ep-tag">{{ abbr(b.type) }}</span>
                  <div class="ep-bal-name" :title="b.type">{{ b.type }}</div>
                  <b>{{ b.remaining_leaves }}<small> / {{ b.total_leaves }}</small></b>
                </div>
                <div class="ep-bar"><i :style="{ width: pct(b) + '%' }"></i></div>
                <div class="ep-sub">Used {{ used(b) }} · Pending {{ pending(b) }}</div>
              </div>
            </div>
          </section>

          <section class="ep-card">
            <h3 class="ep-title">Recent leave applications</h3>
            <p v-if="!leaves.length" class="ep-muted">No leave applications.</p>
            <div v-for="l in leaves" :key="l.name" class="ep-row">
              <div>
                <b>{{ l.leave_type }}</b>
                <div class="ep-sub">
                  {{ fmt(l.from_date) }} – {{ fmt(l.to_date) }} · {{ l.total_leave_days }} day(s)
                </div>
              </div>
              <span class="ep-chip" :class="chip(state(l))">{{ state(l) }}</span>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ep-page {
  width: 100%;
  box-sizing: border-box;
  padding: 24px 32px 40px;
  color: #172033;
}

.ep-page,
.ep-page * {
  text-align: left;
  box-sizing: border-box;
}

.ep-back {
  margin-bottom: 16px;
  padding: 8px 14px;
  border: 1px solid #dce2ec;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.ep-back:hover {
  background: #f8fafc;
}

.ep-err {
  padding: 10px 14px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
}

.ep-muted {
  margin: 4px 0 0;
  color: #8a94a6;
  font-size: 13px;
}

.ep-sub {
  margin-top: 2px;
  color: #8a94a6;
  font-size: 11.5px;
}

.ep-card {
  padding: 20px;
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
}

.ep-title {
  margin: 0 0 14px;
  color: #172033;
  font-size: 16px;
  font-weight: 700;
}

/* header */
.ep-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 20px 24px;
  background: #fff;
}

.ep-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 60px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 22px;
  font-weight: 700;
}

.ep-who {
  flex: 1;
  min-width: 0;
}

.ep-name {
  margin: 0;
  color: #172033;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.ep-role {
  margin: 4px 0 8px;
  color: #64748b;
  font-size: 13px;
}

.ep-id {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
}

.ep-badge {
  flex: 0 0 auto;
  padding: 5px 12px;
  border: 0;
  border-radius: 99px;
  box-shadow: none;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ep-badge.on { background: #dcfce7; color: #15803d; }
.ep-badge.off { background: #fee2e2; color: #b91c1c; }

/* month stats */
.ep-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.ep-stat {
  padding: 18px 20px;
}

.ep-lbl {
  margin-bottom: 6px;
  color: #64748b;
  font-size: 13px;
}

.ep-num {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
}

.ep-green { color: #16a34a; }
.ep-blue { color: #2563eb; }
.ep-red { color: #dc2626; }

/* layout */
.ep-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 16px;
  align-items: start;
}

.ep-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* info */
.ep-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 20px;
}

.ep-info-item span {
  display: block;
  margin-bottom: 3px;
  color: #8a94a6;
  font-size: 11px;
}

.ep-info-item b {
  display: block;
  color: #172033;
  font-size: 13px;
  font-weight: 600;
  word-break: break-word;
}

/* balance */
.ep-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.ep-head-row .ep-title {
  margin: 0;
}

.ep-toggle {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.ep-toggle input {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  min-width: 0;
  margin: 0;
  padding: 0;
}

.ep-toggle span {
  white-space: nowrap;
}

.ep-bal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ep-bal {
  padding: 12px;
  border: 1px solid #edf0f4;
  border-radius: 10px;
  background: #fafbfc;
}

.ep-bal-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ep-tag {
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  height: 24px;
  border-radius: 6px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 10px;
  font-weight: 700;
}

.ep-bal-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #172033;
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ep-bal-top b {
  color: #172033;
  font-size: 14px;
  white-space: nowrap;
}

.ep-bal-top b small {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 500;
}

.ep-bar {
  height: 6px;
  margin-bottom: 6px;
  overflow: hidden;
  border-radius: 99px;
  background: #e8ebf0;
}

.ep-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: #6366f1;
}

/* rows */
.ep-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f2f6;
}

.ep-row:last-child {
  border-bottom: 0;
}

.ep-row b {
  display: block;
  color: #172033;
  font-size: 13px;
}

.ep-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ep-right b {
  font-size: 12.5px;
}

.ep-chip {
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

.ep-chip.g { background: #dcfce7; color: #15803d; }
.ep-chip.r { background: #fee2e2; color: #b91c1c; }
.ep-chip.o { background: #fef3c7; color: #b45309; }

@media (max-width: 1100px) {
  .ep-cols { grid-template-columns: 1fr; }
}

@media (max-width: 650px) {
  .ep-page { padding: 16px; }
  .ep-stats, .ep-info-grid, .ep-bal-grid { grid-template-columns: 1fr; }
  .ep-hero { flex-wrap: wrap; }
  .ep-head-row { flex-wrap: wrap; }
}
</style>