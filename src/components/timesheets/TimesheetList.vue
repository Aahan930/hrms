<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  timesheets: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyMessage: {
    type: String,
    default: 'No timesheets found.'
  }
})

const emit = defineEmits(['open'])
const route = useRoute()

const search = ref('')
const statusFilter = ref(
  route.query.status === 'Draft' ? 'Draft' : 'All'
)
const page = ref(1)
const pageSize = 8

function getStatus(item) {
  const status =
    item.workflow_state ||
    item.status ||
    (item.docstatus === 2
      ? 'Cancelled'
      : item.docstatus === 1
        ? 'Submitted'
        : 'Draft')

  if (status === 'Approved') {
    return 'Submitted'
  }

  return status
}

function statusClass(item) {
  const status = getStatus(item).toLowerCase()

  if (status === 'approved') return 'approved'
  if (status === 'pending') return 'pending'
  if (status === 'submitted') return 'submitted'
  if (status === 'rejected') return 'rejected'
  if (status === 'cancelled') return 'cancelled'

  return 'draft'
}

function formatHours(value) {
  const hours = Number(value)

  if (!Number.isFinite(hours) || hours <= 0) {
    return '0m'
  }

  const totalMinutes = Math.round(hours * 60)
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (wholeHours && minutes) {
    return `${wholeHours}h ${minutes}m`
  }

  if (wholeHours) {
    return `${wholeHours}h`
  }

  return `${minutes}m`
}

function formatDate(value) {
  if (!value) return '—'

  const datePart = String(value).slice(0, 10)
  const parts = datePart.split('-')

  if (parts.length !== 3) return String(value)

  const [year, month, day] = parts.map(Number)
  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return String(value)
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const statusOptions = computed(() => [
  'All',
  ...new Set(props.timesheets.map(getStatus))
])

const filteredTimesheets = computed(() => {
  const query = search.value.trim().toLowerCase()

  return props.timesheets.filter(item => {
    const matchesStatus =
      statusFilter.value === 'All' ||
      getStatus(item) === statusFilter.value

    const searchableText = [
      item.name,
      item.employee_name,
      item.start_date,
      item.end_date,
      getStatus(item)
    ].filter(Boolean).join(' ').toLowerCase()

    return matchesStatus &&
      (!query || searchableText.includes(query))
  })
})

const pageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(filteredTimesheets.value.length / pageSize)
  )
)

const visibleTimesheets = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredTimesheets.value.slice(
    start,
    start + pageSize
  )
})

const firstResult = computed(() =>
  filteredTimesheets.value.length
    ? (page.value - 1) * pageSize + 1
    : 0
)

const lastResult = computed(() =>
  Math.min(
    page.value * pageSize,
    filteredTimesheets.value.length
  )
)

watch([search, statusFilter], () => {
  page.value = 1
})

watch(
  () => route.query.status,
  status => {
    statusFilter.value = status === 'Draft' ? 'Draft' : 'All'
  }
)

watch(pageCount, count => {
  if (page.value > count) page.value = count
})
</script>

<template>
  <section
    class="timesheet-panel"
    aria-label="Timesheet records"
  >
    <div class="panel-header">
      <div>
        <span class="eyebrow">WORK RECORDS</span>
        <h2>Timesheet history</h2>
        <p>View your work hours and track approval status.</p>
      </div>

      <span class="record-count">
        {{ timesheets.length }} records
      </span>
    </div>

    <div v-if="!loading && timesheets.length" class="toolbar">
      <div class="search-field">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 5 5" />
        </svg>

        <input
          v-model="search"
          type="search"
          aria-label="Search timesheets"
          placeholder="Search ID, employee or date..."
        />
      </div>

      <div class="filter-field">
        <label for="timesheet-status">Status</label>

        <select
          id="timesheet-status"
          v-model="statusFilter"
        >
          <option
            v-for="status in statusOptions"
            :key="status"
            :value="status"
          >
            {{ status === 'All' ? 'All statuses' : status }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="state">
      <span class="spinner" aria-hidden="true"></span>
      <strong>Loading timesheets</strong>
      <p>Fetching your latest work records...</p>
    </div>

    <div v-else-if="!timesheets.length" class="state">
      <div class="state-icon">▤</div>
      <strong>No timesheets yet</strong>
      <p>{{ emptyMessage }}</p>
    </div>

    <div
      v-else-if="!filteredTimesheets.length"
      class="state"
    >
      <div class="state-icon">⌕</div>
      <strong>No matching records</strong>
      <p>Try a different search or status filter.</p>

      <button
        type="button"
        class="reset-button"
        @click="search = ''; statusFilter = 'All'"
      >
        Clear filters
      </button>
    </div>

    <template v-else>
      <div class="table-scroll">
        <table class="timesheet-table">
          <thead>
            <tr>
              <th scope="col">Timesheet</th>
              <th scope="col">Employee</th>
              <th scope="col">Period</th>
              <th scope="col">Work hours</th>
              <th scope="col">Status</th>
              <th scope="col" class="action-heading">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="item in visibleTimesheets"
              :key="item.name"
            >
              <td>
                <div class="record-identity">
                  <span class="record-icon">▤</span>

                  <div>
                    <strong>{{ item.name }}</strong>
                    <small>Timesheet record</small>
                  </div>
                </div>
              </td>

              <td class="employee-cell">
                {{ item.employee_name || '—' }}
              </td>

              <td>
                <div class="date-cell">
                  <strong>
                    {{ formatDate(item.start_date) }}
                  </strong>

                  <small>
                    to {{ formatDate(item.end_date) }}
                  </small>
                </div>
              </td>

              <td>
                <strong class="hours-cell">
                  {{ formatHours(item.total_hours) }}
                </strong>
              </td>

              <td>
                <span
                  class="status-badge"
                  :class="statusClass(item)"
                >
                  <span class="status-dot"></span>
                  {{ getStatus(item) }}
                </span>
              </td>

              <td class="action-cell">
                <button
                  type="button"
                  class="view-button"
                  :aria-label="`View timesheet ${item.name}`"
                  @click="emit('open', item.name)"
                >
                  View details
                  <span aria-hidden="true">→</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="table-footer">
        <span>
          Showing {{ firstResult }}–{{ lastResult }}
          of {{ filteredTimesheets.length }} records
        </span>

        <div
          v-if="pageCount > 1"
          class="pagination"
        >
          <button
            type="button"
            :disabled="page === 1"
            @click="page--"
          >
            Previous
          </button>

          <span>{{ page }} / {{ pageCount }}</span>

          <button
            type="button"
            :disabled="page === pageCount"
            @click="page++"
          >
            Next
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.timesheet-panel {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e1e8f2;
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
  color: #202d46;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 23px 24px 18px;
}

.eyebrow {
  color: #5664bc;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.2px;
}

.panel-header h2 {
  margin: 7px 0 5px;
  font-size: 18px;
  letter-spacing: -.4px;
}

.panel-header p {
  margin: 0;
  color: #78869c;
  font-size: 12px;
}

.record-count {
  padding: 7px 10px;
  border-radius: 7px;
  background: #f1f4fa;
  color: #62718a;
  font-size: 11px;
  white-space: nowrap;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px 20px;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  max-width: 340px;
  padding: 0 12px;
  border: 1px solid #dce4f1;
  border-radius: 9px;
  background: #fff;
}

.search-field:focus-within {
  border-color: #7772e8;
  box-shadow: 0 0 0 3px #eeedff;
}

.search-field svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #8391a7;
}

