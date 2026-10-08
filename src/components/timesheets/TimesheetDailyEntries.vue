<script setup>
import { computed } from 'vue'
import TimesheetEntry from './TimesheetEntry.vue'

const props = defineProps({
  entries: {
    type: Array,
    required: true
  },
  startDate: {
    type: String,
    default: ''
  },
  endDate: {
    type: String,
    default: ''
  },
  saving: {
    type: Boolean,
    default: false
  },
  activityTypes: {
    type: Array,
    default: () => []
  },
  activityLoading: {
    type: Boolean,
    default: false
  },
  managerView: {
    type: Boolean,
    default: false
  },
  activityError: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'update-entry',
  'remove-entry',
  'add-entry',
  'create-activity'
])

function formatPostingDate(date) {
  if (!date) return ''

  const parsed = new Date(`${date}T00:00:00`)

  return {
    weekday: parsed.toLocaleDateString('en-US', {
      weekday: 'short'
    }),
    date: parsed.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short'
    })
  }
}

const postingDateLabel = computed(() =>
  formatPostingDate(props.startDate)
)

function updateEntry(index, field, value) {
  emit('update-entry', index, field, value)
}

function removeEntry(index) {
  emit('remove-entry', index)
}

function addEntry() {
  emit('add-entry')
}

function formatHours(value) {
  const totalMinutes = Math.round(
    (Number(value) || 0) * 60
  )

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const totalHours = computed(() =>
  props.entries.reduce(
    (sum, entry) => sum + (Number(entry.hours) || 0),
    0
  )
)
</script>

<template>
  <section class="daily-entries">

    <div class="timesheet-table">

      <!-- TABLE HEADER -->
      <div class="table-header">
        <span>Date</span>
        <span>Project / Task</span>
        <span>Activity Type</span>
        <span>Deliverables</span>
        <span>Description</span>
        <span>Hours</span>
        <span>Actions</span>
      </div>

      <!-- TABLE ROWS -->
      <div
        v-for="(entry, index) in entries"
        :key="entry.name || `${entry.date || startDate}-${index}`"
        class="table-row"
      >

        <!-- DATE -->
        <div class="date-cell">
          <strong>{{ postingDateLabel.weekday }}</strong>
          <span>{{ postingDateLabel.date }}</span>
        </div>

        <!-- ENTRY -->
        <TimesheetEntry
          :entry="entry"
          :index="index"
          :day-label="''"
          :entries-count="entries.length"
          :activity-types="activityTypes"
          :activity-loading="activityLoading"
          :manager-view="managerView"
          :activity-error="activityError"
          @update="
            (field, value) =>
              updateEntry(index, field, value)
          "
          @remove="removeEntry(index)"
          @create-activity="emit('create-activity')"
        />

      </div>

      <!-- FOOTER -->
      <div class="table-footer">
        <button
          type="button"
          class="add-row-button"
          :disabled="saving"
          @click="addEntry"
        >
          <span>+</span>
          Add Row
        </button>

        <div class="total-hours">
          <span>Total Hours:</span>
          <strong>{{ formatHours(totalHours) }}</strong>
        </div>
      </div>

    </div>

  </section>
</template>

<style scoped>
.daily-entries {
  width: 100%;
}

.timesheet-table {
  width: 100%;
  overflow: hidden;
  background: #ffffff;
}

/* ---------------------------------------------
   TABLE HEADER
--------------------------------------------- */

.table-header {
  display: grid;
  grid-template-columns:
    92px
    minmax(135px, 1fr)
    minmax(145px, 1fr)
    minmax(135px, 1fr)
    minmax(170px, 1.2fr)
    72px
    42px;

  min-height: 34px;
  align-items: center;

  padding: 0 9px;

  border-bottom: 1px solid #e7ebf0;

  background: #ffffff;

  color: #7b8797;
  font-size: 9px;
  font-weight: 750;

  text-transform: uppercase;
  letter-spacing: .04em;

  box-sizing: border-box;
}

.table-header span {
  min-width: 0;
}

/* ---------------------------------------------
   TABLE ROW
--------------------------------------------- */

.table-row {
  display: grid;

  grid-template-columns:
    92px
    minmax(135px, 1fr)
    minmax(145px, 1fr)
    minmax(135px, 1fr)
    minmax(170px, 1.2fr)
    72px
    42px;

  width: 100%;
  min-height: 58px;

  border-bottom: 1px solid #e7ebf0;

  background: #ffffff;

  box-sizing: border-box;
}

/*
 * TimesheetEntry already owns the five editable
 * columns. Make it occupy columns 2 through 6.
 */
.table-row :deep(.entry-row) {
  grid-column: 2 / 7;
  min-width: 0;
  min-height: 58px;
}

/* ---------------------------------------------
   DATE
--------------------------------------------- */

.date-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;

  min-width: 0;

  padding: 7px 9px;

  border-right: 1px solid #e7ebf0;

  box-sizing: border-box;
}

.date-cell strong {
  color: #26364d;
  font-size: 10px;
  font-weight: 750;
}

.date-cell span {
  margin-top: 2px;

  color: #7b8797;
  font-size: 8px;
}

/* ---------------------------------------------
   FOOTER
--------------------------------------------- */

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;

  min-height: 48px;

  padding: 0 10px;

  background: #ffffff;
}

.add-row-button {
  display: inline-flex;
  align-items: center;

  gap: 5px;

  padding: 0;

  border: 0;

  background: transparent;

  color: #2874e8;

  font: inherit;
  font-size: 10px;
  font-weight: 750;

  cursor: pointer;
}

.add-row-button span {
  font-size: 15px;
  line-height: 1;
}

.add-row-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.total-hours {
  display: flex;
  align-items: center;

  gap: 5px;

  color: #7b8797;
  font-size: 10px;
}

.total-hours strong {
  color: #26364d;
  font-size: 11px;
  font-weight: 750;
}

/* ---------------------------------------------
   RESPONSIVE
--------------------------------------------- */

@media (max-width: 900px) {
  .table-header {
    display: none;
  }

  .table-row {
    display: block;
    padding: 8px;
  }

  .date-cell {
    min-height: 34px;
    border-right: 0;
    border-bottom: 1px solid #e7ebf0;
  }

  .table-row :deep(.entry-row) {
    display: grid;
  }
}
</style>
