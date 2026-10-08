<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import api, { errMsg, isManager } from '../../api'
import TimesheetEntry from './TimesheetEntry.vue'
import TimesheetDailyEntries from './TimesheetDailyEntries.vue'

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  saving: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create'
  },
  initialEntries: {
    type: Array,
    default: () => []
  },
  employeeName: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: ''
  },
  submittedDates: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:form',
  'submit',
  'cancel'
])

const activityTypes = ref([])
const activityLoading = ref(false)
const activityError = ref('')

const managerView = isManager()

const showActivityModal = ref(false)
const newActivityType = ref('')
const activitySaving = ref(false)
const activityCreateError = ref('')

const validationError = ref('')
const attemptedSubmit = ref(false)

function emptyEntry(date = '') {
  return {
    name: null,
    date,
    activity_type: '',
    project: '',
    deliverables: '',
    description: '',
    hours: 0
  }
}

function normalizeEntry(entry) {
  let date = entry.date || ''

  if (!date && entry.from_time) {
    date = String(entry.from_time).slice(0, 10)
  }

  return {
    name: entry.name || null,
    date,
    activity_type: entry.activity_type || '',
    project: entry.project || '',
    deliverables: entry.deliverables || '',
    description: entry.description || '',
    hours: Number(entry.hours) || 0
  }
}
const entries = ref([emptyEntry()])

function hasEntryData(entry) {
  return Boolean(
    entry.activity_type ||
    entry.project ||
    entry.deliverables ||
    entry.description ||
    (Number(entry.hours) || 0) > 0
  )
}

watch(
  [
    () => props.mode,
    () => props.initialEntries,
    () => props.form?.start_date,
    () => props.submittedDates
  ],
  () => {
    if (
      props.mode === 'edit' &&
      props.initialEntries.length
    ) {
      entries.value =
        props.initialEntries.map(normalizeEntry)
    } else {
      const postingDate =
        props.form?.start_date || ''

      entries.value =
        postingDate &&
        !props.submittedDates.includes(postingDate)
          ? [emptyEntry(postingDate)]
          : [emptyEntry('')]
    }

    validationError.value = ''
    attemptedSubmit.value = false
  },
  { immediate: true }
)

const totalHours = computed(() =>
  entries.value.reduce(
    (sum, entry) =>
      sum + (Number(entry.hours) || 0),
    0
  )
)

function formatHours(value) {
  const totalMinutes = Math.max(
    0,
    Math.round((Number(value) || 0) * 60)
  )

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return minutes
    ? `${hours}h ${minutes}m`
    : `${hours}h`
}

const formattedTotal = computed(() =>
  formatHours(totalHours.value)
)

const entryCount = computed(() => entries.value.length)

function updateEntry(index, field, value) {
  const current = entries.value[index]
  if (!current) return

  entries.value[index] = {
    ...current,
    [field]: value
  }

  if (attemptedSubmit.value) {
    validateEntries()
  }
}

function addEntry(date = '') {
  const rowDate =
    date ||
    props.form?.start_date ||
    ''

  if (!rowDate) {
    validationError.value =
      'Please select a Posting Date first.'
    return
  }

  if (props.submittedDates.includes(rowDate)) {
    validationError.value =
      'This date has already been submitted and cannot be added again.'
    return
  }

  entries.value.push(emptyEntry(rowDate))
  validationError.value = ''
}

function removeEntry(index) {
  if (entries.value.length > 1) {
    entries.value.splice(index, 1)
  }

  if (attemptedSubmit.value) {
    validateEntries()
  }
}

function validateEntries() {
  validationError.value = ''

  const activeEntries = entries.value.filter(hasEntryData)

  if (!activeEntries.length) {
    validationError.value =
      'Add at least one work entry.'
    return false
  }

  for (let index = 0; index < activeEntries.length; index++) {
    const entry = activeEntries[index]
    const number = index + 1

    if (!entry.activity_type) {
      validationError.value =
        `Entry ${number}: select an activity type.`
      return false
    }

    if (!entry.hours || entry.hours <= 0) {
      validationError.value =
        `Entry ${number}: enter valid hours.`
      return false
    }
  }

  return true
}
async function loadActivityTypes() {
  activityLoading.value = true
  activityError.value = ''

  try {
    const response = await api.get(
      '/api/resource/Activity Type',
      {
        params: {
          fields: JSON.stringify(['name']),
          filters: JSON.stringify([
            ['disabled', '=', 0]
          ]),
          order_by: 'name asc',
          limit_page_length: 100
        }
      }
    )

    activityTypes.value = response.data.data || []
  } catch (error) {
    activityError.value = errMsg(
      error,
      'Could not load activity types'
    )
  } finally {
    activityLoading.value = false
  }
}

async function createActivityType() {
  activityCreateError.value = ''

  const name = newActivityType.value.trim()

  if (!name) {
    activityCreateError.value =
      'Please enter an activity type.'
    return
  }

  if (activitySaving.value) return

  activitySaving.value = true

  try {
    await api.post(
      '/api/resource/Activity Type',
      { activity_type: name }
    )

    await loadActivityTypes()

    const firstEmpty = entries.value.findIndex(
      entry => !entry.activity_type
    )

    updateEntry(
      firstEmpty === -1 ? 0 : firstEmpty,
      'activity_type',
      name
    )

    newActivityType.value = ''
    showActivityModal.value = false
  } catch (error) {
    activityCreateError.value = errMsg(
      error,
      'Could not create activity type'
    )
  } finally {
    activitySaving.value = false
  }
}

function updatePostingDate(date) {
  if (
    date &&
    props.submittedDates.includes(date)
  ) {
    validationError.value =
      'This date has already been submitted. Please choose another date.'
    return
  }

  emit(
    'update:form',
    {
      ...props.form,
      start_date: date,
      end_date: date
    }
  )

  validationError.value = ''
}

function submit(action = 'draft') {
  if (props.saving) return

  attemptedSubmit.value = true

  if (!validateEntries()) return

  emit(
    'submit',
    entries.value
      .filter(hasEntryData)
      .map(normalizeEntry),
    action
  )
}

onMounted(loadActivityTypes)
</script>

