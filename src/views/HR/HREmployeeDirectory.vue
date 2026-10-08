<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { errMsg } from '../../api'

const route = useRoute()
const router = useRouter()
const today = new Date().toLocaleDateString('en-CA')
const monthKey = today.slice(0, 7)

const employees = ref([])
const loading = ref(true)
const error = ref('')
const success = ref('')

const search = ref('')
const deptFilter = ref('')
const statusFilter = ref('Active')

const opts = ref({ companies: [], departments: [], designations: [], genders: [], types: [], users: [] })

const showModal = ref(false)
const editing = ref('')
const saving = ref(false)
const formError = ref('')

/* credentials dialog shown after a new employee is created */
const creds = ref(null)
const copied = ref('')

const blank = () => ({
  first_name: '', last_name: '', gender: '', date_of_birth: '',
  date_of_joining: today, company: '', department: '', designation: '',
  employment_type: '', cell_number: '', company_email: '', leave_approver: ''
})
const form = ref(blank())

const initials = (n = '') => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

function fmt(s) {
  if (!s) return '—'
  return new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

async function list(doctype, fields = ['name'], filters) {
  try {
    const params = { fields: JSON.stringify(fields), limit_page_length: 500 }
    if (filters) params.filters = JSON.stringify(filters)
    const r = await api.get(`/api/resource/${doctype}`, { params })
    return r.data.data || []
  } catch {
    return []
  }
}

async function loadEmployees() {
  try {
    const r = await api.get('/api/resource/Employee', {
      params: {
        fields: JSON.stringify([
          'name', 'employee_name', 'department', 'designation', 'status', 'date_of_joining',
          'company_email', 'cell_number', 'employment_type', 'leave_approver'
        ]),
        order_by: 'employee_name asc',
        limit_page_length: 1000
      }
    })
    employees.value = r.data.data || []
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(e, 'Could not load employees')
    }
  }
}

onMounted(async () => {
  const [companies, departments, designations, genders, types, users] = await Promise.all([
    list('Company'),
    list('Department'),
    list('Designation'),
    list('Gender'),
    list('Employment Type'),
    list('User', ['name', 'full_name'], [['enabled', '=', 1]])
  ])
  opts.value = { companies, departments, designations, genders, types, users }
  await loadEmployees()
  loading.value = false
  if (route.query.new) openAdd()
})

/* ---------- stats / filters ---------- */
const stats = computed(() => ({
  total: employees.value.length,
  active: employees.value.filter((e) => e.status === 'Active').length,
  inactive: employees.value.filter((e) => e.status !== 'Active').length,
  joined: employees.value.filter((e) => (e.date_of_joining || '').slice(0, 7) === monthKey).length
}))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return employees.value.filter((e) => {
    if (statusFilter.value && e.status !== statusFilter.value) return false
    if (deptFilter.value && e.department !== deptFilter.value) return false
    if (q && !`${e.employee_name} ${e.name} ${e.designation || ''} ${e.company_email || ''}`.toLowerCase().includes(q))
      return false
    return true
  })
})

const chip = (s) => ({ Active: 'g', Inactive: 'o', Suspended: 'o', Left: 'r' }[s] || 'n')

/* ---------- add / edit ---------- */
function openAdd() {
  editing.value = ''
  formError.value = ''
  form.value = blank()
  if (opts.value.companies.length === 1) form.value.company = opts.value.companies[0].name
  showModal.value = true
}

async function openEdit(e) {
  editing.value = e.name
  formError.value = ''
  try {
    const d = (await api.get(`/api/resource/Employee/${encodeURIComponent(e.name)}`)).data.data
    const f = blank()
    Object.keys(f).forEach((k) => { f[k] = d[k] || '' })
    form.value = f
    showModal.value = true
  } catch (err) {
    error.value = errMsg(err, 'Could not open employee')
  }
}

function closeModal() {
  showModal.value = false
}

