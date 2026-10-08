import { ref, computed } from 'vue'
import api from '../api'

const FRAPPE_URL = import.meta.env.VITE_FRAPPE_URL || 'http://localhost:8000'
/* Change this list if your Leave Application workflow uses other state names */
const PENDING_STATES = ['Pending', 'Open']

const j = JSON.stringify
const rows = (res) => res?.data?.data || []
const iso = (d) => d.toLocaleDateString('en-CA')
const today = () => iso(new Date())
const inDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return iso(d)
}
const state = (x) => x.workflow_state || x.status || ''
const safe = (p, label) =>
  p.catch((e) => {
    console.warn(`[useHrData] ${label} failed`, e?.response?.status || e)
    return null
  })

const ONBOARDING_WORKFLOW = [
  'Created',
  'Documents Pending',
  'Verification',
  'Pending Approval',
  'Approved',
  'Employee Created',
  'HR Setup',
  'IT Setup',
  'Ready to Join',
  'Joined',
  'Completed'
]

const ONBOARDING_TRANSITIONS = {
  Created: ['Documents Pending'],
  'Documents Pending': ['Verification'],
  Verification: ['Pending Approval'],
  'Pending Approval': ['Approved'],
  Approved: ['Employee Created'],
  'Employee Created': ['HR Setup'],
  'HR Setup': ['IT Setup'],
  'IT Setup': ['Ready to Join'],
  'Ready to Join': ['Joined'],
  Joined: ['Completed'],
  Completed: []
}

const normalizeOnboardingStatus = (item = {}) => {
  const raw = String(item?.boarding_status || item?.workflow_state || item?.status || '').trim()
  if (!raw) return 'Created'
  const normalized = raw.replace(/_/g, ' ').replace(/\s+/g, ' ')
  const aliases = {
    Pending: 'Documents Pending',
    Draft: 'Created',
    Created: 'Created',
    'In Process': 'Verification',
    'Documents Submitted': 'Verification',
    'Approval Pending': 'Pending Approval',
    'Ready to Join': 'Ready to Join',
    'Employee Created': 'Employee Created',
    'IT Setup': 'IT Setup',
    'HR Setup': 'HR Setup',
    'Joined': 'Joined',
    'Completed': 'Completed'
  }
  return aliases[normalized] || normalized
}

const onboardingStepIndex = (status) => {
  const value = normalizeOnboardingStatus({ boarding_status: status })
  return ONBOARDING_WORKFLOW.indexOf(value)
}

const allowedOnboardingTransition = (current, target) => {
  const from = normalizeOnboardingStatus({ boarding_status: current })
  return (ONBOARDING_TRANSITIONS[from] || []).includes(target)
}

const createEmployeeFromOnboarding = async (item) => {
  if (!item?.name) throw new Error('Onboarding record is missing an employee identifier.')

  const employeeName = item.employee_name || item.name
  const existingEmployees = await api.get('/api/resource/Employee', {
    params: {
      fields: JSON.stringify(['name', 'employee_name', 'status']),
      filters: JSON.stringify([['employee_name', '=', employeeName]]),
      limit_page_length: 20
    }
  })

  const match = (existingEmployees.data?.data || []).find((emp) => emp.employee_name === employeeName)
  if (match) return match

  return api.post('/api/resource/Employee', {
    employee_name: employeeName,
    company: item.company || '',
    department: item.department || '',
    designation: item.designation || '',
    date_of_joining: item.date_of_joining || '',
    status: 'Active'
  })
}

