
<script setup>
import { computed } from 'vue'
import TimesheetDailySubmission from './TimesheetDailySubmission.vue'

const props = defineProps({
  isManager: {
    type: Boolean,
    default: false
  },
  timesheet: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  isManagerView: { type: Boolean, default: false },
  approving: { type: Boolean, default: false },
  rejecting: { type: Boolean, default: false }
})

const emit = defineEmits([
  'back',
  'edit',
  'submit',
  'submit-day',
  'approve',
  'reject'
])

const state = computed(
  () => props.timesheet?.workflow_state ||
    props.timesheet?.status ||
    'Draft'
)

const canEdit = computed(
  () =>
    !props.isManagerView &&
    state.value === 'Draft' &&
    props.timesheet?.docstatus === 0
)

const canReview = computed(
  () =>
    props.isManagerView &&
    state.value === 'Pending' &&
    props.timesheet?.docstatus === 0
)

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`
  )

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
}

function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(
    String(value).replace(' ', 'T')
  )

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
}

function formatHours(value) {
  const number = Number(value)

  if (!Number.isFinite(number) || number < 0) {
    return '0h'
  }

  const minutes = Math.round(number * 60)
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60

  return remaining
    ? `${hours}h ${remaining}m`
    : `${hours}h`
}
</script>

<template>
  <section class="detail-page">

    <button
      type="button"
      class="back-link"
      @click="emit('back')"
    >
      ← Back to timesheets
    </button>

    <div
      v-if="loading"
      class="loading"
      role="status"
    >
      Loading timesheet details…
    </div>

    <template v-else>

      <header class="detail-header">
        <div class="heading">
          <div class="eyebrow">
            WORK RECORD / TIMESHEET DETAIL
          </div>

          <h2>{{ timesheet.name }}</h2>

          <span
            class="status"
            :class="state.toLowerCase()"
          >
            ● {{ state === 'Approved' ? 'Submitted' : state }}
          </span>
        </div>

        <div class="actions">

          <button
            v-if="canEdit"
            type="button"
            class="btn secondary"
            @click="emit('edit', timesheet.name)"
          >
            Edit draft
          </button>

          <button
            v-if="canReview"
            type="button"
            class="btn danger"
            :disabled="approving || rejecting"
            @click="emit('reject', timesheet.name)"
          >
            {{
              rejecting
                ? 'Rejecting…'
                : 'Reject'
            }}
          </button>

          <button
            v-if="canReview"
            type="button"
            class="btn success"
            :disabled="approving || rejecting"
            @click="emit('approve', timesheet.name)"
          >
            {{
              approving
                ? 'Approving…'
                : 'Approve'
            }}
          </button>

        </div>
      </header>

      <div class="summary-grid">

        <div class="summary-cell">
          <span>EMPLOYEE</span>
          <strong>
            {{ timesheet.employee_name || '—' }}
          </strong>
        </div>

        <div class="summary-cell">
          <span>POSTING DATE</span>
          <strong>
            {{ formatDate(timesheet.start_date) }}
          </strong>
        </div>

        <div class="summary-cell total">
          <span>TOTAL WORK TIME</span>
          <strong>
            {{ formatHours(timesheet.total_hours) }}
          </strong>
        </div>

      </div>

      <section class="entries-section">

        <div class="section-heading">
          <div>
            <div class="eyebrow">
              ACTIVITY BREAKDOWN
            </div>
            <h3>Work entries</h3>
          </div>

          <span class="count">
            {{ timesheet.time_logs?.length || 0 }}
            {{
              timesheet.time_logs?.length === 1
                ? 'entry'
                : 'entries'
            }}
          </span>
        </div>

        <div
          v-if="!timesheet.time_logs?.length"
          class="empty"
        >
          No work entries recorded for this timesheet.
        </div>

        <TimesheetDailySubmission
          v-else
          :timesheet="timesheet"
          :submitting-date="submittingDate"
          @submit-day="emit('submit-day', $event)"
        />

      </section>

    </template>
  </section>
</template>

<style scoped>
.detail-page {
  background: var(--card, #fff);
  border: 1px solid var(--border, #e3e9f5);
  border-radius: 14px;
  padding: 26px;
  box-shadow: var(
    --shadow,
    0 4px 14px rgba(20, 38, 75, 0.04)
  );
  color: var(--text, #182744);
}

.back-link {
  border: 0;
  background: none;
  color: var(--accent, #4658d5);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  margin-bottom: 24px;
}

.back-link:hover {
  text-decoration: underline;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 25px;
  border-bottom: 1px solid var(--border, #e3e9f5);
}

.eyebrow {
  font-size: 10px;
  letter-spacing: 1.5px;
  font-weight: 800;
  color: #65769b;
  margin-bottom: 8px;
}

h2 {
  font-size: 25px;
  letter-spacing: -0.6px;
  margin: 0 0 12px;
}

h3 {
  font-size: 19px;
  margin: 0;
  letter-spacing: -0.35px;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 100px;
  background: #f1f3ff;
  color: #4856a9;
  font-size: 12px;
  font-weight: 700;
}

.status.approved {
  background: #e9f9f0;
  color: #16834a;
}

.status.pending {
  background: #fff6dd;
  color: #96600a;
}

.status.rejected {
  background: #fff0f0;
  color: #bf3434;
}

.status.draft {
  background: #f1f3ff;
  color: #4856a9;
}

.actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn {
  padding: 10px 14px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
  border: 1px solid transparent;
  transition: filter 0.15s;
}

.btn:hover {
  filter: brightness(0.96);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.primary {
  background: var(--accent, #4855dc);
  color: white;
}

.secondary {
  background: #fff;
  border-color: #dce3f4;
  color: #263b68;
}

.success {
  background: #16834a;
  color: #fff;
}

.danger {
  background: #fff2f2;
  border-color: #ffd4d4;
  color: #bd3434;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr;
  gap: 15px;
  margin: 25px 0;
}

.summary-cell {
  border: 1px solid #e6eaf4;
  border-radius: 11px;
  padding: 17px;
  min-width: 0;
  background: #fcfdff;
}

.summary-cell span {
  display: block;
  color: #73809b;
  font-size: 10px;
  letter-spacing: 1px;
  font-weight: 800;
  margin-bottom: 10px;
}

.summary-cell strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}

.summary-cell.total {
  background: #f0f4ff;
  border-color: #dce5ff;
}

.summary-cell.total strong {
  font-size: 24px;
  color: #2849ac;
  letter-spacing: -0.7px;
}

.entries-section {
  border: 1px solid var(--border, #e3e9f5);
  border-radius: 12px;
  overflow: hidden;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e8edf7;
}

.count {
  background: #f2f5fb;
  color: #63718b;
  border-radius: 100px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 730px;
  text-align: left;
}

th {
  background: #f8faff;
  color: #75829b;
  font-size: 10px;
  letter-spacing: 0.8px;
  padding: 13px 15px;
}

td {
  border-top: 1px solid #edf0f7;
  padding: 15px;
  font-size: 12px;
  color: #4c5b76;
}

td.activity,
td.hours {
  color: #1c2c4b;
  font-weight: 750;
}

.billable {
  display: inline-block;
  padding: 4px 9px;
  border-radius: 100px;
  background: #f1f3f7;
  color: #68758a;
  font-size: 11px;
  font-weight: 700;
}

.billable.yes {
  background: #e9f9f0;
  color: #16834a;
}

.empty,
.loading {
  text-align: center;
  padding: 45px 20px;
  color: #72809b;
  font-size: 13px;
}

@media (max-width: 850px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 580px) {
  .detail-page {
    padding: 17px;
  }

  .detail-header {
    flex-direction: column;
  }

  .actions {
    justify-content: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }

  .summary-cell {
    padding: 12px;
  }

  .summary-cell.total strong {
    font-size: 19px;
  }

  h2 {
    font-size: 21px;
  }
}
</style>