async function save() {
  formError.value = ''
  const f = form.value
  const required = [
    ['first_name', 'First name'], ['gender', 'Gender'], ['date_of_birth', 'Date of birth'],
    ['date_of_joining', 'Date of joining'], ['company', 'Company']
  ]
  if (!editing.value) required.push(['company_email', 'Work email'])

  const missing = required.filter(([k]) => !String(f[k] || '').trim()).map(([, l]) => l)
  if (missing.length) {
    formError.value = `Please fill: ${missing.join(', ')}`
    return
  }
  if (!editing.value && !/^\S+@\S+\.\S+$/.test(f.company_email.trim())) {
    formError.value = 'Please enter a valid work email'
    return
  }

  saving.value = true
  try {
    if (editing.value) {
      const body = {}
      Object.entries(f).forEach(([k, v]) => { body[k] = v === '' ? null : v })
      await api.put(`/api/resource/Employee/${encodeURIComponent(editing.value)}`, body)
      success.value = 'Employee updated'
    } else {
      /* creates User + Employee together and returns a temporary password */
      const payload = {
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        gender: f.gender,
        date_of_birth: f.date_of_birth,
        company: f.company,
        date_of_joining: f.date_of_joining,
        department: f.department,
        designation: f.designation,
        employment_type: f.employment_type,
        leave_approver: f.leave_approver,
        work_email: f.company_email.trim(),
        phone: f.cell_number
      }
      const r = await api.post(
        '/api/method/hr_portal_custom.api.employee.create_employee_with_login',
        { data: JSON.stringify(payload) }
      )
      const m = r.data.message
      creds.value = {
        name: `${f.first_name} ${f.last_name}`.trim(),
        employee: m.employee,
        email: m.email,
        password: m.temporary_password
      }
      success.value = 'Employee added'
    }
    showModal.value = false
    await loadEmployees()
  } catch (e) {
    formError.value = errMsg(e, 'Could not save employee')
  }
  saving.value = false
}

async function setStatus(e, status) {
  const verb = status === 'Active' ? 'reactivate' : 'deactivate'
  const extra = status === 'Active' ? '' : ' Their login will also be disabled.'
  if (!window.confirm(`Do you want to ${verb} ${e.employee_name}?${extra}`)) return
  error.value = ''
  success.value = ''
  try {
    /* updates the Employee status AND enables/disables the linked login */
    await api.post('/api/method/hr_portal_custom.api.employee_status.set_employee_active', {
      employee: e.name,
      active: status === 'Active' ? 1 : 0
    })
    success.value = `${e.employee_name} ${status === 'Active' ? 'reactivated' : 'deactivated'}`
    await loadEmployees()
  } catch (err) {
    error.value = errMsg(err, `Could not ${verb} employee`)
  }
}

/* ---------- credentials dialog ---------- */
async function copy(text, key) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const t = document.createElement('textarea')
    t.value = text
    document.body.appendChild(t)
    t.select()
    document.execCommand('copy')
    document.body.removeChild(t)
  }
  copied.value = key
  setTimeout(() => { if (copied.value === key) copied.value = '' }, 1500)
}

function closeCreds() {
  creds.value = null
  copied.value = ''
}