<template>
  <section class="timesheet-form">

    <header class="form-header">
      <button
        type="button"
        class="back-to-timesheets"
        aria-label="Back"
        title="Back"
        :disabled="saving"
        @click="emit('cancel')"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      <div>
        <span class="eyebrow">
          TIMESHEET
        </span>

        <h2>
          {{ mode === 'edit'
            ? 'Edit Timesheet'
            : 'Create Timesheet'
          }}
        </h2>

        <p>
          {{ mode === 'edit'
            ? 'Review and update your recorded work activities.'
            : 'Create and submit your daily timesheet.'
          }}
        </p>
      </div>

    </header>

    <section class="posting-date-section">

      <div class="week-period-block">
        <label>Posting Date</label>

        <div class="week-period-fields">
          <span class="week-period-calendar" aria-hidden="true">📅</span>

          <input
            type="date"
            :value="form.start_date"
            :disabled="saving"
            aria-label="Posting Date"
            @input="updatePostingDate($event.target.value)"
          />
        </div>
      </div>

      <div class="employee-info-field">
        <label>Employee</label>
        <div class="employee-info-value">
          {{ employeeName || '—' }}
        </div>
      </div>

      <div class="employee-info-field">
        <label>Department</label>
        <div class="employee-info-value">
          {{ department || '—' }}
        </div>
      </div>

    </section>

    <!-- Summary -->
    <div class="summary-grid">

      <div class="summary-card">
        <span class="summary-label">
          WORK ENTRIES
        </span>

        <strong>{{ entryCount }}</strong>

        <span class="summary-caption">
          {{ entryCount === 1
            ? 'Activity added'
            : 'Activities added'
          }}
        </span>
      </div>

      <div class="summary-card">
        <span class="summary-label">
          BILLABLE ENTRIES
        </span>

        <strong>{{ billableCount }}</strong>

        <span class="summary-caption">
          Marked as billable
        </span>
      </div>

      <div class="summary-card total-card">
        <span class="summary-label">
          TOTAL WORK TIME
        </span>

        <strong>{{ formattedTotal }}</strong>

        <span class="summary-caption">
          Across all entries
        </span>
      </div>

    </div>

    <!-- Daily Entries -->
    <section class="daily-entries-card">
      <div class="section-heading">
        <div>
          <h3>Time Sheets</h3>

          <p>
            Add an entry for every activity completed
            during your workday.
          </p>
        </div>

        <span class="entry-count">
          {{ entryCount }}
          {{ entryCount === 1 ? 'entry' : 'entries' }}
        </span>
      </div>

      <TimesheetDailyEntries
        :entries="entries"
        :start-date="form.start_date"
        :end-date="form.end_date"
        :saving="saving"
        :activity-types="activityTypes"
        :activity-loading="activityLoading"
        :manager-view="managerView"
        :activity-error="activityError"
        @update-entry="updateEntry"
        @remove-entry="removeEntry"
        @add-entry="addEntry"
        @create-activity="showActivityModal = true"
      />
    </section>

    <footer class="form-footer">
      <div class="form-actions">

        <button
          type="button"
          class="button button-secondary"
          :disabled="saving"
          @click="emit('cancel')"
        >
          Discard
        </button>

        <button
          v-if="mode !== 'edit'"
          type="button"
          class="button button-draft"
          :disabled="saving"
          @click="submit('draft')"
        >
          Save as Draft
        </button>

        <button
          type="button"
          class="button button-primary"
          :disabled="saving"
          @click="submit('submit')"
        >
          <span
            v-if="saving"
            class="spinner"
          ></span>

          {{
            saving
              ? 'Submitting...'
              : mode === 'edit'
                ? 'Save changes'
                : 'Submit Timesheet'
          }}
        </button>

      </div>
    </footer>

  </section>

  <!-- Create activity type modal -->
  <div
    v-if="showActivityModal"
    class="modal-overlay"
    @click.self="
      !activitySaving &&
      (showActivityModal = false)
    "
  >

    <section
      class="activity-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-modal-title"
    >

      <header class="modal-header">
        <div>
          <span class="section-eyebrow">
            ACTIVITY MANAGEMENT
          </span>

          <h3 id="activity-modal-title">
            Create activity type
          </h3>

          <p>
            Add a new activity for your timesheet entries.
          </p>
        </div>

        <button
          type="button"
          class="close-button"
          aria-label="Close dialog"
          :disabled="activitySaving"
          @click="showActivityModal = false"
        >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      </header>

      <form @submit.prevent="createActivityType">

        <label
          for="new-activity-type"
          class="field-label"
        >
          Activity name
        </label>

        <input
          id="new-activity-type"
          v-model="newActivityType"
          type="text"
          placeholder="e.g. Software Development"
          :disabled="activitySaving"
          maxlength="140"
          autocomplete="off"
        />

        <p class="field-hint">
          Choose a clear name that your team can recognize.
        </p>

        <p
          v-if="activityCreateError"
          class="modal-error"
          role="alert"
        >
          {{ activityCreateError }}
        </p>

        <div class="modal-actions">

          <button
            type="button"
            class="button button-secondary"
            :disabled="activitySaving"
            @click="showActivityModal = false"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="button button-primary"
            :disabled="activitySaving"
          >
            {{
              activitySaving
                ? 'Creating...'
                : 'Create activity'
            }}
          </button>

        </div>

      </form>

    </section>

  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

/* =========================================================
   MAIN FORM
   ========================================================= */

.timesheet-form {
  width: 100%;
  margin: 0 0 24px;
  padding: 0;
  overflow: hidden;

  background: #ffffff;
  border: 1px solid #dfe4ea;
  border-radius: 8px;

  color: #2f3742;
  box-shadow:
    0 1px 2px rgba(16, 24, 40, .03),
    0 4px 14px rgba(16, 24, 40, .025);
}

/* =========================================================
   HEADER
   ========================================================= */

.back-to-timesheets {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;

  min-height: 36px;
  padding: 8px 11px;

  border: 1px solid #d8dee6;
  border-radius: 8px;

  background: #ffffff;
  color: #52627b;

  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;

  cursor: pointer;
}

.back-to-timesheets:hover {
  background: #f5f7f9;
  border-color: #cbd3dc;
  color: #3f4f69;
}

.back-to-timesheets:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.back-to-timesheets svg {
  flex-shrink: 0;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 18px;

  padding: 20px 22px;

  background: #ffffff;
}

.form-header > div {
  min-width: 0;
}

.form-header .eyebrow {
  display: block;
  margin-bottom: 4px;

  color: #8a95a3;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .9px;
  text-transform: uppercase;
}

.form-header h2 {
  margin: 0;

  color: #2f3742;
  font-size: 22px;
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -.2px;
}

.form-header p {
  margin: 5px 0 0;

  color: #7b8794;
  font-size: 12px;
  line-height: 1.5;
}


/* =========================================================
   SUMMARY
   ========================================================= */

.summary-grid {
  display: none;
}

/* =========================================================
   POSTING DATE
   ========================================================= */

.posting-date-section {
  width: 240px;
  margin: 0 22px 12px;
}

.posting-date-section label {
  display: block;
  margin-bottom: 6px;

  color: #768293;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .35px;
  text-transform: uppercase;
}

.posting-date-section input {
  width: 100%;
  height: 38px;
  padding: 7px 9px;

  border: 1px solid #d5dce4;
  border-radius: 5px;

  background: #fff;
  color: #303846;

  font: inherit;
  font-size: 12px;
}