.search-field input {
  width: 100%;
  height: 39px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #202d46;
  font: inherit;
  font-size: 12px;
}

.filter-field {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-left: auto;
}

.filter-field label {
  color: #718098;
  font-size: 12px;
}

.filter-field select {
  height: 40px;
  min-width: 145px;
  padding: 0 10px;
  border: 1px solid #dce4f1;
  border-radius: 9px;
  background: #fff;
  color: #334155;
  font: inherit;
  font-size: 12px;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.timesheet-table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
  text-align: left;
}

.timesheet-table thead {
  background: #f8faff;
}

.timesheet-table th {
  padding: 14px 20px;
  border-top: 1px solid #e9edf5;
  border-bottom: 1px solid #e9edf5;
  color: #78869d;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .65px;
  text-transform: uppercase;
}

.timesheet-table td {
  padding: 16px 20px;
  border-bottom: 1px solid #edf1f7;
  color: #35445e;
  font-size: 12px;
}

.timesheet-table tbody tr:hover {
  background: #fafbff;
}

.record-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  background: #edf1ff;
  color: #4f5dcb;
  font-size: 18px;
}

.record-identity strong,
.date-cell strong {
  display: block;
  color: #22314d;
  font-size: 12px;
  font-weight: 700;
}

.record-identity small,
.date-cell small {
  display: block;
  margin-top: 5px;
  color: #8896ac;
  font-size: 11px;
}

.employee-cell {
  font-weight: 600;
}

.hours-cell {
  color: #22314d;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.approved {
  background: #e9f8ef;
  color: #13834e;
}

.pending {
  background: #fff3df;
  color: #a56816;
}

.submitted {
  background: #e9f1ff;
  color: #3568c7;
}

.draft {
  background: #f0edff;
  color: #6851b7;
}

.rejected,
.cancelled {
  background: #fff0f0;
  color: #c23c4b;
}

.action-heading,
.action-cell {
  text-align: right;
}

.view-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #dce2f7;
  border-radius: 8px;
  background: #fff;
  color: #4f46c8;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.view-button:hover {
  border-color: #a6a4f1;
  background: #f7f6ff;
}

.view-button:focus-visible,
.pagination button:focus-visible,
.reset-button:focus-visible {
  outline: 3px solid #aaa5ff;
  outline-offset: 2px;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 57px;
  padding: 12px 20px;
  color: #8190a6;
  font-size: 11px;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination button,
.reset-button {
  padding: 8px 12px;
  border: 1px solid #dce4f1;
  border-radius: 8px;
  background: #fff;
  color: #4f46c8;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.state {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  text-align: center;
}

.state strong {
  margin-top: 12px;
  font-size: 15px;
}

.state p {
  color: #8190a6;
  font-size: 12px;
}

.state-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 13px;
  background: #eef1ff;
  color: #554dd2;
  font-size: 25px;
}

.spinner {
  width: 27px;
  height: 27px;
  border: 3px solid #e8eafa;
  border-top-color: #554dd2;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 700px) {
  .panel-header {
    padding: 20px 16px;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    padding: 0 16px 18px;
  }

  .search-field {
    max-width: none;
    box-sizing: border-box;
  }

  .filter-field {
    justify-content: space-between;
    margin-left: 0;
  }

  .table-footer {
    flex-wrap: wrap;
    padding: 14px 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
</style>
