<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import api, { errMsg } from '../../api'

const emit = defineEmits(['close'])

/* ================= state ================= */
const step = ref('setup') // setup | running | review
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const info = ref('')

const companies = ref([])
const company = ref('')
const month = ref(new Date().toLocaleDateString('en-CA').slice(0, 7))
const department = ref('')

const employees = ref([])
const assignments = ref([])
const structures = ref([])
const accounts = ref([])
const payAccount = ref('')
const forms = ref({})
const picked = ref({})
const existing = ref(null)
const slipped = ref({})

const entry = ref(null)
const slips = ref([])
const progress = ref([])
const paid = ref(false)

let pollTimer = null

/* ================= helpers ================= */
async function list(doctype, { fields, filters = [], limit = 1000 }) {
  const r = await api.get(`/api/resource/${doctype}`, {
    params: {
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_page_length: limit
    }
  })
  return r.data.data
}
const getDoc = async (doctype, name) => (await api.get(`/api/resource/${doctype}/${name}`)).data.data
const callDoc = (method, name) =>
  api.post('/api/method/run_doc_method', { dt: 'Payroll Entry', dn: name, method })
const submitDoc = (doc) =>
  api.post('/api/method/frappe.client.submit', { doc: JSON.stringify(doc) })

const period = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { start: `${month.value}-01`, end: `${month.value}-${String(last).padStart(2, '0')}` }
})
const monthLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})
const currency = computed(() => companies.value.find((c) => c.name === company.value)?.default_currency || 'INR')
const money = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency.value, maximumFractionDigits: 2 }).format(Number(v) || 0)
const initials = (n = '') => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
const deptLabel = (d) => (d || '').replace(/\s-\s[A-Za-z0-9]{1,6}$/, '') || '—'

/* ================= setup ================= */
const structuresForCompany = computed(() => structures.value.filter((s) => s.company === company.value))
const departments = computed(() => [
  ...new Set(employees.value.filter((e) => e.company === company.value && e.department).map((e) => e.department))
])

const rows = computed(() => {
  const end = period.value.end
  return employees.value
    .filter((e) => e.company === company.value && (!department.value || e.department === department.value))
    .map((e) => {
      const mine = assignments.value
        .filter((a) => a.employee === e.name && a.from_date <= end)
        .sort((a, b) => (a.from_date < b.from_date ? 1 : -1))[0]
      let reason = ''
      if (slipped.value[e.name]) reason = 'paid'
      else if (e.date_of_joining && e.date_of_joining > end) reason = 'joins'
      else if (!mine) reason = 'missing'
      return { ...e, structure: mine?.salary_structure || '', base: mine?.base || 0, reason, eligible: !reason }
    })
})
const eligibleRows = computed(() => rows.value.filter((r) => r.eligible))
const selectedRows = computed(() => eligibleRows.value.filter((r) => picked.value[r.name]))
const missingRows = computed(() => rows.value.filter((r) => r.reason === 'missing'))
const allChecked = computed(() => eligibleRows.value.length > 0 && selectedRows.value.length === eligibleRows.value.length)

function resetPicks() {
  const p = {}
  eligibleRows.value.forEach((r) => (p[r.name] = true))
  picked.value = p
}
function toggleAll(e) {
  const p = {}
  eligibleRows.value.forEach((r) => (p[r.name] = e.target.checked))
  picked.value = p
}
function initForms() {
  const def = structuresForCompany.value[0]?.name || ''
  const f = {}
  employees.value.forEach((e) => {
    f[e.name] = forms.value[e.name] || { structure: def, base: '', busy: false }
  })
  forms.value = f
}

async function loadAssignments() {
  assignments.value = await list('Salary Structure Assignment', {
    fields: ['employee', 'salary_structure', 'from_date', 'base'],
    filters: [['docstatus', '=', 1]]
  })
}

async function checkExisting() {
  existing.value = null
  slipped.value = {}
  if (!company.value) return
  try {
    const found = await list('Payroll Entry', {
      fields: ['name', 'docstatus'],
      filters: [
        ['company', '=', company.value],
        ['start_date', '=', period.value.start],
        ['end_date', '=', period.value.end],
        ['docstatus', '<', 2]
      ],
      limit: 1
    })
    existing.value = found[0] || null
  } catch {
    existing.value = null
  }
  try {
    const done = await list('Salary Slip', {
      fields: ['employee'],
      filters: [
        ['company', '=', company.value],
        ['start_date', '=', period.value.start],
        ['end_date', '=', period.value.end],
        ['docstatus', '<', 2]
      ]
    })
    slipped.value = Object.fromEntries(done.map((d) => [d.employee, true]))
  } catch {
    slipped.value = {}
  }
  resetPicks()
}