.posting-date-section {
  display: grid;
  grid-template-columns: 1.15fr 1.5fr 1.5fr;
  align-items: end;
  gap: 14px;
}

.week-period-block {
  min-width: 0;
}

/* WEEK PERIOD */
.week-period-fields {
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  padding: 0 9px;
  box-sizing: border-box;

  border: 1px solid #d9e0ea;
  border-radius: 5px;

  background: #ffffff;
}

.week-period-calendar {
  flex: 0 0 auto;
  margin-right: 7px;
  font-size: 12px;
  line-height: 1;
}

.week-period-fields input {
  flex: 1 1 0;
  width: 100% !important;
  min-width: 0;
  height: 100%;

  padding: 0 !important;

  border: 0 !important;
  border-radius: 0;

  background: transparent !important;
  color: #303846;

  font: inherit;
  font-size: 11px;

  box-sizing: border-box;
}

.week-period-fields input:focus {
  outline: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

.week-period-fields input::-webkit-calendar-picker-indicator {
  opacity: 1;
  cursor: pointer;
}

.week-period-separator {
  flex: 0 0 auto;
  padding: 0 8px;

  color: #7a8799;
  font-size: 13px;
  font-weight: 600;
}

.posting-date-section input:focus {
  outline: none;
  border-color: #7899b8;
  box-shadow: 0 0 0 2px rgba(63, 111, 159, .08);
}

/* =========================================================
   SECTION HEADER
   ========================================================= */

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;

  padding: 0 22px 12px;
  margin: 0;
}

.section-heading > div {
  min-width: 0;
}

.section-heading .section-eyebrow {
  display: block;
  margin-bottom: 3px;

  color: #8a95a3;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .85px;
  text-transform: uppercase;
}

.section-heading h3 {
  margin: 0;

  color: #303846;
  font-size: 17px;
  line-height: 1.3;
  font-weight: 600;
}

.section-heading p {
  margin: 4px 0 0;

  color: #8994a2;
  font-size: 12px;
}

.entry-count {
  flex-shrink: 0;

  padding: 5px 9px;

  border: 1px solid #e0e5eb;
  border-radius: 5px;

  background: #f7f8fa;
  color: #7b8794;

  font-size: 10px;
  font-weight: 600;
}

/* =========================================================
   TABLE / ENTRY AREA
   ========================================================= */

.entries-list {
  display: block;

  margin: 0 22px;

  overflow: hidden;

  border: 1px solid #dfe4ea;
  border-radius: 6px;

  background: #ffffff;
}

/*
 * Each TimesheetEntry is visually turned into a compact row.
 * Business logic remains in TimesheetEntry.vue.
 */

.entries-list :deep(.entry-card) {
  position: relative;

  padding: 0;

  border: 0;
  border-bottom: 1px solid #e6eaf0;
  border-radius: 0;

  background: #ffffff;
}

.entries-list :deep(.entry-card:last-child) {
  border-bottom: 0;
}

/* Hide individual "Work Entry 1" headers. */

.entries-list :deep(.entry-header) {
  display: none;
}

/* Compact row */

.entries-list :deep(.form-grid) {
  display: grid;

  grid-template-columns:
    minmax(150px, 1.25fr)
    minmax(135px, 1fr)
    minmax(155px, 1.05fr)
    minmax(155px, 1.05fr)
    90px
    82px;

  gap: 0;

  align-items: stretch;
}

/* First row acts like the table header + input row */

.entries-list :deep(.entry-card:first-child) {
  background: #fbfcfd;
}

.entries-list :deep(.entry-card:first-child .form-field) {
  background: #fbfcfd;
}

/* Hide repeated labels after first row for a cleaner table look */

.entries-list :deep(.entry-card:not(:first-child) .form-field label) {
  display: none;
}

.entries-list :deep(.entry-card:not(:first-child) .form-field) {
  justify-content: center;
}

/* Cells */

.entries-list :deep(.form-field) {
  min-width: 0;

  display: flex;
  flex-direction: column;
  gap: 6px;

  padding: 10px 10px;

  border-right: 1px solid #e7ebf0;
}

.entries-list :deep(.form-field:last-child) {
  border-right: 0;
}

/* Labels */

.entries-list :deep(.form-field label) {
  color: #7c8794;

  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;

  letter-spacing: .35px;
  text-transform: uppercase;
}

/* Inputs / selects */

.entries-list :deep(.form-field input),
.entries-list :deep(.form-field select) {
  width: 100%;
  min-width: 0;
  height: 36px;

  padding: 7px 9px;

  border: 1px solid #d5dce4;
  border-radius: 5px;

  background: #ffffff;
  color: #303846;

  font-family: inherit;
  font-size: 12px;

  transition:
    border-color .15s ease,
    box-shadow .15s ease,
    background .15s ease;
}

.entries-list :deep(.form-field input::placeholder) {
  color: #a0a9b5;
}

.entries-list :deep(.form-field input:focus),
.entries-list :deep(.form-field select:focus) {
  outline: none;

  border-color: #7e9fbd;

  box-shadow:
    0 0 0 2px rgba(76, 119, 157, .08);
}

.entries-list :deep(.form-field input:hover),
.entries-list :deep(.form-field select:hover) {
  border-color: #c2cad3;
}

.entries-list :deep(.form-field select:disabled) {
  background: #f4f6f8;
  color: #949daa;
  cursor: not-allowed;
}

/* Project helper */

.entries-list :deep(.create-activity-btn) {
  align-self: flex-start;

  margin-top: 1px;
  padding: 0;

  border: 0;
  background: transparent;

  color: #3f6f9f;

  font-size: 10px;
  font-weight: 600;

  cursor: pointer;
}

.entries-list :deep(.create-activity-btn:hover) {
  text-decoration: underline;
}

/* Errors */

.entries-list :deep(.activity-error) {
  color: #b54747;
  font-size: 10px;
  line-height: 1.35;
}

/* Billable */

.entries-list :deep(.checkbox-field) {
  justify-content: center;
  align-items: center;
}

.entries-list :deep(.checkbox-field label) {
  display: flex;

  align-items: center;
  justify-content: center;
  gap: 6px;

  margin: 0;

  color: #596575;

  font-size: 10px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

.entries-list :deep(.checkbox-field input) {
  width: 14px;
  height: 14px;
  margin: 0;

  accent-color: #4b7197;
}

/* =========================================================
   ADD ROW
   ========================================================= */

.add-entry-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  margin: 12px 22px 16px;
  padding: 0;

  border: 0;
  background: transparent;

  color: #3f6f9f;

  font-size: 12px;
  font-weight: 600;

  cursor: pointer;
}

.add-entry-button:hover {
  text-decoration: underline;
}