async function updateOnboardingStatus(item, targetStatus) {
  if (!item?.name) throw new Error('Onboarding record is missing its identifier.')

  const currentStatus = normalizeOnboardingStatus(item)
  const effectiveTarget = normalizeOnboardingStatus({ boarding_status: targetStatus })
  if (currentStatus === effectiveTarget) return item

  if (!allowedOnboardingTransition(currentStatus, effectiveTarget)) {
    throw new Error(`Invalid onboarding transition from ${currentStatus} to ${effectiveTarget}.`)
  }

  if (effectiveTarget === 'Employee Created') {
    const employeeRecord = await createEmployeeFromOnboarding(item)
    await api.put(`/api/resource/Employee Onboarding/${encodeURIComponent(item.name)}`, {
      boarding_status: effectiveTarget,
      workflow_state: effectiveTarget,
      employee: employeeRecord?.data?.data?.name || employeeRecord?.name || item.employee_id || ''
    })
    await refresh({ silent: true })
    return employeeRecord
  }

  await api.put(`/api/resource/Employee Onboarding/${encodeURIComponent(item.name)}`, {
    boarding_status: effectiveTarget,
    workflow_state: effectiveTarget
  })

  await refresh({ silent: true })
  return item
}

/* shared state */
const employees = ref([])
const attendance = ref([])
const leaves = ref([])
const onboarding = ref([])
const offboarding = ref([])
const documents = ref([])
const attendanceRequests = ref([])
const approverUsers = ref([])
const jobApplicants = ref([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const authFailed = ref(false)

const empName = (id) => employees.value.find((e) => e.name === id)?.employee_name || id || '—'

async function refresh({ silent = false } = {}) {
  if (!silent) loading.value = true
  error.value = ''
  const t = today()
  const monthStart = t.slice(0, 8) + '01'

  try {
    const [emp, att, lv, onb, sep, files, ver, atr, apr, apl] = await Promise.all([
      /* core: failure here shows an error */
      api.get('/api/resource/Employee', {
        params: {
          filters: j([['status', '=', 'Active']]),
          fields: j([
            'name', 'employee_name', 'department', 'designation', 'user_id', 'leave_approver',
            'employment_type', 'date_of_joining', 'date_of_birth', 'relieving_date',
            'contract_end_date', 'final_confirmation_date'
          ]),
          limit_page_length: 500
        }
      }),
      api.get('/api/resource/Attendance', {
        params: {
          filters: j([['attendance_date', '=', t], ['docstatus', '!=', 2]]),
          fields: j(['employee', 'employee_name', 'status']),
          limit_page_length: 500
        }
      }),
      api.get('/api/resource/Leave Application', {
        params: {
          filters: j([['to_date', '>=', monthStart]]),
          fields: j([
            'name', 'employee', 'employee_name', 'owner', 'leave_type', 'from_date', 'to_date',
            'total_leave_days', 'status', 'workflow_state', 'leave_approver'
          ]),
          order_by: 'from_date asc',
          limit_page_length: 500
        }
      }),
      /* optional: failure logs a warning in the console, page still works */
      safe(api.get('/api/resource/Employee Onboarding', {
        params: {
          filters: j([['docstatus', '!=', 2]]),
          fields: j(['name', 'employee_name', 'designation', 'date_of_joining', 'boarding_status']),
          order_by: 'date_of_joining desc',
          limit_page_length: 50
        }
      }), 'Employee Onboarding'),
      safe(api.get('/api/resource/Employee Separation', {
        params: {
          filters: j([['docstatus', '!=', 2], ['boarding_status', '!=', 'Completed']]),
          fields: j(['name', 'employee', 'employee_name', 'boarding_begins_on', 'boarding_status']),
          order_by: 'boarding_begins_on asc',
          limit_page_length: 50
        }
      }), 'Employee Separation'),
      safe(api.get('/api/resource/File', {
        params: {
          filters: j([['attached_to_doctype', '=', 'Employee'], ['is_folder', '=', 0]]),
          fields: j(['name', 'file_name', 'file_url', 'attached_to_name', 'attached_to_field', 'creation']),
          order_by: 'creation desc',
          limit_page_length: 100
        }
      }), 'File'),
      safe(api.get('/api/resource/Document Verification', {
        params: {
          fields: j(['name', 'employee', 'file', 'file_name', 'status', 'reviewed_by', 'reviewed_on', 'remarks']),
          order_by: 'modified desc',
          limit_page_length: 200
        }
      }), 'Document Verification'),
      safe(api.get('/api/resource/Attendance Request', {
        params: {
          filters: j([['docstatus', '=', 0]]),
          fields: j(['name', 'employee', 'employee_name', 'from_date', 'to_date', 'reason']),
          order_by: 'from_date asc',
          limit_page_length: 50
        }
      }), 'Attendance Request'),
      safe(api.get('/api/method/hr_portal_custom.api.approver.get_leave_approvers'), 'approvers'),
      safe(api.get('/api/resource/Job Applicant', {
        params: {
          filters: j([['status', '=', 'Open']]),
          fields: j(['name', 'applicant_name', 'email_id', 'status', 'job_title']),
          order_by: 'modified desc',
          limit_page_length: 50
        }
      }), 'Job Applicant')
    ])

    employees.value = rows(emp)
    attendance.value = rows(att)
    leaves.value = rows(lv).filter((l) => !['Rejected', 'Cancelled'].includes(state(l)))
    onboarding.value = rows(onb)
    attendanceRequests.value = rows(atr)
    approverUsers.value = apr?.data?.message || []
    jobApplicants.value = rows(apl)

    offboarding.value = await Promise.all(
      rows(sep).map(async (s) => {
        let tasks = 0
        try {
          const d = (await api.get(`/api/resource/Employee Separation/${encodeURIComponent(s.name)}`)).data.data
          tasks = (d.activities || []).length
        } catch {}
        const e = employees.value.find((x) => x.name === s.employee)
        return {
          id: s.name,
          employeeId: s.employee,
          name: s.employee_name || s.name,
          lastDay: e?.relieving_date || s.boarding_begins_on,
          tasks,
          status: s.boarding_status || 'Pending'
        }
      })
    )

    const verByFile = new Map(rows(ver).map((v) => [v.file, v]))
    documents.value = rows(files)
      .filter((f) => f.attached_to_field !== 'image') /* skip profile photos */
      .map((f) => {
        const v = verByFile.get(f.name)
        return {
          name: f.name,
          employee_id: f.attached_to_name,
          employee: empName(f.attached_to_name),
          document: f.file_name,
          file_url: f.file_url ? (f.file_url.startsWith('http') ? f.file_url : FRAPPE_URL + f.file_url) : null,
          uploaded: f.creation,
          verification_name: v?.name || null,
          status: v?.status || 'Pending Review',
          reviewed_by: v?.reviewed_by || null,
          reviewed_on: v?.reviewed_on || null,
          remarks: v?.remarks || null
        }
      })

    loaded.value = true
  } catch (e) {
    if ([401, 403].includes(e.response?.status)) authFailed.value = true
    error.value = e.response?.data?._server_messages || e.message || 'Could not load HR data'
  } finally {
    loading.value = false
  }
}

/* ---------- derived: ONE definition used by both pages ---------- */
const isPending = (l) => PENDING_STATES.includes(state(l))

const pendingLeaves = computed(() => leaves.value.filter((l) => isPending(l) && l.to_date >= today()))
const approvedLeaves = computed(() => leaves.value.filter((l) => state(l) === 'Approved'))
const staleLeaves = computed(() => leaves.value.filter((l) => isPending(l) && l.from_date < today()))

const onboardingOpen = computed(() => onboarding.value.filter((o) => normalizeOnboardingStatus(o) !== 'Completed'))
const onboardingDone = computed(() => onboarding.value.filter((o) => normalizeOnboardingStatus(o) === 'Completed'))

const pendingDocuments = computed(() => documents.value.filter((d) => d.status === 'Pending Review'))

const markedIds = computed(() => new Set(attendance.value.map((a) => a.employee)))
const notMarked = computed(() => employees.value.filter((e) => !markedIds.value.has(e.name)))

const approverTasks = computed(() =>
  employees.value
    .filter((e) => !e.leave_approver)
    .map((e) => ({
      employeeId: e.name,
      employeeUserId: e.user_id,
      employee: e.employee_name,
      detail: 'Leave approver not assigned',
      status: 'Pending',
      availableApprovers: approverUsers.value.filter((u) => u.name !== e.user_id)
    }))
)

/* date-driven compliance items (one row per employee) */
const complianceRows = computed(() => {
  const t = today()
  const end = inDays(30)
  const out = []
  employees.value.forEach((e) => {
    if (e.contract_end_date && e.contract_end_date >= t && e.contract_end_date <= end)
      out.push({ key: `contract-${e.name}`, type: 'contract', task: 'Contract renewal',
        employee: e.employee_name, employeeId: e.name, dueDate: e.contract_end_date, status: 'Due soon' })
    if (e.final_confirmation_date && e.final_confirmation_date >= t && e.final_confirmation_date <= end)
      out.push({ key: `confirm-${e.name}`, type: 'confirmation', task: 'Confirmation review',
        employee: e.employee_name, employeeId: e.name, dueDate: e.final_confirmation_date, status: 'Due soon' })
  })
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
})

/* dashboard alert cards: each one points to a tab so numbers match the target page */
const alerts = computed(() => {
  const list = []
  const n = (type) => complianceRows.value.filter((r) => r.type === type).length
  if (staleLeaves.value.length)
    list.push({ key: 'stale', title: `${staleLeaves.value.length} leave request(s) still pending`, sub: 'Start date has already passed', tone: 'r', tab: 'leave' })
  if (n('contract'))
    list.push({ key: 'contract', title: 'Contract ending within 30 days', sub: `${n('contract')} employee(s)`, tone: 'r', tab: 'compliance' })
  if (n('confirmation'))
    list.push({ key: 'confirm', title: 'Confirmation due within 30 days', sub: `${n('confirmation')} employee(s)`, tone: 'o', tab: 'compliance' })
  if (notMarked.value.length)
    list.push({ key: 'attendance', title: 'No attendance marked today', sub: `${notMarked.value.length} employee(s)`, tone: 'o', tab: null })
  if (approverTasks.value.length)
    list.push({ key: 'approver', title: 'No leave approver assigned', sub: `${approverTasks.value.length} employee(s)`, tone: 'o', tab: 'leave' })
  const noDept = employees.value.filter((e) => !e.department).length
  if (noDept)
    list.push({ key: 'dept', title: 'No department assigned', sub: `${noDept} employee(s)`, tone: 'o', tab: null })
  return list
})

/* ---------- mutations ---------- */
async function reviewDocument(item, status, remarks = '') {
  if (status === 'Rejected' && !String(remarks || '').trim()) {
    throw new Error('Rejection reason is required.')
  }

  const payload = {
    status,
    reviewed_by: localStorage.getItem('user'),
    reviewed_on: today(),
    remarks: String(remarks || '').trim()
  }
  if (item.verification_name) {
    await api.put(`/api/resource/Document Verification/${encodeURIComponent(item.verification_name)}`, payload)
  } else {
    /* no row yet: create it instead of failing */
    await api.post('/api/resource/Document Verification', {
      employee: item.employee_id,
      file: item.name,
      file_name: item.document,
      ...payload
    })
  }
  await refresh({ silent: true })
}

async function assignApprover(employeeId, approver) {
  await api.put(`/api/resource/Employee/${encodeURIComponent(employeeId)}`, { leave_approver: approver })
  await refresh({ silent: true })
}

export function useHrData() {
  return {
    employees, attendance, leaves, onboarding, offboarding, documents,
    attendanceRequests, approverUsers, jobApplicants,
    loading, loaded, error, authFailed,
    pendingLeaves, approvedLeaves, staleLeaves,
    onboardingOpen, onboardingDone, pendingDocuments, notMarked,
    approverTasks, complianceRows, alerts,
    refresh, reviewDocument, assignApprover, today, state,
    ONBOARDING_WORKFLOW,
    normalizeOnboardingStatus,
    onboardingStepIndex,
    allowedOnboardingTransition,
    updateOnboardingStatus
  }
}