async function loadAccounts() {
  try {
    accounts.value = await list('Account', {
      fields: ['name', 'account_type'],
      filters: [
        ['company', '=', company.value],
        ['account_type', 'in', ['Bank', 'Cash']],
        ['is_group', '=', 0]
      ]
    })
    if (!accounts.value.find((a) => a.name === payAccount.value)) {
      payAccount.value = accounts.value.find((a) => a.account_type === 'Bank')?.name || accounts.value[0]?.name || ''
    }
  } catch {
    accounts.value = []
    payAccount.value = ''
  }
}

async function loadSetup() {
  loading.value = true
  error.value = ''
  try {
    const [c, e, s] = await Promise.all([
      list('Company', { fields: ['name', 'default_currency'] }),
      list('Employee', {
        fields: ['name', 'employee_name', 'department', 'designation', 'company', 'date_of_joining'],
        filters: [['status', '=', 'Active']]
      }),
      list('Salary Structure', {
        fields: ['name', 'company'],
        filters: [['docstatus', '=', 1], ['is_active', '=', 'Yes']]
      })
    ])
    companies.value = c
    employees.value = e
    structures.value = s
    if (!company.value) company.value = c[0]?.name || ''
    await loadAssignments()
    initForms()
    resetPicks()
    await Promise.all([checkExisting(), loadAccounts()])
  } catch (e) {
    error.value = errMsg(e, 'Could not load payroll data')
  }
  loading.value = false
}

watch([company, month, department], async () => {
  resetPicks()
  await checkExisting()
})
watch(company, loadAccounts)

/* assign a salary structure without leaving the modal */
async function assignStructure(r) {
  const f = forms.value[r.name]
  error.value = ''
  if (!f.structure || !(Number(f.base) > 0)) {
    error.value = 'Choose a salary structure and enter a base salary greater than 0.'
    return
  }
  f.busy = true
  try {
    const from = r.date_of_joining && r.date_of_joining > period.value.start ? r.date_of_joining : period.value.start
    const doc = (
      await api.post('/api/resource/Salary Structure Assignment', {
        doctype: 'Salary Structure Assignment',
        employee: r.name,
        salary_structure: f.structure,
        from_date: from,
        base: Number(f.base),
        company: company.value
      })
    ).data.data
    await submitDoc(doc)
    await loadAssignments()
    picked.value = { ...picked.value, [r.name]: true }
    info.value = `${r.employee_name} is ready for payroll.`
  } catch (e) {
    error.value = errMsg(e, `Could not assign a salary structure to ${r.employee_name}`)
  }
  f.busy = false
}

/* ================= run payroll ================= */
function mark(i) {
  progress.value[i].state = 'done'
  if (progress.value[i + 1]) progress.value[i + 1].state = 'doing'
}

async function loadSlips() {
  slips.value = await list('Salary Slip', {
    fields: ['name', 'employee', 'employee_name', 'gross_pay', 'total_deduction', 'net_pay', 'docstatus'],
    filters: [['payroll_entry', '=', entry.value.name], ['docstatus', '<', 2]]
  })
}

async function finishEntry(name) {
  let doc = await getDoc('Payroll Entry', name)
  if (doc.docstatus === 0) {
    await submitDoc(doc)
    doc = await getDoc('Payroll Entry', name)
  }
  mark(1)
  if (!doc.salary_slips_created) {
    await callDoc('create_salary_slips', name)
    doc = await getDoc('Payroll Entry', name)
  }
  entry.value = doc
  await loadSlips()
  mark(2)
}