.add-entry-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.add-icon {
  display: inline-grid;
  place-items: center;

  width: 17px;
  height: 17px;

  font-size: 15px;
  line-height: 1;
}

/* =========================================================
   VALIDATION
   ========================================================= */

.validation-message {
  display: flex;
  align-items: flex-start;
  gap: 9px;

  margin: 0 22px 14px;
  padding: 10px 12px;

  border: 1px solid #efcaca;
  border-radius: 5px;

  background: #fff7f7;
  color: #984343;
}

.validation-icon {
  display: grid;
  place-items: center;

  width: 18px;
  height: 18px;
  flex-shrink: 0;

  border-radius: 50%;

  background: #f1c2c2;
  color: #8e3636;

  font-size: 10px;
  font-weight: 700;
}

.validation-message strong {
  display: block;
  font-size: 12px;
}

.validation-message p {
  margin: 3px 0 0;
  font-size: 11px;
  line-height: 1.4;
}

/* =========================================================
   FOOTER
   ========================================================= */

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  padding: 14px 22px;

  border-top: 1px solid #e4e8ed;

  background: #fafbfc;
}

.footer-summary {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.footer-summary span {
  color: #87919d;

  font-size: 9px;
  font-weight: 700;

  letter-spacing: .65px;
  text-transform: uppercase;
}

.footer-summary strong {
  color: #303846;

  font-size: 15px;
  font-weight: 600;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.button {
  min-height: 34px;

  padding: 0 13px;

  border-radius: 5px;

  font-family: inherit;
  font-size: 12px;
  font-weight: 600;

  cursor: pointer;

  transition:
    background .15s ease,
    border-color .15s ease,
    opacity .15s ease;
}

.button-secondary {
  border: 1px solid #d5dce4;

  background: #ffffff;
  color: #596575;
}

.button-secondary:hover {
  background: #f5f7f9;
  border-color: #c8d0da;
}

.button-primary {
  border: 1px solid #416f9b;

  background: #416f9b;
  color: #ffffff;
}

.button-primary:hover {
  background: #38658e;
  border-color: #38658e;
}

.button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;

  width: 12px;
  height: 12px;
  margin-right: 6px;

  border: 2px solid rgba(255,255,255,.35);
  border-top-color: #ffffff;
  border-radius: 50%;

  animation: spin .7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =========================================================
   MODAL
   ========================================================= */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;

  display: grid;
  place-items: center;

  padding: 20px;

  background: rgba(24, 32, 43, .35);
}

.activity-modal {
  width: min(440px, 100%);

  padding: 20px;

  border: 1px solid #dce2e8;
  border-radius: 7px;

  background: #ffffff;

  box-shadow:
    0 20px 50px rgba(0, 0, 0, .16);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;

  margin-bottom: 18px;
}

.modal-header h3 {
  margin: 0;

  color: #303846;
  font-size: 18px;
  font-weight: 600;
}

.modal-header p {
  margin: 4px 0 0;

  color: #7b8794;
  font-size: 12px;
}

.activity-modal .field-label {
  display: block;

  margin-bottom: 6px;

  color: #596575;

  font-size: 12px;
  font-weight: 600;
}

.activity-modal input {
  width: 100%;
  height: 36px;

  padding: 7px 9px;

  border: 1px solid #d5dce4;
  border-radius: 5px;

  font: inherit;
}

.activity-modal input:focus {
  outline: none;
  border-color: #7e9fbd;
  box-shadow: 0 0 0 2px rgba(76,119,157,.08);
}

.field-hint {
  margin: 6px 0 0;

  color: #8a95a3;
  font-size: 11px;
}

.modal-error {
  margin: 10px 0 0;

  color: #b54747;
  font-size: 11px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  margin-top: 18px;
}

/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (max-width: 1100px) {
  .entries-list :deep(.form-grid) {
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
  }

  .entries-list :deep(.form-field) {
    border-bottom: 1px solid #e7ebf0;
  }
}

@media (max-width: 760px) {
  .form-header,
  .section-heading,
  .form-footer {
    padding-left: 14px;
    padding-right: 14px;
  }

  .entries-list {
    margin-left: 14px;
    margin-right: 14px;
  }

  .entries-list :deep(.form-grid) {
    grid-template-columns: 1fr;
  }

  .entries-list :deep(.form-field) {
    border-right: 0;
  }

  .entries-list :deep(.entry-card:not(:first-child) .form-field label) {
    display: block;
  }

  .add-entry-button,
  .validation-message {
    margin-left: 14px;
    margin-right: 14px;
  }

  .form-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .form-actions {
    width: 100%;
  }

  .form-actions .button {
    flex: 1;
  }
}

/* =========================================================
   FIELD ALIGNMENT OVERRIDES
   Keeps nested Project/DateTime components aligned
   with the native Timesheet fields.
   ========================================================= */

.entries-list :deep(.form-grid) {
  align-items: stretch;
}

/* Project + From/To Time are nested components, so give
   them the same cell treatment as native form fields. */

.entries-list :deep(.form-grid > .project-selector),
.entries-list :deep(.form-grid > .datetime-picker) {
  min-width: 0;
  min-height: 78px;
  padding: 10px;
  border-right: 1px solid #e7ebf0;
  background: #fff;

  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

/* Match the native field labels */

.entries-list :deep(.form-grid > .datetime-picker > label) {
  display: block;
  margin: 0 0 6px;

  color: #7c8794;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;

  letter-spacing: .35px;
  text-transform: uppercase;
}

/* Match Project selector label area */

.entries-list :deep(.form-grid > .project-selector) {
  padding-top: 10px;
}

.entries-list :deep(.form-grid > .project-selector::before) {
  content: "PROJECT";

  display: block;
  margin-bottom: 6px;

  color: #7c8794;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;

  letter-spacing: .35px;
}

/* Project select */

.entries-list :deep(.form-grid > .project-selector select) {
  width: 100%;
  height: 36px;
  min-height: 36px;

  padding: 7px 9px;

  border: 1px solid #d5dce4;
  border-radius: 5px;

  background: #fff;
  color: #303846;

  font-family: inherit;
  font-size: 12px;
}

/* Project helper link */

.entries-list :deep(.form-grid > .project-selector .create-project-btn) {
  align-self: flex-start;

  margin-top: 4px;
  padding: 0;

  border: 0;
  background: transparent;

  color: #3f6f9f;

  font-size: 10px;
  font-weight: 600;
}

/* Date/time field */

.entries-list :deep(.form-grid > .datetime-picker) {
  gap: 0;
}

.entries-list :deep(.form-grid > .datetime-picker .datetime-field) {
  width: 100%;
  height: 36px;
  min-height: 36px;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  padding: 7px 9px;

  border: 1px solid #d5dce4;
  border-radius: 5px;

  background: #fff;
  color: #303846;

  font-family: inherit;
  font-size: 12px;

  text-align: left;
}

.entries-list :deep(.form-grid > .datetime-picker .datetime-field:hover) {
  border-color: #c2cad3;
}

.entries-list :deep(.form-grid > .datetime-picker .datetime-field:focus) {
  outline: none;
  border-color: #7e9fbd;
  box-shadow: 0 0 0 2px rgba(76,119,157,.08);
}

.entries-list :deep(.form-grid > .datetime-picker .placeholder) {
  color: #a0a9b5;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.entries-list :deep(.form-grid > .datetime-picker .selected-value) {
  color: #303846;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.entries-list :deep(.form-grid > .datetime-picker .calendar-icon) {
  flex-shrink: 0;
  font-size: 12px;
}

/* Remove the extra right border from the last column */

.entries-list :deep(.form-grid > :last-child) {
  border-right: 0;
}

/* Make every row use the same vertical rhythm */

.entries-list :deep(.form-grid > .form-field),
.entries-list :deep(.form-grid > .project-selector),
.entries-list :deep(.form-grid > .datetime-picker) {
  min-height: 78px;
}

/* Keep helper links from increasing the perceived row height */

.entries-list :deep(.form-grid > .project-selector .project-error),
.entries-list :deep(.form-grid > .datetime-picker .picker-overlay) {
  position: absolute;
}


/* =========================================================
   DASHBOARD VISUAL OVERRIDES
   Visual only — no business logic changes.
   ========================================================= */

.timesheet-form {
  margin: 0 0 24px;
  border: 1px solid #e5eaf2;
  border-radius: 17px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(23, 35, 59, .045);
}

/* Header */

.timesheet-form .form-header {
  min-height: 92px;
  padding: 20px 24px;
  gap: 16px;
  border-bottom: 1px solid #edf0f5;
  background: #ffffff;
}

.timesheet-form .form-header > div {
  flex: 1;
}

.timesheet-form .form-header h2 {
  color: #17233b;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -.45px;
}

.timesheet-form .form-header p {
  margin-top: 6px;
  color: #7b89a1;
  font-size: 12px;
}

.timesheet-form .form-header .eyebrow {
  margin-bottom: 5px;
  color: #687694;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.1px;
}

/* Back navigation */

.timesheet-form .back-to-timesheets {
  min-height: 36px;
  padding: 8px 11px;
  border: 1px solid #dfe4ec;
  border-radius: 9px;
  background: #f8f9fc;
  color: #53627b;
  font-size: 11px;
  font-weight: 700;
  transition:
    background .18s ease,
    border-color .18s ease,
    color .18s ease,
    transform .18s ease;
}

.timesheet-form .back-to-timesheets:hover {
  background: #f1f2f8;
  border-color: #cfd6e3;
  color: #4338ca;
  transform: translateX(-1px);
}

/* Posting date */

.timesheet-form .posting-date-section {
  width: auto;
  margin: 0;
  padding: 20px 24px 18px;
  border-bottom: 1px solid #edf0f5;
}

.timesheet-form .posting-date-section label {
  margin-bottom: 8px;
  color: #687791;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .45px;
}

.timesheet-form .posting-date-section input {
  width: 250px;
  height: 42px;
  padding: 8px 11px;
  border: 1px solid #d9dfeb;
  border-radius: 9px;
  background: #ffffff;
  color: #263650;
  font-size: 13px;
}

.timesheet-form .posting-date-section input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .09);
}

