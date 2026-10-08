<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { errMsg } from '../../api'
import { useHrData } from '../../composables/useHrData'
import HRTaskDetailModal from '../../components/hr/HRTaskDetailModal.vue'

const route = useRoute()
const router = useRouter()
const hr = useHrData()
const { onboarding, loading } = hr

const todayLabel = new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', weekday: 'short'
})

const validTabs = ['all', 'onboarding', 'offboarding', 'documents', 'leave', 'compliance', 'other']
const activeTab = ref(validTabs.includes(route.query.tab) ? route.query.tab : 'all')
/* show 5 rows on the All Tasks tab, everything on a dedicated tab */
const limit = (list) => (activeTab.value === 'all' ? list.slice(0, 5) : list)
/* which cards are visible: all of them on "All Tasks", one group on its own tab */
const show = (key) => activeTab.value === 'all' || activeTab.value === key

const actionError = ref('')
const error = computed(() => actionError.value || hr.error.value)

const selectedApprovers = ref({})
const selectedOnboarding = ref(null)
const success = ref('')
const busyKey = ref('')
const applicantStatuses = ['Open', 'Replied', 'Hold', 'Accepted', 'Rejected']

/* ---------- icons (same set as the HR Dashboard) ---------- */
const icons = {
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
}

const initials = (name = '') =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

