<script setup>
import { computed } from 'vue'

const props = defineProps({
  timesheet: {
    type: Object,
    required: true
  },
  submittingDate: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'submit-day'
])

function getDate(value) {
  if (!value) return ''

  return String(value).slice(0, 10)
}

function formatDate(date) {
  if (!date) return '—'

  const value = new Date(`${date}T00:00:00`)

  if (Number.isNaN(value.getTime())) {
    return date
  }

  return value.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
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

const days = computed(() => {
  const grouped = new Map()

  for (const entry of props.timesheet?.time_logs || []) {
    const date = getDate(entry.from_time)

    if (!date) continue

    if (!grouped.has(date)) {
      grouped.set(date, [])
    }

    grouped.get(date).push(entry)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({
      date,
      entries,
      submitted: entries.some(
        entry => entry.custom_day_status === 'Submitted'
      ),
      totalHours: entries.reduce(
        (sum, entry) => sum + (Number(entry.hours) || 0),
        0
      )
    }))
})

function submitDay(date) {
  if (props.submittingDate === date) return

  emit(
    'submit-day',
    props.timesheet.name,
    date
  )
}
</script>

<template>
  <section class="daily-submission">

    <div
      v-if="!days.length"
      class="empty"
    >
      No work entries recorded for this timesheet.
    </div>

    <div
      v-for="day in days"
      :key="day.date"
      class="day-card"
    >

      <div class="day-header">

        <div>
          <div class="day-date">
            {{ formatDate(day.date) }}
          </div>

          <div class="day-meta">
            {{ day.entries.length }}
            {{ day.entries.length === 1 ? 'entry' : 'entries' }}
            · {{ formatHours(day.totalHours) }}
          </div>
        </div>

        <div class="day-action">

          <span
            v-if="day.submitted"
            class="submitted-status"
          >
            ✓ Submitted
          </span>

          <button
            v-else
            type="button"
            class="submit-day-button"
            :disabled="submittingDate !== ''"
            @click="submitDay(day.date)"
          >
            {{
              submittingDate === day.date
                ? 'Submitting…'
                : 'Submit Day'
            }}
          </button>

        </div>

      </div>

      <div class="entries">

        <div
          v-for="(entry, index) in day.entries"
          :key="entry.name || `${day.date}-${index}`"
          class="entry-row"
        >

          <div class="entry-cell project">
            <span class="label">PROJECT / TASK</span>
            <strong>
              {{ entry.project || entry.task || '—' }}
            </strong>
          </div>

          <div class="entry-cell">
            <span class="label">ACTIVITY TYPE</span>
            <span>
              {{ entry.activity_type || '—' }}
            </span>
          </div>

          <div class="entry-cell description">
            <span class="label">DESCRIPTION</span>
            <span>
              {{ entry.description || '—' }}
            </span>
          </div>

          <div class="entry-cell hours">
            <span class="label">HOURS</span>
            <strong>
              {{ formatHours(entry.hours) }}
            </strong>
          </div>

        </div>

      </div>

    </div>

  </section>
</template>

<style scoped>
.daily-submission {
  width: 100%;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #7b8797;
  font-size: 12px;
}

.day-card {
  border: 1px solid #e7ebf0;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
}

.day-card + .day-card {
  margin-top: 12px;
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  min-height: 58px;
  padding: 10px 14px;

  background: #f8fafc;
  border-bottom: 1px solid #e7ebf0;
}

.day-date {
  color: #26364d;
  font-size: 12px;
  font-weight: 750;
}

.day-meta {
  margin-top: 3px;
  color: #7b8797;
  font-size: 10px;
}

.day-action {
  flex-shrink: 0;
}

.submit-day-button {
  min-width: 92px;
  padding: 7px 11px;

  border: 0;
  border-radius: 6px;

  background: #2874e8;
  color: #ffffff;

  font-size: 10px;
  font-weight: 750;

  cursor: pointer;
}

.submit-day-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.submitted-status {
  display: inline-flex;
  align-items: center;

  padding: 7px 11px;

  border-radius: 6px;

  background: #eef8f1;
  color: #23834b;

  font-size: 10px;
  font-weight: 750;
}

.entries {
  width: 100%;
}

.entry-row {
  display: grid;
  grid-template-columns:
    minmax(140px, 1fr)
    minmax(140px, 1fr)
    minmax(180px, 1.5fr)
    70px;

  min-height: 54px;

  border-bottom: 1px solid #edf0f4;
}

.entry-row:last-child {
  border-bottom: 0;
}

.entry-cell {
  min-width: 0;
  padding: 10px 12px;

  display: flex;
  flex-direction: column;
  justify-content: center;

  border-right: 1px solid #edf0f4;

  color: #425168;
  font-size: 11px;
}

.entry-cell:last-child {
  border-right: 0;
}

.entry-cell strong {
  color: #26364d;
  font-weight: 700;
}

.label {
  margin-bottom: 3px;

  color: #8a95a5;
  font-size: 8px;
  font-weight: 750;

  letter-spacing: .04em;
}

.description span:not(.label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hours {
  align-items: flex-end;
  text-align: right;
}

@media (max-width: 800px) {
  .day-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .entry-row {
    grid-template-columns: 1fr 1fr;
  }

  .entry-cell {
    border-bottom: 1px solid #edf0f4;
  }

  .hours {
    align-items: flex-start;
    text-align: left;
  }
}
</style>