/* Work-entry heading */

.timesheet-form .section-heading {
  padding: 17px 24px 14px;
  border-bottom: 1px solid #edf0f5;
}

.timesheet-form .section-heading h3 {
  color: #1c2941;
  font-size: 17px;
  font-weight: 700;
}

.timesheet-form .section-heading p {
  margin-top: 5px;
  color: #8793a8;
  font-size: 12px;
}

.timesheet-form .section-heading .section-eyebrow {
  color: #687694;
}

/* Entry container */

.timesheet-form .entries-list {
  margin: 0 24px 18px;
  overflow: hidden;
  border: 1px solid #e3e8ef;
  border-radius: 12px;
  background: #ffffff;
}

.timesheet-form .entries-list :deep(.entry-card) {
  background: #ffffff;
}

.timesheet-form .entries-list :deep(.form-field) {
  padding: 14px 13px;
  border-right: 1px solid #edf0f5;
}

.timesheet-form .entries-list :deep(.form-field label) {
  margin-bottom: 7px;
  color: #6d7a92;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .4px;
}

.timesheet-form .entries-list :deep(.form-field input),
.timesheet-form .entries-list :deep(.form-field select) {
  height: 40px;
  padding: 8px 10px;
  border: 1px solid #d9dfeb;
  border-radius: 8px;
  background: #ffffff;
  color: #2a3952;
  font-size: 12px;
}

.timesheet-form .entries-list :deep(.form-field input::placeholder) {
  color: #9ca6b5;
}

.timesheet-form .entries-list :deep(.form-field input:focus),
.timesheet-form .entries-list :deep(.form-field select:focus) {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .08);
}

.timesheet-form .entries-list :deep(.create-activity-btn) {
  color: #5146d9;
  font-size: 10px;
  font-weight: 700;
}

/* Add row */

.timesheet-form .add-entry-button {
  margin: 0 24px 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #5146d9;
  font-size: 11px;
  font-weight: 750;
}

.timesheet-form .add-entry-button:hover {
  color: #4338ca;
}

/* Footer */

.timesheet-form .form-footer {
  min-height: 68px;
  padding: 14px 24px;
  border-top: 1px solid #edf0f5;
  background: #fbfcfe;
  border-radius: 0 0 17px 17px;
}

.timesheet-form .footer-summary {
  gap: 8px;
}

.timesheet-form .footer-summary span {
  color: #8793a7;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .75px;
}

.timesheet-form .footer-summary strong {
  color: #25344e;
  font-size: 15px;
  font-weight: 700;
}

.timesheet-form .form-actions .button-primary {
  min-height: 40px;
  padding: 9px 16px;
  border: 0;
  border-radius: 9px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 12px;
  font-weight: 750;
  box-shadow: 0 4px 10px rgba(79, 70, 229, .18);
  transition: .18s ease;
}

.timesheet-form .form-actions .button-primary:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

@media (max-width: 760px) {
  .timesheet-form .form-header {
    padding: 18px;
  }

  .timesheet-form .posting-date-section,
  .timesheet-form .section-heading {
    padding-left: 18px;
    padding-right: 18px;
  }

  .timesheet-form .posting-date-section input {
    width: 100%;
  }

  .timesheet-form .entries-list {
    margin-left: 18px;
    margin-right: 18px;
  }

  .timesheet-form .form-footer {
    padding-left: 18px;
    padding-right: 18px;
  }
}


