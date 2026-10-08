<script setup>
import { computed, ref } from 'vue'
import { useHrData } from '../../composables/useHrData'

const props = defineProps({
  item: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])
const hr = useHrData()
const advancing = ref(false)
const workflowError = ref('')

const currentStatus = computed(() => hr.normalizeOnboardingStatus(props.item))
const workflowSteps = computed(() => hr.ONBOARDING_WORKFLOW)
const currentStep = computed(() => workflowSteps.value.indexOf(currentStatus.value))
const nextStep = computed(() => workflowSteps.value[currentStep.value + 1] || null)

function close() {
  emit('close')
}

async function advanceWorkflow() {
  if (!props.item || !nextStep.value) return
  advancing.value = true
  workflowError.value = ''

  try {
    await hr.updateOnboardingStatus(props.item, nextStep.value)
  } catch (e) {
    workflowError.value = e.message || 'Unable to advance onboarding workflow.'
  } finally {
    advancing.value = false
  }
}

function openSourceRecord(item) {
  if (!item?.name) return

  window.open(
    `http://localhost:8000/app/employee-onboarding/${encodeURIComponent(item.name)}`,
    '_blank'
  )
}

function fmtDate(value) {
  if (!value) return '—'

  return new Date(String(value).slice(0, 10) + 'T00:00:00')
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
}
</script>

<template>
  <div v-if="item" class="modal-backdrop" @click.self="close">
    <aside
      class="detail-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-detail-title"
    >
      <header class="detail-header">
        <div>
          <p class="eyebrow">ONBOARDING</p>
          <h2 id="onboarding-detail-title">
            {{ item.employee_name || item.name }}
          </h2>
          <p class="record-id">{{ item.name }}</p>
        </div>

        <button
          type="button"
          class="close-btn"
          aria-label="Close"
          @click="close"
        >
          ×
        </button>
      </header>

      <div class="detail-body">
        <section class="status-section">
          <span class="section-label">Status</span>

          <span
            class="status-chip"
            :class="{
              completed: currentStatus === 'Completed',
              progress: ['Verification', 'Pending Approval', 'Approved', 'Employee Created', 'HR Setup', 'IT Setup', 'Ready to Join', 'Joined'].includes(currentStatus),
              pending: !currentStatus || !['Completed', 'Verification', 'Pending Approval', 'Approved', 'Employee Created', 'HR Setup', 'IT Setup', 'Ready to Join', 'Joined'].includes(currentStatus)
            }"
          >
            {{ currentStatus }}
          </span>
        </section>

        <section class="info-section">
          <h3>Workflow</h3>
          <ol class="workflow-steps">
            <li
              v-for="(step, index) in workflowSteps"
              :key="step"
              :class="{
                done: index < currentStep,
                current: index === currentStep,
                future: index > currentStep
              }"
            >
              <span class="workflow-dot"></span>
              <span>{{ step }}</span>
            </li>
          </ol>
          <p v-if="workflowError" class="workflow-error">{{ workflowError }}</p>
        </section>

        <section class="info-section">
          <h3>Employee Details</h3>

          <div class="info-grid">
            <div class="info-item">
              <span>Employee</span>
              <strong>{{ item.employee_name || '—' }}</strong>
            </div>

            <div class="info-item">
              <span>Position</span>
              <strong>{{ item.designation || '—' }}</strong>
            </div>

            <div class="info-item">
              <span>Date of Joining</span>
              <strong>{{ fmtDate(item.date_of_joining) }}</strong>
            </div>

            <div class="info-item">
              <span>Onboarding Begins</span>
              <strong>{{ fmtDate(item.onboarding_begins_on) }}</strong>
            </div>

            <div class="info-item">
              <span>Company</span>
              <strong>{{ item.company || '—' }}</strong>
            </div>

            <div class="info-item">
              <span>Job Offer</span>
              <strong>{{ item.job_offer || '—' }}</strong>
            </div>
          </div>
        </section>

        <section class="info-section">
          <h3>Onboarding Activities</h3>

          <div class="empty-activities">
            <span class="empty-icon">✓</span>
            <p>
              Activity details are managed in the Employee Onboarding record.
            </p>
          </div>
        </section>
      </div>

      <footer class="detail-footer">
        <button
          type="button"
          class="secondary-btn"
          @click="close"
        >
          Close
        </button>

        <button
          v-if="nextStep"
          type="button"
          class="primary-btn"
          :disabled="advancing"
          @click="advanceWorkflow"
        >
          {{ advancing ? 'Updating...' : `Advance to ${nextStep}` }}
        </button>

        <button
          type="button"
          class="primary-btn"
          @click="openSourceRecord(item)"
        >
          Open Source Record
        </button>
      </footer>
    </aside>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.32);
}

.detail-panel {
  width: min(520px, 100vw);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.16);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid #e8ebf2;
}

.eyebrow {
  margin: 0 0 6px;
  color: #4f46e5;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
}

.detail-header h2 {
  margin: 0;
  color: #172033;
  font-size: 20px;
}

.record-id {
  margin: 5px 0 0;
  color: #7a8496;
  font-size: 11px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f5f6f8;
  color: #667085;
  font-size: 20px;
  cursor: pointer;
}

.close-btn:hover {
  background: #eef2ff;
  color: #4f46e5;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.workflow-steps {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
  display: grid;
  gap: 8px;
}

.workflow-steps li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #667085;
  font-size: 12px;
}

.workflow-steps li.done {
  color: #15803d;
  font-weight: 600;
}

.workflow-steps li.current {
  color: #1d4ed8;
  font-weight: 700;
}

.workflow-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.workflow-error {
  margin: 10px 0 0;
  color: #b91c1c;
  font-size: 12px;
}

.status-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20px;
  border-bottom: 1px solid #eef0f4;
}

.section-label {
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}

.status-chip {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.status-chip.completed {
  background: #ecfdf3;
  color: #027a48;
}

.status-chip.progress {
  background: #eef4ff;
  color: #175cd3;
}

.status-chip.pending {
  background: #fff7e6;
  color: #b54708;
}

.info-section {
  margin-top: 24px;
}

.info-section h3 {
  margin: 0 0 14px;
  color: #172033;
  font-size: 13px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.info-item {
  padding: 12px;
  border: 1px solid #eef0f4;
  border-radius: 9px;
  background: #fafbfc;
}

.info-item span {
  display: block;
  margin-bottom: 5px;
  color: #7a8496;
  font-size: 10px;
}

.info-item strong {
  display: block;
  overflow: hidden;
  color: #344054;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-activities {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  border: 1px dashed #dfe3eb;
  border-radius: 10px;
  background: #fafbfc;
}

.empty-icon {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 8px;
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 700;
}

.empty-activities p {
  margin: 0;
  color: #7a8496;
  font-size: 11px;
  line-height: 1.5;
}

.detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px;
  border-top: 1px solid #e8ebf2;
}

.secondary-btn,
.primary-btn {
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.secondary-btn {
  border: 1px solid #dfe3eb;
  background: #ffffff;
  color: #475467;
}

.primary-btn {
  border: 1px solid #4f46e5;
  background: #4f46e5;
  color: #ffffff;
}

.secondary-btn:hover {
  background: #f8f9fc;
}

.primary-btn:hover {
  background: #4338ca;
}

@media (max-width: 600px) {
  .detail-panel {
    width: 100%;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}

</style>