const fmt = (value) =>
  value
    ? new Date(String(value).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    : '—'

const employeeName = (id) => hr.employees.value.find((e) => e.name === id)?.employee_name || id || '—'

/* ---------- display lists: sliced only for display, never for counts ---------- */

/* onboarding: open ones first; completed ones only on the Onboarding tab */
const onboardingRows = computed(() => {
  const openIds = new Set(hr.onboardingOpen.value.map((o) => o.name))
  const open = onboarding.value.filter((o) => openIds.has(o.name))
  const done = activeTab.value === 'all' ? [] : onboarding.value.filter((o) => !openIds.has(o.name))
  return limit([...open, ...done])
})

const offboardingItems = computed(() => limit(hr.offboarding.value))

/* documents: the All Tasks tab only lists documents that still need review */
const documentItems = computed(() => {
  const sorted = [...hr.documents.value].sort(
    (a, b) => (a.status === 'Pending Review' ? 0 : 1) - (b.status === 'Pending Review' ? 0 : 1)
  )
  return limit(activeTab.value === 'all' ? sorted.filter((d) => d.status === 'Pending Review') : sorted)
})

const leaveAttendanceTasks = computed(() =>
  limit([
    ...hr.pendingLeaves.value.map((item) => ({
      name: `leave-${item.name}`,
      employee: item.employee_name || employeeName(item.employee),
      request: item.leave_type || 'Leave request',
      period: `${fmt(item.from_date)}${item.to_date ? ` – ${fmt(item.to_date)}` : ''}`,
      status: 'Pending',
      type: 'Leave',
      leave: item
    })),
    ...hr.attendanceRequests.value.map((item) => ({
      name: `attendance-${item.name}`,
      employee: item.employee_name || employeeName(item.employee),
      request: item.reason || 'Attendance request',
      period: `${fmt(item.from_date)}${item.to_date ? ` – ${fmt(item.to_date)}` : ''}`,
      status: 'Pending',
      type: 'Attendance'
    }))
  ])
)

const approverTasks = computed(() => limit(hr.approverTasks.value))

const complianceTasks = computed(() =>
  limit(hr.complianceRows.value).map((r) => ({
    task: r.task, employee: r.employee, due: fmt(r.dueDate), status: r.status
  }))
)

const recruitmentTasks = computed(() =>
  limit(hr.jobApplicants.value).map((a) => ({
    name: a.name,
    applicant: a.applicant_name || a.email_id || '—',
    email: a.email_id || '—',
    jobOpening: a.job_title || '—',
    status: a.status || 'Open'
  }))
)

/* ---------- counts: always from the FULL lists, one source for tabs, cards and headers ---------- */
const counts = computed(() => ({
  onboarding: hr.onboardingOpen.value.length,
  offboarding: hr.offboarding.value.length,
  documents: hr.pendingDocuments.value.length,
  leave: hr.pendingLeaves.value.length + hr.attendanceRequests.value.length,
  approver: hr.approverTasks.value.length,
  compliance: hr.complianceRows.value.length,
  recruitment: hr.jobApplicants.value.length
}))

const totalPending = computed(
  () =>
    counts.value.onboarding +
    counts.value.offboarding +
    counts.value.documents +
    counts.value.leave +
    counts.value.approver +
    counts.value.compliance
)

const inProgress = computed(() => onboarding.value.filter((o) => o.boarding_status === 'In Process').length)

/* ---------- summary cards: ONE template, each one filters the page ---------- */
const stats = computed(() => [
  { key: 'all', label: 'Total Pending', icon: 'check', tone: 'blue', value: totalPending.value, ctx: 'across all HR workflows' },
  { key: 'onboarding', label: 'Onboarding', icon: 'userplus', tone: 'blue', value: counts.value.onboarding, ctx: `${inProgress.value} in progress` },
  { key: 'documents', label: 'Document Verification', icon: 'file', tone: 'blue', value: counts.value.documents, ctx: 'waiting for review' },
  { key: 'offboarding', label: 'Offboarding', icon: 'logout', tone: 'blue', value: counts.value.offboarding, ctx: 'open separations' },
  { key: 'leave', label: 'Leave & Attendance', icon: 'calendar', tone: 'blue', value: counts.value.leave + counts.value.approver, ctx: 'requests and approver setup' },
  { key: 'compliance', label: 'Compliance', icon: 'alert', tone: 'red', value: counts.value.compliance, ctx: 'due within 30 days' }
])

const tabs = computed(() => [
  { key: 'all', label: 'All Tasks', n: totalPending.value },
  { key: 'onboarding', label: 'Onboarding', n: counts.value.onboarding },
  { key: 'offboarding', label: 'Offboarding', n: counts.value.offboarding },
  { key: 'documents', label: 'Document Verification', n: counts.value.documents },
  { key: 'leave', label: 'Leave & Attendance', n: counts.value.leave + counts.value.approver },
  { key: 'compliance', label: 'Compliance', n: counts.value.compliance },
  { key: 'other', label: 'Recruitment', n: counts.value.recruitment }
])

/* ---------- actions ---------- */
function openOnboarding(item) {
  if (item) selectedOnboarding.value = item
}
function closeOnboarding() {
  selectedOnboarding.value = null
}
function openOnboardingForm() {
  router.push('/hr-tasks/onboarding/new')
}

async function updateDocumentVerification(item, status) {
  actionError.value = ''

  try {
    let remarks = ''
    if (status === 'Rejected') {
      remarks = (window.prompt('Please provide a rejection reason for this document:', '') || '').trim()
      if (!remarks) {
        actionError.value = 'Rejection reason is required before the document can be rejected.'
        return
      }
    }

    await hr.reviewDocument(item, status, remarks)
  } catch (e) {
    actionError.value = errMsg(e, `Could not ${status === 'Verified' ? 'verify' : 'reject'} document`)
  }
}

async function actLeave(item, action) {
  actionError.value = ''
  success.value = ''
  busyKey.value = item.name
  try {
    const doc = (await api.get(`/api/resource/Leave Application/${item.name}`)).data.data
    await api.post('/api/method/frappe.model.workflow.apply_workflow', {
      doc: JSON.stringify(doc),
      action
    })
    success.value = `${item.employee_name || item.name}: leave ${action === 'Approve' ? 'approved' : 'rejected'}`
    await hr.refresh({ silent: true })
  } catch (e) {
    actionError.value = errMsg(e, `Could not ${action.toLowerCase()} leave`)
  }
  busyKey.value = ''
}

async function setApplicantStatus(item, status) {
  actionError.value = ''
  success.value = ''
  busyKey.value = item.name
  try {
    await api.post('/api/method/frappe.client.set_value', {
      doctype: 'Job Applicant',
      name: item.name,
      fieldname: 'status',
      value: status
    })
    success.value = `${item.applicant}: status set to ${status}`
    await hr.refresh({ silent: true })
  } catch (e) {
    actionError.value = errMsg(e, 'Could not update applicant status')
  }
  busyKey.value = ''
}

async function assignLeaveApprover(employeeId, approver) {
  if (!employeeId || !approver) return
  actionError.value = ''
  try {
    await hr.assignApprover(employeeId, approver)
    delete selectedApprovers.value[employeeId]
  } catch (e) {
    actionError.value = errMsg(e, 'Could not assign leave approver')
  }
}

onMounted(() => hr.refresh({ silent: hr.loaded.value }))
</script>

<template>
  <main class="tasks-page">
    <!-- HEADER -->
    <header class="tasks-header">
      <div>
        <h1>HR Tasks</h1>
        <p>Manage onboarding, offboarding, document verification and other HR workflows.</p>
      </div>

      <div class="header-actions">
        <div class="date-box">
          <small>Today</small>
          <span>{{ todayLabel }}</span>
        </div>

        <button type="button" class="create-btn" @click="openOnboardingForm">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.plus"></svg>
          Create Onboarding
        </button>
      </div>
    </header>

    <!-- TABS (with counts) -->
   

    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="success" class="alert ok">{{ success }}</p>
    <p v-if="loading" class="loading">Loading HR tasks...</p>

    <template v-else>
      <!-- SUMMARY CARDS: the only filter. Click one to filter the page -->
      <section class="stats">
        <button
          v-for="s in stats"
          :key="s.key"
          type="button"
          class="stat"
          :class="{ active: activeTab === s.key }"
          :aria-pressed="activeTab === s.key"
          @click="activeTab = s.key"
        >
          <span class="stat-ico" :class="s.tone">
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons[s.icon]"></svg>
          </span>
          <span class="stat-body">
            <span class="stat-label">{{ s.label }}</span>
            <span class="stat-value">{{ s.value }}</span>
            <span class="stat-ctx">{{ s.ctx }}</span>
          </span>
        </button>
      </section>

      <!-- ONBOARDING -->

      <!-- ONBOARDING -->
      <section v-if="show('onboarding')" class="card">
        <header class="card-head">
          <div>
            <h2>Onboarding Pipeline <span class="count">{{ counts.onboarding }}</span></h2>
            <p>Track and complete new hire setup processes.</p>
          </div>
          <button v-if="activeTab === 'all'" type="button" class="more" @click="activeTab = 'onboarding'">View all →</button>
        </header>

        <div v-if="onboardingRows.length" class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th class="col-act">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in onboardingRows" :key="item.name">
                <td>
                  <div class="person">
                    <span class="av">{{ initials(item.employee_name) }}</span>
                    <b>{{ item.employee_name || item.name }}</b>
                  </div>
                </td>
                <td>{{ item.designation || '—' }}</td>
                <td>{{ fmt(item.date_of_joining) }}</td>
                <td>
                  <span
                    class="chip"
                    :class="hr.normalizeOnboardingStatus(item) === 'Completed' ? 'green' : ['Verification', 'Pending Approval', 'Approved', 'Employee Created', 'HR Setup', 'IT Setup', 'Ready to Join', 'Joined'].includes(hr.normalizeOnboardingStatus(item)) ? 'blue' : 'amber'"
                  >{{ hr.normalizeOnboardingStatus(item) }}</span>
                </td>
                <td class="col-act">
                  <button type="button" class="btn ghost" @click="openOnboarding(item)">Open</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.userplus"></svg>
          <p>No onboarding tasks.</p>
        </div>
      </section>

      <!-- DOCUMENTS -->
      <section v-if="show('documents')" class="card">
        <header class="card-head">
          <div>
            <h2>Document Verification Queue <span class="count">{{ counts.documents }}</span></h2>
            <p>Review and verify employee documents.</p>
          </div>
          <button v-if="activeTab === 'all'" type="button" class="more" @click="activeTab = 'documents'">View all →</button>
        </header>

        <div v-if="documentItems.length" class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Document</th>
                <th>Uploaded On</th>
                <th>Status</th>
                <th class="col-act">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in documentItems" :key="item.employee + item.document">
                <td>
                  <div class="person">
                    <span class="av">{{ initials(item.employee) }}</span>
                    <b>{{ item.employee }}</b>
                  </div>
                </td>
                <td>
                  <a
                    v-if="item.file_url"
                    :href="item.file_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="doc-link"
                  >{{ item.document }}</a>
                  <span v-else>{{ item.document }}</span>
                </td>
                <td>{{ fmt(item.uploaded) }}</td>
                <td>
                  <span
                    class="chip"
                    :class="item.status === 'Verified' ? 'green' : item.status === 'Rejected' ? 'red' : 'amber'"
                  >{{ item.status }}</span>
                </td>
                <td class="col-act">
                  <div v-if="item.status === 'Pending Review'" class="row-actions">
                    <button type="button" class="btn ok" @click="updateDocumentVerification(item, 'Verified')">Verify</button>
                    <button type="button" class="btn bad" @click="updateDocumentVerification(item, 'Rejected')">Reject</button>
                  </div>
                  <span v-else class="muted-text">Reviewed</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.check"></svg>
          <p>No employee documents are waiting for review.</p>
        </div>
      </section>

      <!-- OFFBOARDING -->
      <section v-if="show('offboarding')" class="card">
        <header class="card-head">
          <div>
            <h2>Offboarding Tasks <span class="count">{{ counts.offboarding }}</span></h2>
            <p>Manage employee exit processes.</p>
          </div>
          <button v-if="activeTab === 'all'" type="button" class="more" @click="activeTab = 'offboarding'">View all →</button>
        </header>

        <div v-if="offboardingItems.length" class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Last Working Day</th>
                <th>Tasks</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in offboardingItems" :key="item.name + item.lastDay">
                <td>
                  <div class="person">
                    <span class="av">{{ initials(item.name) }}</span>
                    <b>{{ item.name }}</b>
                  </div>
                </td>
                <td>{{ fmt(item.lastDay) }}</td>
                <td>{{ item.tasks }} task{{ item.tasks === 1 ? '' : 's' }}</td>
                <td>
                  <span class="chip" :class="item.status === 'In Process' ? 'blue' : 'amber'">{{ item.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.inbox"></svg>
          <p>No open offboarding tasks.</p>
        </div>
      </section>

      <!-- LEAVE & ATTENDANCE -->
      <section v-if="show('leave')" class="card">
        <header class="card-head">
          <div>
            <h2>Leave &amp; Attendance Adjustments <span class="count">{{ counts.leave }}</span></h2>
            <p>Pending HR actions and corrections.</p>
          </div>
          <button v-if="activeTab === 'all'" type="button" class="more" @click="activeTab = 'leave'">View all →</button>
        </header>

        <div v-if="leaveAttendanceTasks.length" class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Request</th>
                <th>Period</th>
                <th>Status</th>
                <th class="col-act">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in leaveAttendanceTasks" :key="item.name">
                <td><b class="strong">{{ item.employee }}</b></td>
                <td class="wrap">
                  {{ item.request }}
                  <small v-if="item.type" class="muted-text">({{ item.type }})</small>
                </td>
                <td>{{ item.period }}</td>
                <td><span class="chip amber">{{ item.status }}</span></td>
                <td class="col-act">
                  <div v-if="item.leave" class="row-actions">
                    <button type="button" class="btn ok" :disabled="busyKey === item.leave.name" @click="actLeave(item.leave, 'Approve')">Approve</button>
                    <button type="button" class="btn bad" :disabled="busyKey === item.leave.name" @click="actLeave(item.leave, 'Reject')">Reject</button>
                  </div>
                  <span v-else class="muted-text">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.calendar"></svg>
          <p>No pending leave or attendance adjustments.</p>
        </div>
      </section>

      <!-- APPROVER SETUP (part of Leave & Attendance) -->
      <section v-if="show('leave')" class="card">
        <header class="card-head">
          <div>
            <h2>Approver Setup <span class="count">{{ counts.approver }}</span></h2>
            <p>Employees requiring leave workflow setup.</p>
          </div>
          <button v-if="activeTab === 'all'" type="button" class="more" @click="activeTab = 'leave'">View all →</button>
        </header>

        <div v-if="approverTasks.length" class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Issue</th>
                <th>Status</th>
                <th>Approver</th>
                <th class="col-act">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in approverTasks" :key="item.employeeId">
                <td><b class="strong">{{ item.employee }}</b></td>
                <td class="wrap">{{ item.detail }}</td>
                <td><span class="chip amber">{{ item.status }}</span></td>
                <td>
                  <select v-model="selectedApprovers[item.employeeId]" class="select approver">
                    <option value="" disabled>Select approver</option>
                    <option v-for="user in item.availableApprovers" :key="user.name" :value="user.name">
                      {{ user.full_name || user.name }}
                    </option>
                  </select>
                </td>
                <td class="col-act">
                  <button
                    type="button"
                    class="btn"
                    :disabled="!selectedApprovers[item.employeeId]"
                    @click="assignLeaveApprover(item.employeeId, selectedApprovers[item.employeeId])"
                  >Assign</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.check"></svg>
          <p>All active employees have an approver.</p>
        </div>
      </section>

      <!-- COMPLIANCE -->
      <section v-if="show('compliance')" class="card">
        <header class="card-head">
          <div>
            <h2>Compliance Tasks <span class="count">{{ counts.compliance }}</span></h2>
            <p>Upcoming HR compliance actions.</p>
          </div>
          <button v-if="activeTab === 'all'" type="button" class="more" @click="activeTab = 'compliance'">View all →</button>
        </header>

        <div v-if="complianceTasks.length" class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Task</th>
                <th>Employee</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in complianceTasks" :key="item.task + item.employee">
                <td><b class="strong">{{ item.task }}</b></td>
                <td>{{ item.employee }}</td>
                <td>{{ item.due }}</td>
                <td><span class="chip red">{{ item.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.check"></svg>
          <p>No compliance tasks due within 30 days.</p>
        </div>
      </section>

      <!-- RECRUITMENT -->
      <section v-if="show('other')" class="card">
        <header class="card-head">
          <div>
            <h2>Recruitment <span class="count">{{ counts.recruitment }}</span></h2>
            <p>Review open job applications and update their status.</p>
          </div>
          <button v-if="activeTab === 'all'" type="button" class="more" @click="activeTab = 'other'">View all →</button>
        </header>

        <div v-if="recruitmentTasks.length" class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Email</th>
                <th>Job Opening</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recruitmentTasks" :key="item.name">
                <td><b class="strong">{{ item.applicant }}</b></td>
                <td>{{ item.email }}</td>
                <td>{{ item.jobOpening }}</td>
                <td>
                  <select
                    class="select"
                    :value="item.status"
                    :disabled="busyKey === item.name"
                    @change="setApplicantStatus(item, $event.target.value)"
                  >
                    <option v-for="st in applicantStatuses" :key="st" :value="st">{{ st }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true" v-html="icons.inbox"></svg>
          <p>No open recruitment applications.</p>
        </div>
      </section>

      <HRTaskDetailModal :item="selectedOnboarding" @close="closeOnboarding" />
    </template>
  </main>
</template>

<style scoped>
/* ===== Design tokens: identical to the HR Dashboard, change in both places ===== */
.tasks-page {
  --c-text: #172033;
  --c-muted: #64748b;
  --c-faint: #94a3b8;
  --c-border: #e6eaf0;
  --c-line: #eef1f5;
  --c-primary: #2563eb;
  --c-primary-soft: #eff6ff;
  --c-ok: #16a34a;     --c-ok-soft: #dcfce7;   --c-ok-text: #15803d;
  --c-warn: #f59e0b;   --c-warn-soft: #fef3c7; --c-warn-text: #b45309;
  --c-bad: #ef4444;    --c-bad-soft: #fee2e2;  --c-bad-text: #b91c1c;
  --gap: 12px;
  --pad: 14px;
  --radius: 10px;
  --fs-xs: 11px;
  --fs-sm: 12px;
  --fs-title: 13px;
  --fs-big: 24px;

  width: 100%;
  padding: 16px 20px 28px;
  color: var(--c-text);
  font-size: var(--fs-sm);
}

.tasks-page,
.tasks-page * {
  box-sizing: border-box;
}

.svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ===== Header ===== */
.tasks-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.tasks-header h1 { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.2; }
.tasks-header p { margin: 4px 0 0; color: var(--c-muted); font-size: var(--fs-sm); }

.header-actions { display: flex; align-items: center; gap: 10px; }

.date-box {
  flex: 0 0 auto;
  padding: 6px 12px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fff;
}
.date-box small { display: block; color: var(--c-faint); font-size: var(--fs-xs); }
.date-box span { font-size: var(--fs-sm); font-weight: 600; white-space: nowrap; }

.create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--c-primary);
  border-radius: 8px;
  background: var(--c-primary);
  color: #fff;
  font: inherit;
  font-size: var(--fs-sm);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.create-btn:hover { filter: brightness(0.94); }
.create-btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }

/* ===== Tabs ===== */
.tabs {
  display: flex;
  gap: 2px;
  margin-bottom: var(--gap);
  border-bottom: 1px solid var(--c-border);
  overflow-x: auto;
}
.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--c-muted);
  font: inherit;
  font-size: var(--fs-sm);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.tabs button:hover { color: var(--c-text); }
.tabs button.active { border-bottom-color: var(--c-primary); color: var(--c-primary); }
.tab-n {
  min-width: 18px;
  padding: 1px 6px;
  border-radius: 99px;
  background: #f1f5f9;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 700;
  text-align: center;
}
.tabs button.active .tab-n { background: var(--c-primary-soft); color: var(--c-primary); }

/* ===== Messages ===== */
.alert {
  margin: 0 0 var(--gap);
  padding: 9px 12px;
  border-radius: 8px;
  font-size: var(--fs-sm);
}
.alert.error { background: #fef2f2; color: var(--c-bad-text); }
.alert.ok { background: #f0fdf4; color: var(--c-ok-text); }
.loading { padding: 24px; color: var(--c-muted); font-size: var(--fs-sm); text-align: center; }

/* ===== Summary cards (also act as filters) ===== */
.stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--gap);
  margin-bottom: var(--gap);
}
.stat {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: var(--pad);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.stat:hover { border-color: var(--c-primary); }
.stat.active { border-color: var(--c-primary); background: var(--c-primary-soft); }
.stat-ico {
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
}
.stat-ico.blue { background: #dbeafe; color: #1d4ed8; }
.stat-ico.red { background: var(--c-bad-soft); color: var(--c-bad-text); }
.stat-body { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.stat-label {
  overflow: hidden;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-value { font-size: var(--fs-big); font-weight: 700; line-height: 1.15; }
.stat-ctx {
  overflow: hidden;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Card: ONE card + header for every section ===== */
.card {
  min-width: 0;
  margin-bottom: var(--gap);
  padding: var(--pad);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.card-head h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: var(--fs-title);
  font-weight: 700;
}
.card-head p { margin: 2px 0 0; color: var(--c-muted); font-size: var(--fs-xs); }
.count {
  padding: 1px 7px;
  border-radius: 99px;
  background: #f1f5f9;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.more {
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
.more:hover { text-decoration: underline; }

/* ===== Tables ===== */
.tbl-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.tbl th {
  padding: 7px 8px;
  border-bottom: 1px solid var(--c-line);
  background: #fafbfc;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.4px;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}
.tbl td {
  padding: 8px;
  border-bottom: 1px solid var(--c-line);
  color: #475569;
  vertical-align: middle;
  white-space: nowrap;
}
.tbl td.wrap { white-space: normal; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl .col-act { width: 1%; text-align: right; }
.strong { color: var(--c-text); font-weight: 600; }

.person { display: flex; align-items: center; gap: 8px; }
.person b { color: var(--c-text); font-weight: 600; }
.av {
  display: grid;
  place-items: center;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: var(--fs-xs);
  font-weight: 700;
}

.doc-link { color: var(--c-primary); text-decoration: none; }
.doc-link:hover { text-decoration: underline; }
.muted-text { color: var(--c-faint); font-size: var(--fs-xs); }

/* status chips: green = done, blue = in progress, amber = pending, red = urgent */
.chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  white-space: nowrap;
}
.chip.green { background: var(--c-ok-soft); color: var(--c-ok-text); }
.chip.blue { background: #dbeafe; color: #1d4ed8; }
.chip.amber { background: var(--c-warn-soft); color: var(--c-warn-text); }
.chip.red { background: var(--c-bad-soft); color: var(--c-bad-text); }

/* ===== Buttons + selects: one size, one look ===== */
.btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--c-primary);
  border-radius: 6px;
  background: var(--c-primary);
  color: #fff;
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.btn:hover { filter: brightness(0.94); }
.btn.ghost { border-color: var(--c-border); background: #fff; color: var(--c-text); }
.btn.ghost:hover { border-color: var(--c-primary); color: var(--c-primary); filter: none; }
.btn.ok { border-color: var(--c-ok); background: var(--c-ok); }
.btn.bad { border-color: var(--c-bad); background: var(--c-bad); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
.row-actions { display: inline-flex; gap: 6px; justify-content: flex-end; }

.select {
  height: 28px;
  padding: 0 8px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #fff;
  color: #344054;
  font: inherit;
  font-size: var(--fs-xs);
  cursor: pointer;
}
.select.approver { min-width: 150px; }

/* ===== Empty state (same look in every card) ===== */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 0 8px;
  color: var(--c-faint);
}
.empty .svg { width: 22px; height: 22px; stroke-width: 1.6; }
.empty p { margin: 0; color: var(--c-muted); font-size: var(--fs-sm); text-align: center; }

/* ===== Responsive ===== */
@media (max-width: 1350px) {
  .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 800px) {
  .tasks-header { flex-direction: column; }
  .header-actions { width: 100%; }
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .tasks-page { padding: 16px; }
  .stats { grid-template-columns: 1fr; }
  .date-box { flex: 1; }
  .create-btn { flex: 1; justify-content: center; }
}
</style>