/* FINAL DASHBOARD MATCH OVERRIDES */

.timesheet-form {
  margin: 0 0 24px;
  overflow: hidden;
  border: 1px solid #e6eaf1;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(23, 35, 59, .045);
}

/* Header */

.timesheet-form .form-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 24px 20px;
  border-bottom: 1px solid #edf0f5;
  background: #ffffff;
}

.timesheet-form .form-header > div {
  flex: 1;
  min-width: 0;
}

.timesheet-form .form-header .eyebrow {
  margin-bottom: 5px;
  color: #687694;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.15px;
}

.timesheet-form .form-header h2 {
  margin: 0;
  color: #17233b;
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -.4px;
}

.timesheet-form .form-header p {
  margin-top: 6px;
  color: #7b89a1;
  font-size: 12px;
  line-height: 1.5;
}

/* Back: icon only */

.timesheet-form .back-to-timesheets {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  padding: 0;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  border: 1px solid #dfe4ec;
  border-radius: 9px;

  background: #f8f9fc;
  color: #52627b;

  cursor: pointer;
  transition:
    background .18s ease,
    border-color .18s ease,
    color .18s ease,
    transform .18s ease;
}

.timesheet-form .back-to-timesheets:hover {
  background: #f1f2f8;
  border-color: #cfd6e3;
  color: #4f46e5;
  transform: translateX(-1px);
}

.timesheet-form .back-to-timesheets svg {
  width: 17px;
  height: 17px;
}

/* Posting date */

.timesheet-form .posting-date-section {
  width: auto;
  margin: 0;
  padding: 20px 24px 18px;
  border-bottom: 1px solid #edf0f5;
}

.timesheet-form .posting-date-section label {
  margin-bottom: 7px;
  color: #687791;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .45px;
}

.timesheet-form .posting-date-section input {
  width: 235px;
  height: 42px;
  padding: 8px 11px;

  border: 1px solid #d9dfeb;
  border-radius: 9px;

  background: #fff;
  color: #263650;
  font-size: 13px;
}

.timesheet-form .posting-date-section input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .09);
}

/* Work entry heading */

.timesheet-form .section-heading {
  padding: 18px 24px 14px;
  border-bottom: 1px solid #edf0f5;
  background: #fff;
}

.timesheet-form .section-heading .section-eyebrow {
  color: #687694;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1px;
}

.timesheet-form .section-heading h3 {
  margin: 0;
  color: #1c2941;
  font-size: 17px;
  font-weight: 700;
}

.timesheet-form .section-heading p {
  margin-top: 4px;
  color: #8793a8;
  font-size: 12px;
}

.timesheet-form .entry-count {
  border: 1px solid #e1e5ed;
  border-radius: 999px;
  background: #f5f7fb;
  color: #68758b;
}

/* Entry table */

.timesheet-form .entries-list {
  margin: 0 24px 16px;
  overflow: hidden;

  border: 1px solid #e2e7ef;
  border-radius: 12px;

  background: #fff;
}

.timesheet-form .entries-list :deep(.entry-card) {
  background: #fff;
}

.timesheet-form .entries-list :deep(.form-field) {
  padding: 14px;
  border-right: 1px solid #edf0f5;
}

.timesheet-form .entries-list :deep(.form-field label) {
  margin-bottom: 7px;
  color: #6d7a92;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .4px;
}

.timesheet-form .entries-list :deep(.form-field input),
.timesheet-form .entries-list :deep(.form-field select) {
  height: 40px;
  padding: 8px 10px;

  border: 1px solid #d9dfeb;
  border-radius: 8px;

  background: #ffffff;
  color: #293952;
  font-size: 12px;
}

.timesheet-form .entries-list :deep(.form-field input:focus),
.timesheet-form .entries-list :deep(.form-field select:focus) {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .08);
}

.timesheet-form .entries-list :deep(.create-activity-btn) {
  color: #5146d9;
  font-size: 10px;
  font-weight: 700;
}


.entries-table-header {
  display: grid;
  grid-template-columns:
    82px
    minmax(145px, 1fr)
    minmax(165px, 1.1fr)
    minmax(155px, 1fr)
    minmax(205px, 1.35fr)
    82px
    42px;

  align-items: center;

  min-height: 34px;
  padding: 0;

  border-top: 1px solid #e6eaf0;
  border-bottom: 1px solid #e6eaf0;

  background: #f8fafc;
  color: #768293;

  font-size: 9px;
  font-weight: 700;
  letter-spacing: .4px;
  text-transform: uppercase;
}

.entries-table-header > div {
  min-width: 0;
  padding: 0 12px;
}

.entries-table-header > div:not(:last-child) {
  border-right: 1px solid #e6eaf0;
}

/* Add Row */

.timesheet-form .add-entry-button {
  margin: 0 24px 16px;
  padding: 0;

  border: 0;
  background: transparent;

  color: #5146d9;
  font-size: 11px;
  font-weight: 750;
}

.timesheet-form .add-entry-button:hover {
  color: #4338ca;
}

/* Footer */

.timesheet-form .form-footer {
  min-height: 68px;
  padding: 14px 24px;

  border-top: 1px solid #edf0f5;
  border-radius: 0 0 16px 16px;

  background: #fbfcfe;
}

.timesheet-form .footer-summary span {
  color: #8793a7;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .7px;
}

.timesheet-form .footer-summary strong {
  color: #25344e;
  font-size: 15px;
  font-weight: 700;
}

.timesheet-form .form-actions .button-primary {
  min-height: 40px;
  padding: 9px 16px;

  border: 0;
  border-radius: 9px;

  background: #4f46e5;
  color: #fff;

  font-size: 12px;
  font-weight: 750;

  box-shadow: 0 4px 10px rgba(79, 70, 229, .18);
  transition: .18s ease;
}

.timesheet-form .form-actions .button-primary:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

@media (max-width: 760px) {
  .timesheet-form .form-header {
    padding: 18px;
  }

  .timesheet-form .posting-date-section,
  .timesheet-form .section-heading {
    padding-left: 18px;
    padding-right: 18px;
  }

  .timesheet-form .posting-date-section input {
    width: 100%;
  }

  .timesheet-form .entries-list {
    margin-left: 18px;
    margin-right: 18px;
  }

  .timesheet-form .form-footer {
    padding-left: 18px;
    padding-right: 18px;
  }
}


/* =========================================================
   FINAL CARD-BASED DASHBOARD LAYOUT
   Visual only — no business logic.
   ========================================================= */