async function run() {
  error.value = ''
  info.value = ''
  if (!selectedRows.value.length) {
    error.value = 'Select at least one employee.'
    return
  }
  step.value = 'running'
  progress.value = [
    { label: 'Creating payroll entry', state: 'doing' },
    { label: 'Submitting payroll entry', state: 'todo' },
    { label: 'Generating salary slips', state: 'todo' }
  ]
  try {
    const co = await getDoc('Company', company.value)
    const created = (
      await api.post('/api/resource/Payroll Entry', {
        doctype: 'Payroll Entry',
        company: company.value,
        posting_date: new Date().toLocaleDateString('en-CA'),
        payroll_frequency: 'Monthly',
        start_date: period.value.start,
        end_date: period.value.end,
        currency: co.default_currency,
        exchange_rate: 1,
        payroll_payable_account: co.default_payroll_payable_account,
        cost_center: co.cost_center,
        payment_account: payAccount.value || undefined,
        department: department.value || undefined,
        employees: selectedRows.value.map((r) => ({
          employee: r.name,
          employee_name: r.employee_name,
          department: r.department,
          designation: r.designation
        }))
      })
    ).data.data
    mark(0)
    await finishEntry(created.name)
    step.value = 'review'
  } catch (e) {
    error.value = errMsg(e, 'Payroll run failed')
    step.value = 'setup'
    await checkExisting()
  }
}

async function resume() {
  if (!existing.value) return
  error.value = ''
  step.value = 'running'
  progress.value = [
    { label: 'Loading payroll entry', state: 'done' },
    { label: 'Submitting payroll entry', state: 'doing' },
    { label: 'Generating salary slips', state: 'todo' }
  ]
  try {
    await finishEntry(existing.value.name)
    step.value = 'review'
  } catch (e) {
    error.value = errMsg(e, 'Could not open this payroll entry')
    step.value = 'setup'
  }
}

/* ================= review & pay ================= */
const totals = computed(() =>
  slips.value.reduce(
    (t, s) => ({
      gross: t.gross + (Number(s.gross_pay) || 0),
      ded: t.ded + (Number(s.total_deduction) || 0),
      net: t.net + (Number(s.net_pay) || 0)
    }),
    { gross: 0, ded: 0, net: 0 }
  )
)
const draftCount = computed(() => slips.value.filter((s) => s.docstatus === 0).length)
const allSubmitted = computed(() => slips.value.length > 0 && draftCount.value === 0)
const missingSlips = computed(() =>
  entry.value ? Math.max(0, (entry.value.employees?.length || 0) - slips.value.length) : 0
)
const stage = computed(() => (step.value === 'setup' ? 1 : allSubmitted.value ? 3 : 2))

function stopPoll() {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}
/* re-check every 3s (up to ~30s) while Frappe submits slips in the background */
function poll(tries = 0) {
  stopPoll()
  pollTimer = setTimeout(async () => {
    try {
      await loadSlips()
      entry.value = await getDoc('Payroll Entry', entry.value.name)
    } catch {
      /* keep trying */
    }
    if (!draftCount.value) {
      info.value = 'All salary slips are submitted.'
    } else if (tries < 10) {
      poll(tries + 1)
    } else {
      info.value = 'Still processing. Press Refresh in a moment.'
    }
  }, 3000)
}

async function submitAll() {
  error.value = ''
  info.value = ''
  busy.value = true
  try {
    await callDoc('submit_salary_slips', entry.value.name)
    await loadSlips()
    entry.value = await getDoc('Payroll Entry', entry.value.name)
    if (draftCount.value) {
      info.value = 'Submitting in the background. This updates automatically.'
      poll()
    }
  } catch (e) {
    error.value = errMsg(e, 'Could not submit salary slips')
  }
  busy.value = false
}

async function refresh() {
  error.value = ''
  busy.value = true
  try {
    await loadSlips()
    entry.value = await getDoc('Payroll Entry', entry.value.name)
    info.value = ''
  } catch (e) {
    error.value = errMsg(e, 'Could not refresh')
  }
  busy.value = false
}

async function createBankEntry() {
  error.value = ''
  info.value = ''
  busy.value = true
  try {
    try {
      await callDoc('make_bank_entry', entry.value.name)
    } catch (first) {
      try {
        await callDoc('make_payment_entry', entry.value.name)
      } catch {
        throw first
      }
    }
    paid.value = true
    info.value = 'Bank payment entry created.'
  } catch (e) {
    error.value = errMsg(e, 'Could not create the bank entry')
  }
  busy.value = false
}

