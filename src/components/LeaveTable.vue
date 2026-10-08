<script setup>
const emit = defineEmits(['withdraw', 'request-cancellation'])

defineProps({
  leaves: { type: Array, default: () => [] },
  pendingCancellations: { type: Array, default: () => [] }
})

function status(leave) {
  const value = leave.workflow_state || leave.status || 'Unknown'
  return value === 'Open' ? 'Pending' : value
}

function formatDate(value) {
  if (!value) return '—'

  const [year, month, day] = value.slice(0, 10).split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
}

function isFutureLeave(leave) {
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')

  return leave.from_date > today
}

function statusClass(value) {
  if (value === 'Approved') return 'approved'
  if (value === 'Rejected') return 'rejected'
  if (value === 'Withdrawn' || value === 'Cancelled') return 'withdrawn'
  return 'pending'
}
</script>

<template>
  <div class="leave-register">
    <div v-if="!leaves.length" class="empty-state">
      <div class="empty-icon">▤</div>
      <h3>No leave requests yet</h3>
      <p>Your submitted leave applications will appear here.</p>
    </div>

    <div v-else class="table-scroll">
      <table class="leave-table">
        <thead>
          <tr>
            <th>Leave details</th>
            <th>Duration</th>
            <th>Days</th>
            <th>Reason</th>
            <th>Status</th>
            <th class="actions-heading">Action</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="leave in leaves" :key="leave.name">
            <td>
              <div class="leave-type">{{ leave.leave_type }}</div>
              <div class="leave-reference">{{ leave.name }}</div>
            </td>

            <td>
              <div class="date-primary">{{ formatDate(leave.from_date) }}</div>
              <div class="date-secondary">
                to {{ formatDate(leave.to_date) }}
              </div>
            </td>

            <td>
              <span class="days-value">
                {{ leave.total_leave_days ?? '—' }}
              </span>
            </td>

            <td>
              <span
                class="reason-text"
                :title="leave.description || ''"
              >
                {{ leave.description || 'No reason provided' }}
              </span>
            </td>

            <td>
              <span :class="['status-badge', statusClass(status(leave))]">
                <span class="status-dot"></span>
                {{ status(leave) }}
              </span>
            </td>

            <td class="action-cell">
              <span
                v-if="pendingCancellations.includes(leave.name)"
                class="review-badge"
              >
                Cancellation pending
              </span>

              <button
                v-else-if="status(leave) === 'Pending'"
                type="button"
                class="table-action"
                @click.stop.prevent="emit('withdraw', leave)"
              >
                Withdraw
              </button>

              <button
                v-else-if="
                  status(leave) === 'Approved' &&
                  isFutureLeave(leave)
                "
                type="button"
                class="table-action"
                @click="emit('request-cancellation', leave)"
              >
                Request cancellation
              </button>

              <span v-else class="no-action">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer v-if="leaves.length" class="table-footer">
      Showing {{ leaves.length }} leave
      {{ leaves.length === 1 ? 'request' : 'requests' }}
    </footer>
  </div>
</template>

<style scoped>
.leave-register {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(23, 35, 59, .035);
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.leave-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  box-shadow: none;
  border-radius: 0;
}

.leave-table th {
  padding: 16px 20px !important;
  background: #f8fafc;
  border-bottom: 1px solid #e9edf4;
  color: #718096;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .8px;
  text-align: left;
  text-transform: uppercase;
}

.leave-table td {
  padding: 19px 20px !important;
  border-bottom: 1px solid #eef1f6;
  color: #344054;
  font-size: 12px;
  vertical-align: middle;
}

.leave-table tbody tr:last-child td {
  border-bottom: 0;
}

.leave-table tbody tr:hover {
  background: #fbfcff;
}

.leave-type {
  color: #26334b;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.leave-reference {
  margin-top: 5px;
  color: #98a3b5;
  font-size: 10px;
}

.date-primary {
  color: #344054;
  font-weight: 650;
  white-space: nowrap;
}

.date-secondary {
  margin-top: 5px;
  color: #8b96a8;
  font-size: 11px;
  white-space: nowrap;
}

.days-value {
  display: inline-grid;
  min-width: 29px;
  height: 29px;
  place-items: center;
  padding: 0 8px;
  border-radius: 8px;
  background: #f1f4f9;
  color: #46546c;
  font-weight: 750;
}

.reason-text {
  display: -webkit-box;
  max-width: 230px;
  overflow: hidden;
  color: #667085;
  line-height: 1.6;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.status-badge,
.review-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
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
  background: #eaf7ef;
  color: #18804c;
}

.pending {
  background: #fff5e6;
  color: #a66313;
}

.rejected {
  background: #fff0f0;
  color: #c43d3d;
}

.withdrawn {
  background: #f0f2f5;
  color: #697586;
}

.review-badge {
  background: #fff5e6;
  color: #a66313;
}

.actions-heading,
.action-cell {
  text-align: right !important;
}

.table-action {
  padding: 8px 11px;
  border: 1px solid #dbe2ee;
  border-radius: 8px;
  background: #fff;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.table-action:hover {
  border-color: #c7d2fe;
  background: #f5f6ff;
}

.no-action {
  color: #b0b9c8;
}

.table-footer {
  padding: 14px 20px;
  border-top: 1px solid #eef1f6;
  color: #8994a6;
  font-size: 11px;
}

.empty-state {
  padding: 65px 20px;
  text-align: center;
}

.empty-icon {
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  margin: 0 auto 15px;
  border-radius: 14px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 25px;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #26334b;
  font-size: 16px;
}

.empty-state p {
  margin: 0;
  color: #8994a6;
  font-size: 12px;
}
</style>