/* The form itself is now only a layout container. */
.timesheet-form {
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: visible;

  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* ---------------------------------------------------------
   1. FORM HEADER = DASHBOARD CARD
   --------------------------------------------------------- */

.timesheet-form > .form-header {
  display: flex;
  align-items: center;
  gap: 16px;

  min-height: 88px;
  margin-bottom: 16px;
  padding: 20px 22px;

  border: 1px solid #e5eaf2;
  border-radius: 16px;

  background: #ffffff;
  box-shadow: 0 4px 16px rgba(23, 35, 59, .045);
}

.timesheet-form > .form-header > div {
  flex: 1;
}

.timesheet-form > .form-header .eyebrow {
  margin-bottom: 4px;
  color: #687694;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.1px;
}

.timesheet-form > .form-header h2 {
  margin: 0;
  color: #17233b;
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -.45px;
}

.timesheet-form > .form-header p {
  margin-top: 6px;
  color: #7d8aa1;
  font-size: 12px;
}

/* Icon-only back button */
.timesheet-form > .form-header .back-to-timesheets {
  width: 38px;
  height: 38px;
  min-width: 38px;
  min-height: 38px;
  padding: 0;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  border: 1px solid #dfe4ec;
  border-radius: 9px;

  background: #f7f8fc;
  color: #52627b;

  cursor: pointer;
  transition: .18s ease;
}

.timesheet-form > .form-header .back-to-timesheets:hover {
  background: #f0f1f8;
  border-color: #cdd5e1;
  color: #4f46e5;
  transform: translateX(-1px);
}

/* ---------------------------------------------------------
   2. POSTING DATE = ITS OWN CARD
   --------------------------------------------------------- */

.timesheet-form > .posting-date-section {
  width: auto;
  margin: 0 0 16px;
  padding: 18px 22px;

  border: 1px solid #e5eaf2;
  border-radius: 16px;

  background: #ffffff;
  box-shadow: 0 4px 16px rgba(23, 35, 59, .04);
}

.timesheet-form > .posting-date-section label {
  margin-bottom: 7px;
  color: #687791;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .5px;
}

.timesheet-form > .posting-date-section input {
  width: 235px;
  height: 42px;

  padding: 8px 11px;

  border: 1px solid #d9dfeb;
  border-radius: 9px;

  background: #ffffff;
  color: #273650;
  font-size: 13px;
}

.timesheet-form > .posting-date-section input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .09);
}

/* ---------------------------------------------------------
   3. WORK ENTRIES = SEPARATE DASHBOARD CARD
   --------------------------------------------------------- */

.timesheet-form > .section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin: 0;
  padding: 18px 22px 14px;

  border: 1px solid #e5eaf2;
  border-bottom: 0;
  border-radius: 16px 16px 0 0;

  background: #ffffff;
  box-shadow: 0 4px 16px rgba(23, 35, 59, .04);
}

.timesheet-form > .section-heading h3 {
  margin: 0;
  color: #1c2941;
  font-size: 17px;
  font-weight: 700;
}

.timesheet-form > .section-heading p {
  margin-top: 4px;
  color: #8793a8;
  font-size: 12px;
}

.timesheet-form > .section-heading .section-eyebrow {
  color: #687694;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1px;
}

/* Entry table becomes the body of that card */
.timesheet-form > .entries-list {
  margin: 0;

  border: 1px solid #e5eaf2;
  border-top: 1px solid #edf0f5;
  border-bottom: 0;
  border-radius: 0;

  background: #ffffff;
  box-shadow: none;
}

.timesheet-form > .entries-list :deep(.entry-card) {
  background: #ffffff;
}

.timesheet-form > .entries-list :deep(.form-field) {
  padding: 14px;
  border-right: 1px solid #edf0f5;
}

.timesheet-form > .entries-list :deep(.form-field label) {
  margin-bottom: 7px;
  color: #6d7a92;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .4px;
}

.timesheet-form > .entries-list :deep(.form-field input),
.timesheet-form > .entries-list :deep(.form-field select) {
  height: 40px;
  padding: 8px 10px;

  border: 1px solid #d9dfeb;
  border-radius: 8px;

  background: #ffffff;
  color: #293952;
  font-size: 12px;
}

.timesheet-form > .entries-list :deep(.form-field input:focus),
.timesheet-form > .entries-list :deep(.form-field select:focus) {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .08);
}

.timesheet-form > .entries-list :deep(.create-activity-btn) {
  color: #5146d9;
  font-size: 10px;
  font-weight: 700;
}

/* ---------------------------------------------------------
   4. ADD ROW = PART OF THE SAME CARD
   --------------------------------------------------------- */

.timesheet-form > .add-entry-button {
  display: block;
  width: 100%;

  margin: 0;
  padding: 13px 22px;

  border: 1px solid #e5eaf2;
  border-top: 0;
  border-radius: 0 0 16px 16px;

  background: #ffffff;
  color: #5146d9;

  font-size: 11px;
  font-weight: 750;
  text-align: left;

  cursor: pointer;
}

.timesheet-form > .add-entry-button:hover {
  background: #fafaff;
  color: #4338ca;
}

/* ---------------------------------------------------------
   5. FOOTER = ANOTHER DASHBOARD CARD
   --------------------------------------------------------- */

.timesheet-form > .form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;

  min-height: 68px;

  margin-top: 16px;
  padding: 14px 22px;

  border: 1px solid #e5eaf2;
  border-radius: 16px;

  background: #ffffff;
  box-shadow: 0 4px 16px rgba(23, 35, 59, .04);
}

.timesheet-form > .form-footer .footer-summary span {
  color: #8793a7;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .7px;
}

.timesheet-form > .form-footer .footer-summary strong {
  color: #25344e;
  font-size: 15px;
  font-weight: 700;
}

.timesheet-form > .form-footer .button-primary {
  min-height: 40px;
  padding: 9px 16px;

  border: 0;
  border-radius: 9px;

  background: #4f46e5;
  color: #ffffff;

  font-size: 12px;
  font-weight: 750;

  box-shadow: 0 4px 10px rgba(79, 70, 229, .18);
}

.timesheet-form > .form-footer .button-primary:hover {
  background: #4338ca;
}

/* ---------------------------------------------------------
   MOBILE
   --------------------------------------------------------- */

@media (max-width: 760px) {
  .timesheet-form > .form-header,
  .timesheet-form > .posting-date-section,
  .timesheet-form > .section-heading,
  .timesheet-form > .form-footer {
    padding-left: 18px;
    padding-right: 18px;
  }

  .timesheet-form > .posting-date-section input {
    width: 100%;
  }
}



/* DASHBOARD WHITE FORM OVERRIDE */

.timesheet-form > .form-header {
  background: #ffffff !important;
  border-color: #e5eaf2 !important;
}

.timesheet-form > .form-header h2 {
  color: #17233b !important;
}

.timesheet-form > .form-header p {
  color: #7b89a1 !important;
}

.timesheet-form > .form-header .eyebrow {
  color: #687694 !important;
}