/* ---------- export ---------- */
function exportCsv() {
  const head = ['Employee ID', 'Name', 'Department', 'Designation', 'Employment Type', 'Date of Joining', 'Email', 'Phone', 'Status']
  const lines = filtered.value.map((e) =>
    [e.name, e.employee_name, e.department, e.designation, e.employment_type, e.date_of_joining, e.company_email, e.cell_number, e.status]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  )
  const blob = new Blob(['\ufeff' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `employees-${today}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="ed-page">
    <div class="ed-head">
      <div>
        <h2>Employee Directory</h2>
        <p>Search, add and manage every employee record.</p>
      </div>
      <div class="ed-actions">
        <button type="button" class="ed-btn ghost" @click="exportCsv">Export CSV</button>
        <button type="button" class="ed-btn" @click="openAdd">+ Add Employee</button>
      </div>
    </div>

    <p v-if="error" class="ed-err">{{ error }}</p>
    <p v-if="success" class="ed-ok">{{ success }}</p>
    <p v-if="loading" class="ed-muted">Loading...</p>

    <template v-else>
      <section class="ed-stats">
        <div class="ed-card ed-stat"><span>Total employees</span><strong>{{ stats.total }}</strong></div>
        <div class="ed-card ed-stat"><span>Active</span><strong class="g">{{ stats.active }}</strong></div>
        <div class="ed-card ed-stat"><span>Inactive / Left</span><strong class="o">{{ stats.inactive }}</strong></div>
        <div class="ed-card ed-stat"><span>Joined this month</span><strong class="b">{{ stats.joined }}</strong></div>
      </section>

      <section class="ed-card">
        <div class="ed-toolbar">
          <input v-model="search" class="ed-input ed-search" type="text" placeholder="Search by name, ID, designation or email..." />
          <select v-model="deptFilter" class="ed-input ed-select">
            <option value="">All departments</option>
            <option v-for="d in opts.departments" :key="d.name" :value="d.name">{{ d.name }}</option>
          </select>
          <select v-model="statusFilter" class="ed-input ed-select">
            <option value="">All statuses</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Suspended</option>
            <option>Left</option>
          </select>
        </div>

        <div class="ed-scroll">
          <table class="ed-table">
            <thead>
              <tr>
                <th>Employee</th><th>Department</th><th>Designation</th><th>Joined</th>
                <th>Contact</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in filtered" :key="e.name">
                <td>
                  <div class="ed-person">
                    <span class="ed-av">{{ initials(e.employee_name) }}</span>
                    <div>
                      <button type="button" class="ed-link" @click="router.push('/hr/employee/' + e.name)">{{ e.employee_name }}</button>
                      <small>{{ e.name }}</small>
                    </div>
                  </div>
                </td>
                <td>{{ e.department || '—' }}</td>
                <td>{{ e.designation || '—' }}</td>
                <td>{{ fmt(e.date_of_joining) }}</td>
                <td>
                  <div>{{ e.company_email || '—' }}</div>
                  <small>{{ e.cell_number || '' }}</small>
                </td>
                <td><span class="ed-chip" :class="chip(e.status)">{{ e.status }}</span></td>
                <td>
                  <div class="ed-row-actions">
                    <button type="button" class="ed-mini" @click="router.push('/hr/employee/' + e.name)">View</button>
                    <button type="button" class="ed-mini" @click="openEdit(e)">Edit</button>
                    <button v-if="e.status === 'Active'" type="button" class="ed-mini bad" @click="setStatus(e, 'Inactive')">Deactivate</button>
                    <button v-else-if="e.status === 'Inactive'" type="button" class="ed-mini" @click="setStatus(e, 'Active')">Reactivate</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="7" class="ed-empty">No employees match these filters.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ed-count">Showing {{ filtered.length }} of {{ employees.length }}</p>
      </section>
    </template>

    <!-- ADD / EDIT MODAL -->
    <div v-if="showModal" class="ed-overlay" @click.self="closeModal">
      <div class="ed-modal" role="dialog">
        <div class="ed-modal-head">
          <h3>{{ editing ? 'Edit employee' : 'Add employee' }}</h3>
          <button type="button" class="ed-x" @click="closeModal">✕</button>
        </div>

        <p v-if="formError" class="ed-err">{{ formError }}</p>

        <div class="ed-form">
          <label>First name *<input v-model="form.first_name" class="ed-input" type="text" /></label>
          <label>Last name<input v-model="form.last_name" class="ed-input" type="text" /></label>

          <label>Gender *
            <select v-model="form.gender" class="ed-input">
              <option value="">Select</option>
              <option v-for="g in opts.genders" :key="g.name" :value="g.name">{{ g.name }}</option>
            </select>
          </label>
          <label>Date of birth *<input v-model="form.date_of_birth" class="ed-input" type="date" /></label>

          <label>Company *
            <select v-model="form.company" class="ed-input">
              <option value="">Select</option>
              <option v-for="c in opts.companies" :key="c.name" :value="c.name">{{ c.name }}</option>
            </select>
          </label>
          <label>Date of joining *<input v-model="form.date_of_joining" class="ed-input" type="date" /></label>

          <label>Department
            <select v-model="form.department" class="ed-input">
              <option value="">Select</option>
              <option v-for="d in opts.departments" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
          </label>
          <label>Designation
            <select v-model="form.designation" class="ed-input">
              <option value="">Select</option>
              <option v-for="d in opts.designations" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
          </label>

          <label>Employment type
            <select v-model="form.employment_type" class="ed-input">
              <option value="">Select</option>
              <option v-for="t in opts.types" :key="t.name" :value="t.name">{{ t.name }}</option>
            </select>
          </label>
          <label>Leave approver
            <select v-model="form.leave_approver" class="ed-input">
              <option value="">None</option>
              <option v-for="u in opts.users" :key="u.name" :value="u.name">{{ u.full_name || u.name }}</option>
            </select>
          </label>

          <label>Work email {{ editing ? '' : '*' }}
            <input v-model="form.company_email" class="ed-input" type="email" placeholder="Used as the login username" />
          </label>
          <label>Phone<input v-model="form.cell_number" class="ed-input" type="text" /></label>
        </div>

        <p v-if="!editing" class="ed-hint">
          A login is created automatically using the work email. You will get a temporary password to share with the employee.
        </p>

        <div class="ed-modal-foot">
          <button type="button" class="ed-btn ghost" @click="closeModal">Cancel</button>
          <button type="button" class="ed-btn" :disabled="saving" @click="save">
            {{ saving ? 'Saving...' : editing ? 'Save changes' : 'Add employee' }}
          </button>
        </div>
      </div>
    </div>

    <!-- LOGIN CREDENTIALS DIALOG -->
    <div v-if="creds" class="ed-overlay">
      <div class="ed-modal ed-creds" role="dialog">
        <div class="ed-modal-head">
          <h3>Employee created</h3>
          <button type="button" class="ed-x" @click="closeCreds">✕</button>
        </div>

        <p class="ed-sub">
          <b>{{ creds.name }}</b> ({{ creds.employee }}) can now log in. Share these details securely.
          The password is shown only once.
        </p>

        <div class="ed-cred-row">
          <span>Login email</span>
          <code>{{ creds.email }}</code>
          <button type="button" class="ed-mini" @click="copy(creds.email, 'email')">
            {{ copied === 'email' ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <div class="ed-cred-row">
          <span>Temporary password</span>
          <code>{{ creds.password }}</code>
          <button type="button" class="ed-mini" @click="copy(creds.password, 'pw')">
            {{ copied === 'pw' ? 'Copied' : 'Copy' }}
          </button>
        </div>

        <div class="ed-modal-foot">
          <button type="button" class="ed-btn ghost"
            @click="copy(`Email: ${creds.email}\nPassword: ${creds.password}`, 'both')">
            {{ copied === 'both' ? 'Copied' : 'Copy both' }}
          </button>
          <button type="button" class="ed-btn" @click="closeCreds">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ed-page { width: 100%; box-sizing: border-box; padding: 24px 32px 40px; color: #172033; }
.ed-page, .ed-page * { box-sizing: border-box; text-align: left; }

.ed-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.ed-head h2 { margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2; color: #172033; }
.ed-head p { margin: 6px 0 0; color: #718096; font-size: 13px; }
.ed-actions { display: flex; gap: 8px; }

.ed-btn { height: 36px; padding: 0 16px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.ed-btn:hover { background: #1d4ed8; }
.ed-btn:disabled { opacity: .6; cursor: default; }
.ed-btn.ghost { border: 1px solid #dce2ec; background: #fff; color: #475569; }
.ed-btn.ghost:hover { background: #f8fafc; }

.ed-err, .ed-ok { margin: 0 0 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px; }
.ed-err { background: #fef2f2; color: #b91c1c; }
.ed-ok { background: #f0fdf4; color: #15803d; }
.ed-muted { color: #64748b; font-size: 13px; }

.ed-card { padding: 20px; border: 1px solid #e6eaf0; border-radius: 12px; background: #fff; box-shadow: 0 2px 8px rgba(15,23,42,.05); }

.ed-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
.ed-stat span { display: block; color: #64748b; font-size: 12.5px; }
.ed-stat strong { display: block; margin-top: 6px; font-size: 28px; line-height: 1.1; }
.ed-stat strong.g { color: #16a34a; } .ed-stat strong.o { color: #d97706; } .ed-stat strong.b { color: #2563eb; }

.ed-toolbar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.ed-input { height: 36px; padding: 0 10px; border: 1px solid #dce2ec; border-radius: 8px; background: #fff; color: #334155; font: inherit; font-size: 12.5px; width: 100%; }
.ed-input:focus { outline: 2px solid #bfdbfe; border-color: #93c5fd; }
.ed-search { flex: 1 1 280px; width: auto; }
.ed-select { flex: 0 0 190px; width: 190px; }

.ed-scroll { overflow-x: auto; }
.ed-table { width: 100%; border-collapse: collapse; }
.ed-table th { padding: 10px 10px; background: #fafbfc; color: #7b8494; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.ed-table td { padding: 12px 10px; border-bottom: 1px solid #f1f3f7; color: #475569; font-size: 12.5px; vertical-align: middle; }
.ed-table small { display: block; margin-top: 2px; color: #9aa3b2; font-size: 10.5px; }
.ed-empty { padding: 30px; color: #94a3b8; text-align: center !important; }
.ed-count { margin: 12px 0 0; color: #94a3b8; font-size: 11.5px; }

.ed-person { display: flex; align-items: center; gap: 10px; }
.ed-av { display: grid; place-items: center; flex: 0 0 32px; width: 32px; height: 32px; border-radius: 50%; background: #eef2ff; color: #4f46e5; font-size: 11px; font-weight: 700; }
.ed-link { padding: 0; border: 0; background: none; color: #172033; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.ed-link:hover { color: #2563eb; text-decoration: underline; }

.ed-chip { display: inline-flex; padding: 4px 10px; border-radius: 6px; background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 600; }
.ed-chip.g { background: #dcfce7; color: #15803d; } .ed-chip.o { background: #fef3c7; color: #b45309; } .ed-chip.r { background: #fee2e2; color: #b91c1c; }

.ed-row-actions { display: flex; gap: 6px; white-space: nowrap; }
.ed-mini { height: 28px; padding: 0 10px; border: 1px solid #dce2ec; border-radius: 6px; background: #fff; color: #4f46e5; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
.ed-mini:hover { background: #f5f8ff; }
.ed-mini.bad { color: #dc2626; }

.ed-overlay { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15,23,42,.45); }
.ed-modal { width: 100%; max-width: 680px; max-height: 90vh; overflow: auto; padding: 24px; border-radius: 14px; background: #fff; box-shadow: 0 20px 50px rgba(15,23,42,.25); }
.ed-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.ed-modal-head h3 { margin: 0; font-size: 18px; }
.ed-x { width: 32px; height: 32px; border: 1px solid #dce2ec; border-radius: 8px; background: #fff; color: #64748b; cursor: pointer; }
.ed-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.ed-form label { display: block; color: #64748b; font-size: 11.5px; font-weight: 600; }
.ed-form .ed-input { margin-top: 5px; }
.ed-hint { margin: 14px 0 0; padding: 10px 12px; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 12px; }
.ed-modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

.ed-creds { max-width: 520px; }
.ed-sub { margin: 0 0 16px; color: #475569; font-size: 13px; line-height: 1.5; }
.ed-cred-row { display: grid; grid-template-columns: 130px 1fr auto; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 8px; border: 1px solid #e6eaf0; border-radius: 8px; background: #f8fafc; }
.ed-cred-row span { color: #64748b; font-size: 11.5px; font-weight: 600; }
.ed-cred-row code { overflow-wrap: anywhere; color: #172033; font-size: 13px; font-weight: 700; }

@media (max-width: 900px) { .ed-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 650px) {
  .ed-page { padding: 16px; }
  .ed-head { flex-direction: column; }
  .ed-form, .ed-stats { grid-template-columns: 1fr; }
  .ed-select { flex: 1 1 100%; width: 100%; }
  .ed-cred-row { grid-template-columns: 1fr; }
}
</style>