function downloadCsv() {
  const head = ['Employee ID', 'Employee', 'Gross Pay', 'Deductions', 'Net Pay', 'Status', 'Salary Slip']
  const body = slips.value.map((s) => [
    s.employee, s.employee_name, s.gross_pay, s.total_deduction, s.net_pay,
    s.docstatus === 1 ? 'Submitted' : 'Draft', s.name
  ])
  const csv = [head, ...body]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `payroll-${month.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(loadSetup)
onBeforeUnmount(stopPoll)
</script>

<template>
  <div class="pr-overlay" @click.self="step !== 'running' && emit('close')">
    <div class="pr-modal">
      <!-- header -->
      <div class="pr-head">
        <div>
          <h3>Run Payroll</h3>
          <p v-if="entry && step === 'review'">{{ entry.name }} · {{ monthLabel }}</p>
          <p v-else>Select employees, generate salary slips and pay, all in one place.</p>
        </div>
        <button type="button" class="pr-x" :disabled="step === 'running'" @click="emit('close')">✕</button>
      </div>

      <!-- stepper -->
      <ol class="pr-stepper">
        <li :class="{ on: stage === 1, done: stage > 1 }"><i>{{ stage > 1 ? '✓' : 1 }}</i>Select</li>
        <li :class="{ on: stage === 2, done: stage > 2 }"><i>{{ stage > 2 ? '✓' : 2 }}</i>Review &amp; submit</li>
        <li :class="{ on: stage === 3, done: paid }"><i>{{ paid ? '✓' : 3 }}</i>Pay</li>
      </ol>

      <p v-if="error" class="pr-msg err">{{ error }}</p>
      <p v-if="info" class="pr-msg info">{{ info }}</p>

      <!-- SETUP -->
      <div v-if="step === 'setup'" class="pr-body">
        <p v-if="loading" class="pr-muted">Loading...</p>
        <template v-else>
          <div class="pr-filters">
            <label>Month<input v-model="month" type="month" /></label>
            <label v-if="companies.length > 1">
              Company
              <select v-model="company">
                <option v-for="c in companies" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
            </label>
            <label>
              Department
              <select v-model="department">
                <option value="">All departments</option>
                <option v-for="d in departments" :key="d" :value="d">{{ deptLabel(d) }}</option>
              </select>
            </label>
            <label v-if="accounts.length">
              Pay from account
              <select v-model="payAccount">
                <option v-for="a in accounts" :key="a.name" :value="a.name">{{ a.name }}</option>
              </select>
            </label>
          </div>

          <div v-if="existing" class="pr-msg warn inline">
            A payroll entry for {{ monthLabel }} already exists (<b>{{ existing.name }}</b>,
            {{ existing.docstatus === 1 ? 'submitted' : 'draft' }}). Employees who already have a salary slip are skipped, so you can still run payroll for the rest, or open the existing entry.
            <button type="button" class="pr-btn small" @click="resume">Open existing</button>
          </div>

          <table v-if="rows.length" class="pr-table">
            <thead>
              <tr>
                <th><input type="checkbox" :checked="allChecked" :disabled="!eligibleRows.length" @change="toggleAll" /></th>
                <th>Employee</th>
                <th>Department</th>
                <th>Salary structure</th>
                <th class="r">Base</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.name" :class="{ off: !r.eligible }">
                <td><input v-model="picked[r.name]" type="checkbox" :disabled="!r.eligible" /></td>
                <td>
                  <div class="pr-person">
                    <span class="av">{{ initials(r.employee_name) }}</span>
                    <div>{{ r.employee_name }}<small>{{ r.name }}</small></div>
                  </div>
                </td>
                <td>{{ deptLabel(r.department) }}</td>
                <td colspan="2">
                  <div v-if="r.eligible" class="pr-ok-row">
                    <span>{{ r.structure }}</span>
                    <b>{{ money(r.base) }}</b>
                  </div>
                  <span v-else-if="r.reason === 'paid'" class="pr-chip ok">Salary slip already created</span>
                  <span v-else-if="r.reason === 'joins'" class="pr-chip warn">Joins after this month</span>
                  <div v-else-if="forms[r.name]" class="pr-assign">
                    <select v-model="forms[r.name].structure">
                      <option value="" disabled>Structure</option>
                      <option v-for="s in structuresForCompany" :key="s.name" :value="s.name">{{ s.name }}</option>
                    </select>
                    <input v-model="forms[r.name].base" type="number" min="0" placeholder="Base salary" />
                    <button type="button" class="pr-btn small" :disabled="forms[r.name].busy" @click="assignStructure(r)">
                      {{ forms[r.name].busy ? '...' : 'Assign' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="pr-muted">No active employees found for this selection.</p>

          <p v-if="missingRows.length" class="pr-note">
            {{ missingRows.length }} employee(s) have no salary structure. Assign one above to include them.
            <span v-if="!structuresForCompany.length">No active salary structure exists yet. Create one in Frappe first.</span>
          </p>
        </template>
      </div>

      <!-- RUNNING -->
      <div v-else-if="step === 'running'" class="pr-body">
        <ul class="pr-steps">
          <li v-for="p in progress" :key="p.label" :class="p.state">
            <span class="dot">{{ p.state === 'done' ? '✓' : p.state === 'doing' ? '…' : '' }}</span>
            {{ p.label }}
          </li>
        </ul>
        <p class="pr-muted">Please keep this window open.</p>
      </div>

      <!-- REVIEW -->
      <div v-else class="pr-body">
        <div class="pr-totals">
          <div><small>Salary slips</small><b>{{ slips.length }}</b></div>
          <div><small>Gross pay</small><b>{{ money(totals.gross) }}</b></div>
          <div><small>Deductions</small><b>{{ money(totals.ded) }}</b></div>
          <div class="net"><small>Net pay</small><b>{{ money(totals.net) }}</b></div>
        </div>

        <p v-if="missingSlips" class="pr-msg warn inline">
          {{ missingSlips }} selected employee(s) did not get a salary slip. Check their salary structure and attendance.
        </p>

        <table v-if="slips.length" class="pr-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th class="r">Gross</th>
              <th class="r">Deductions</th>
              <th class="r">Net pay</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in slips" :key="s.name">
              <td>
                <div class="pr-person">
                  <span class="av">{{ initials(s.employee_name) }}</span>
                  <div>{{ s.employee_name }}<small>{{ s.name }}</small></div>
                </div>
              </td>
              <td class="r">{{ money(s.gross_pay) }}</td>
              <td class="r">{{ money(s.total_deduction) }}</td>
              <td class="r"><b>{{ money(s.net_pay) }}</b></td>
              <td>
                <span class="pr-chip" :class="s.docstatus === 1 ? 'ok' : 'warn'">
                  {{ s.docstatus === 1 ? 'Submitted' : 'Draft' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="pr-muted">No salary slips were generated.</p>

        <div v-if="allSubmitted" class="pr-pay" :class="{ done: paid }">
          <template v-if="paid">✓ Bank payment entry created for {{ money(totals.net) }}.</template>
          <template v-else-if="entry && entry.payment_account">
            Ready to pay {{ money(totals.net) }} from <b>{{ entry.payment_account }}</b>.
          </template>
          <template v-else>
            No bank or cash account was selected for this payroll entry, so the payment entry must be created in
            Frappe (<b>{{ entry?.name }}</b>).
          </template>
        </div>
      </div>

      <!-- footer -->
      <div class="pr-foot">
        <template v-if="step === 'setup'">
          <span class="pr-muted">{{ selectedRows.length }} of {{ eligibleRows.length }} employees selected</span>
          <div class="pr-acts">
            <button type="button" class="pr-btn ghost" @click="emit('close')">Cancel</button>
            <button type="button" class="pr-btn" :disabled="loading || !selectedRows.length" @click="run">
              Generate Salary Slips
            </button>
          </div>
        </template>
        <template v-else-if="step === 'review'">
          <button type="button" class="pr-btn ghost" :disabled="!slips.length" @click="downloadCsv">Download CSV</button>
          <div class="pr-acts">
            <button type="button" class="pr-btn ghost" :disabled="busy" @click="refresh">Refresh</button>
            <button v-if="!allSubmitted" type="button" class="pr-btn" :disabled="busy || !slips.length" @click="submitAll">
              {{ busy ? 'Submitting...' : 'Submit All Salary Slips' }}
            </button>
            <template v-else>
              <button
                v-if="!paid && entry && entry.payment_account"
                type="button"
                class="pr-btn green"
                :disabled="busy"
                @click="createBankEntry"
              >
                {{ busy ? 'Creating...' : 'Create Bank Entry' }}
              </button>
              <button type="button" class="pr-btn" @click="emit('close')">Done</button>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.5);
}
.pr-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 920px;
  max-height: 90vh;
  border-radius: 14px;
  background: #fff;
  color: #172033;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3);
}
.pr-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 8px;
}
.pr-head h3 { margin: 0; font-size: 18px; }
.pr-head p { margin: 4px 0 0; color: #718096; font-size: 12.5px; }
.pr-x {
  align-self: flex-start;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f9;
  cursor: pointer;
}
.pr-x:disabled { opacity: 0.4; cursor: not-allowed; }

.pr-stepper {
  display: flex;
  gap: 8px;
  margin: 8px 22px 0;
  padding: 0 0 12px;
  list-style: none;
  border-bottom: 1px solid #eef0f4;
}
.pr-stepper li {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  color: #94a3b8;
  font-size: 12.5px;
  font-weight: 600;
}
.pr-stepper i {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #64748b;
  font-size: 11px;
  font-style: normal;
}
.pr-stepper li.on { color: #172033; }
.pr-stepper li.on i { background: #4f46e5; color: #fff; }
.pr-stepper li.done { color: #15803d; }
.pr-stepper li.done i { background: #dcfce7; color: #15803d; }

.pr-body { flex: 1; overflow: auto; padding: 16px 22px; }
.pr-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid #eef0f4;
}
.pr-acts { display: flex; gap: 8px; }

.pr-msg {
  margin: 12px 22px 0;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12.5px;
}
.pr-msg.inline { margin: 0 0 12px; }
.pr-msg.err { background: #fef2f2; color: #b91c1c; }
.pr-msg.info { background: #eff6ff; color: #1d4ed8; }
.pr-msg.warn { background: #fffbeb; color: #b45309; }
.pr-muted { color: #94a3b8; font-size: 12.5px; }
.pr-note { margin: 10px 0 0; color: #b45309; font-size: 12px; }

.pr-filters { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 14px; }
.pr-filters label { display: flex; flex-direction: column; gap: 4px; color: #64748b; font-size: 11.5px; font-weight: 600; }
.pr-filters input, .pr-filters select {
  height: 34px;
  min-width: 170px;
  padding: 0 10px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 13px;
}

.pr-table { width: 100%; border-collapse: collapse; }
.pr-table th {
  padding: 8px 6px;
  background: #fafbfc;
  color: #7b8494;
  font-size: 10.5px;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
}
.pr-table td {
  padding: 9px 6px;
  border-bottom: 1px solid #f1f3f7;
  font-size: 12.5px;
  vertical-align: middle;
}
.pr-table .r { text-align: right; }
.pr-table tr.off td { color: #64748b; }

.pr-ok-row { display: flex; justify-content: space-between; gap: 10px; }
.pr-assign { display: flex; gap: 6px; align-items: center; }
.pr-assign select, .pr-assign input {
  height: 30px;
  padding: 0 8px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 12px;
}
.pr-assign select { min-width: 120px; max-width: 150px; }
.pr-assign input { width: 110px; }

.pr-person { display: flex; align-items: center; gap: 8px; }
.pr-person small { display: block; color: #94a3b8; font-size: 10.5px; }
.av {
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 10px;
  font-weight: 700;
}

.pr-chip {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
}
.pr-chip.ok { background: #dcfce7; color: #15803d; }
.pr-chip.warn { background: #fff1e0; color: #c2610c; }

.pr-steps { margin: 6px 0 14px; padding: 0; list-style: none; }
.pr-steps li { display: flex; align-items: center; gap: 10px; padding: 8px 0; color: #94a3b8; font-size: 14px; }
.pr-steps li.doing { color: #172033; font-weight: 600; }
.pr-steps li.done { color: #15803d; }
.pr-steps .dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  font-size: 12px;
}

.pr-totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.pr-totals div { padding: 10px 12px; border: 1px solid #e6eaf0; border-radius: 10px; }
.pr-totals small { display: block; color: #8a94a6; font-size: 11px; }
.pr-totals b { font-size: 16px; }
.pr-totals .net { background: #eef2ff; border-color: #c7d2fe; }

.pr-pay {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  background: #f5f7ff;
  font-size: 13px;
}
.pr-pay.done { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; font-weight: 600; }

.pr-btn {
  height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.pr-btn:hover { background: #4338ca; }
.pr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pr-btn.ghost { background: #e5e7eb; color: #1f2937; }
.pr-btn.green { background: #16a34a; }
.pr-btn.green:hover { background: #15803d; }
.pr-btn.small { height: 30px; padding: 0 12px; font-size: 12px; }

@media (max-width: 760px) {
  .pr-totals { grid-template-columns: repeat(2, 1fr); }
  .pr-foot { flex-direction: column; align-items: stretch; }
  .pr-assign { flex-wrap: wrap; }
  .pr-stepper li { font-size: 11px; }
}
</style>