/* =========================================================
   BLUE TIMESHEET FORM HEADER
   ========================================================= */

.timesheet-form .form-header {
  position: relative;
  overflow: hidden;

  min-height: 112px;
  padding: 22px 24px;

  border-bottom: 0;

  background: linear-gradient(115deg, #1d293f, #2e4168);
  color: #ffffff;

  box-sizing: border-box;
}

.timesheet-form .form-header::after {
  content: '';

  position: absolute;

  width: 220px;
  height: 220px;

  right: -65px;
  top: -110px;

  border: 1px solid rgba(255,255,255,.08);
  border-radius: 50%;

  box-shadow:
    0 0 0 32px rgba(255,255,255,.025),
    0 0 0 65px rgba(255,255,255,.02);

  pointer-events: none;
}

.timesheet-form .form-header > div {
  position: relative;
  z-index: 1;
}

.timesheet-form .form-header .eyebrow {
  color: #bac9e5;
}

.timesheet-form .form-header h2 {
  color: #ffffff;
  font-size: 23px;
  font-weight: 750;
}

.timesheet-form .form-header p {
  color: #d1daeb;
}

.timesheet-form .form-header .back-to-timesheets {
  position: relative;
  z-index: 2;

  background: rgba(255,255,255,.08);
  border-color: rgba(255,255,255,.22);
  color: #ffffff;
}

.timesheet-form .form-header .back-to-timesheets:hover {
  background: rgba(255,255,255,.15);
  border-color: rgba(255,255,255,.34);
  color: #ffffff;
}



/* =========================================================
   FINAL NEW TIMESHEET BLUE HEADER
   ========================================================= */

.timesheet-form > .form-header {
  position: relative;
  overflow: hidden;

  min-height: 112px;
  padding: 22px 24px;

  border: 0;
  border-radius: 16px 16px 0 0;

  background: linear-gradient(115deg, #1d293f, #2e4168) !important;
  color: #ffffff;
}

.timesheet-form > .form-header::after {
  content: '';

  position: absolute;
  width: 220px;
  height: 220px;

  right: -65px;
  top: -110px;

  border: 1px solid rgba(255,255,255,.08);
  border-radius: 50%;

  box-shadow:
    0 0 0 32px rgba(255,255,255,.025),
    0 0 0 65px rgba(255,255,255,.02);

  pointer-events: none;
}

.timesheet-form > .form-header > div {
  position: relative;
  z-index: 1;
}

.timesheet-form > .form-header .eyebrow {
  color: #bac9e5 !important;
}

.timesheet-form > .form-header h2 {
  color: #ffffff !important;
  font-size: 23px;
  font-weight: 750;
}

.timesheet-form > .form-header p {
  color: #d1daeb !important;
}

.timesheet-form > .form-header .back-to-timesheets {
  position: relative;
  z-index: 2;

  background: rgba(255,255,255,.08) !important;
  border-color: rgba(255,255,255,.22) !important;
  color: #ffffff !important;
}

.timesheet-form > .form-header .back-to-timesheets:hover {
  background: rgba(255,255,255,.15) !important;
  border-color: rgba(255,255,255,.34) !important;
  color: #ffffff !important;
}


.timesheet-add-row {
  display: flex;
  align-items: center;
  padding: 10px 0 4px;
}

.add-row-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #8eb1ef;
  border-radius: 5px;
  background: #ffffff;
  color: #2874e8;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.add-row-btn:hover {
  background: #f4f8ff;
  border-color: #2874e8;
}

.add-row-btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.add-row-btn span {
  font-size: 15px;
  line-height: 1;
}


/* EMPLOYEE / DEPARTMENT INFO */
.employee-info-field {
  min-width: 0;
}

.employee-info-field label {
  display: block;
  margin-bottom: 5px;
  font-size: 10px;
  font-weight: 700;
  color: #68758a;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.employee-info-value {
  min-height: 34px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid #d9e0ea;
  border-radius: 5px;
  background: #f8fafc;
  color: #24324a;
  font-size: 11px;
  font-weight: 600;
  box-sizing: border-box;
}

@media (max-width: 700px) {
  .posting-date-section {
    grid-template-columns: 1fr;
  }
}


/* ADDITIONAL INFORMATION */
.additional-information-section {
  margin: 0 24px 18px;
  padding: 14px 16px;
  border: 1px solid #e4e8ed;
  border-radius: 7px;
  background: #fff;
}

.additional-information-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.additional-information-header h3 {
  margin: 0;
  color: #26364d;
  font-size: 11px;
  font-weight: 750;
}

.additional-information-header span {
  color: #8a94a3;
  font-size: 9px;
  font-weight: 600;
}

.additional-information-section textarea {
  display: block;
  width: 100%;
  min-height: 68px;
  padding: 9px 10px;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid #d9e0ea;
  border-radius: 5px;
  background: #fafbfc;
  color: #26364d;
  font: inherit;
  font-size: 11px;
  line-height: 1.45;
  outline: none;
}

.additional-information-section textarea:focus {
  border-color: #8eb1ef;
  background: #fff;
}

.additional-information-section textarea::placeholder {
  color: #9aa4b2;
}

@media (max-width: 760px) {
  .additional-information-section {
    margin-left: 14px;
    margin-right: 14px;
  }
}


/* TIMESHEET FOOTER ACTIONS */
.timesheet-form .form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.timesheet-form .button-secondary,
.timesheet-form .button-draft,
.timesheet-form .button-primary {
  min-height: 32px;
  padding: 0 13px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
}

.timesheet-form .button-secondary {
  border: 1px solid #d6dce5;
  background: #fff;
  color: #5f6b7a;
}

.timesheet-form .button-secondary:hover {
  background: #f7f8fa;
}

.timesheet-form .button-draft {
  border: 1px solid #8eb1ef;
  background: #fff;
  color: #2874e8;
}

.timesheet-form .button-draft:hover {
  background: #f4f8ff;
}

.timesheet-form .button-primary {
  border: 1px solid #2874e8;
  background: #2874e8;
  color: #fff;
}

.timesheet-form .button-primary:hover {
  background: #2167d1;
}

.timesheet-form .button-secondary:disabled,
.timesheet-form .button-draft:disabled,
.timesheet-form .button-primary:disabled {
  opacity: .55;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .timesheet-form .form-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}


/* DAILY ENTRIES - GROUPED CARD */
.daily-entries-card {
  width: 100%;
  margin: 0;
  border: 1px solid #e1e6ed;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
}

.daily-entries-card .section-heading {
  margin: 0;
  border: 0;
  border-bottom: 1px solid #e7ebf0;
  border-radius: 0;
  background: #ffffff;
}

.daily-entries-card :deep(.daily-entries) {
  width: 100%;
}

</style>
