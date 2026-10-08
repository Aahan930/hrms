<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../../api'

const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const error = ref('')

const applicants = ref([])
const offers = ref([])
const companies = ref([])

const form = ref({
  job_applicant: '',
  job_offer: '',
  company: '',
  employee_name: '',
  date_of_joining: '',
  boarding_begins_on: ''
})

const selectedApplicant = computed(() =>
  applicants.value.find(
    item => item.name === form.value.job_applicant
  ) || null
)

const selectedOffer = computed(() =>
  offers.value.find(
    item => item.name === form.value.job_offer
  ) || null
)

function setEmployeeName() {
  form.value.employee_name =
    selectedOffer.value?.applicant_name ||
    selectedApplicant.value?.applicant_name ||
    ''
}

function setJoiningDate() {
  if (
    selectedOffer.value?.offer_date &&
    !form.value.date_of_joining
  ) {
    form.value.date_of_joining = selectedOffer.value.offer_date
  }

  if (
    !form.value.boarding_begins_on &&
    form.value.date_of_joining
  ) {
    form.value.boarding_begins_on = form.value.date_of_joining
  }
}

function onApplicantChange() {
  const matchingOffer = offers.value.find(
    offer => offer.job_applicant === form.value.job_applicant
  )

  form.value.job_offer = matchingOffer?.name || ''

  setEmployeeName()
  setJoiningDate()
}

function onOfferChange() {
  if (selectedOffer.value?.job_applicant) {
    form.value.job_applicant = selectedOffer.value.job_applicant
  }

  setEmployeeName()
  setJoiningDate()
}

function onJoiningDateChange() {
  if (!form.value.boarding_begins_on) {
    form.value.boarding_begins_on = form.value.date_of_joining
  }
}

async function loadOptions() {
  loading.value = true
  error.value = ''

  try {
    const [
      applicantResponse,
      offerResponse,
      companyResponse
    ] = await Promise.all([
      api.get('/api/resource/Job Applicant', {
        params: {
          fields: JSON.stringify([
            'name',
            'applicant_name',
            'email_id'
          ]),
          limit_page_length: 50,
          order_by: 'creation desc'
        }
      }),

      api.get('/api/resource/Job Offer', {
        params: {
          fields: JSON.stringify([
            'name',
            'job_applicant',
            'applicant_name',
            'offer_date'
          ]),
          limit_page_length: 50,
          order_by: 'creation desc'
        }
      }),

      api.get('/api/resource/Company', {
        params: {
          fields: JSON.stringify(['name']),
          limit_page_length: 50,
          order_by: 'name asc'
        }
      })
    ])

    applicants.value = applicantResponse.data?.data || []
    offers.value = offerResponse.data?.data || []
    companies.value = companyResponse.data?.data || []

    if (companies.value.length === 1) {
      form.value.company = companies.value[0].name
    }

    if (offers.value.length) {
      form.value.job_offer = offers.value[0].name
      onOfferChange()
    }
  } catch (e) {
    error.value = errMsg(
      e,
      'Unable to load onboarding options.'
    )
  } finally {
    loading.value = false
  }
}

async function createOnboarding(submit = false) {
  error.value = ''

  const requiredFields = [
    form.value.job_applicant,
    form.value.job_offer,
    form.value.company,
    form.value.employee_name,
    form.value.date_of_joining,
    form.value.boarding_begins_on
  ]

  if (requiredFields.some(value => !value)) {
    error.value =
      'Please complete all required onboarding fields.'
    return
  }

  saving.value = true

  try {
    const response = await api.post(
      '/api/resource/Employee Onboarding',
      {
        job_applicant: form.value.job_applicant,
        job_offer: form.value.job_offer,
        company: form.value.company,
        employee_name: form.value.employee_name,
        date_of_joining: form.value.date_of_joining,
        boarding_begins_on: form.value.boarding_begins_on,
        boarding_status: 'Created',
        workflow_state: 'Created'
      }
    )

    const createdName = response.data?.data?.name

    if (!createdName) {
      throw new Error(
        'Onboarding record was created but no record name was returned.'
      )
    }

    if (submit) {
      await api.put(
        `/api/resource/Employee Onboarding/${encodeURIComponent(createdName)}`,
        {
          docstatus: 1
        }
      )
    }

    router.push('/hr-tasks')
  } catch (e) {
    error.value = errMsg(
      e,
      'Unable to create the onboarding record.'
    )
  } finally {
    saving.value = false
  }
}

async function saveDraft() {
  await createOnboarding(false)
}

async function submitOnboarding() {
  await createOnboarding(true)
}

onMounted(loadOptions)
</script>

<template>
  <main class="onboarding-page">
    <section
      class="form-panel"
      aria-labelledby="onboarding-form-title"
    >
      <header class="form-header">
        <div>
          <p class="eyebrow">NEW ONBOARDING</p>

          <h2 id="onboarding-form-title">
            Create Employee Onboarding
          </h2>

          <p>
            Set up the onboarding record before adding activities.
          </p>
        </div>

        <button
          type="button"
          class="close-btn"
          aria-label="Back to HR Tasks"
          @click="router.push('/hr-tasks')"
        >
          ×
        </button>
      </header>

      <div class="form-body">
        <div
          v-if="loading"
          class="state-box"
        >
          Loading onboarding options...
        </div>

        <div
          v-if="error"
          class="alert error"
        >
          {{ error }}
        </div>

        <div
          v-if="!loading"
          class="form-grid"
        >
          <label class="field full">
            <span>Job Offer <b>*</b></span>

            <select
              v-model="form.job_offer"
              @change="onOfferChange"
            >
              <option value="">
                Select job offer
              </option>

              <option
                v-for="offer in offers"
                :key="offer.name"
                :value="offer.name"
              >
                {{ offer.name }} —
                {{ offer.applicant_name || offer.job_applicant }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>Job Applicant <b>*</b></span>

            <select
              v-model="form.job_applicant"
              @change="onApplicantChange"
            >
              <option value="">
                Select applicant
              </option>

              <option
                v-for="applicant in applicants"
                :key="applicant.name"
                :value="applicant.name"
              >
                {{ applicant.applicant_name || applicant.name }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>Company <b>*</b></span>

            <select v-model="form.company">
              <option value="">
                Select company
              </option>

              <option
                v-for="company in companies"
                :key="company.name"
                :value="company.name"
              >
                {{ company.name }}
              </option>
            </select>
          </label>

          <label class="field full">
            <span>Employee Name <b>*</b></span>

            <input
              v-model="form.employee_name"
              type="text"
              placeholder="Employee name"
            />
          </label>

          <label class="field">
            <span>Date of Joining <b>*</b></span>

            <input
              v-model="form.date_of_joining"
              type="date"
              @change="onJoiningDateChange"
            />
          </label>

          <label class="field">
            <span>Onboarding Begins On <b>*</b></span>

            <input
              v-model="form.boarding_begins_on"
              type="date"
            />
          </label>
        </div>
      </div>

      <footer class="form-footer">
        <button
          type="button"
          class="secondary-btn"
          :disabled="saving"
          @click="router.push('/hr-tasks')"
        >
          Cancel
        </button>

        <button
          type="button"
          class="secondary-btn"
          :disabled="loading || saving"
          @click="saveDraft"
        >
          {{ saving ? 'Saving...' : 'Save Draft' }}
        </button>

        <button
          type="button"
          class="primary-btn"
          :disabled="loading || saving"
          @click="submitOnboarding"
        >
          {{ saving ? 'Submitting...' : 'Submit Onboarding' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.onboarding-page {
  min-height: 100%;
  padding: 24px;
  box-sizing: border-box;
  background: #f7f8fc;
}

.form-panel {
  width: min(100%, 1100px);
  min-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
}

.form-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border-bottom: 1px solid #e8ebf2;
}

.eyebrow {
  margin: 0 0 6px;
  color: #4f46e5;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.form-header h2 {
  margin: 0;
  color: #172033;
  font-size: 20px;
}

.form-header p:last-child {
  margin: 6px 0 0;
  color: #7a8496;
  font-size: 12px;
}

.close-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  background: #f5f6f9;
  color: #667085;
  font-size: 20px;
  cursor: pointer;
}

.form-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field.full {
  grid-column: 1 / -1;
}

.field span {
  color: #475467;
  font-size: 11px;
  font-weight: 700;
}

.field b {
  color: #dc2626;
}

.field input,
.field select {
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 9px 11px;
  border: 1px solid #dfe3eb;
  border-radius: 8px;
  background: #ffffff;
  color: #172033;
  font: inherit;
  font-size: 12px;
  outline: none;
}

.field input:focus,
.field select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.state-box {
  padding: 20px;
  border: 1px dashed #dfe3eb;
  border-radius: 10px;
  color: #7a8496;
  font-size: 12px;
}

.alert.error {
  margin-bottom: 18px;
  padding: 11px 13px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 11px;
}

.form-footer {
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

.secondary-btn:disabled,
.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field.full {
    grid-column: auto;
  }
}
</style>
