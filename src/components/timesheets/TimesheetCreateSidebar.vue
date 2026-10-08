<script setup>
import { computed } from 'vue'


const props = defineProps({
  form: {
    type: Object,
    required: true
  }
})

const weekDays = computed(() => {
  if (!props.form?.start_date) return []

  const start = new Date(`${props.form.start_date}T00:00:00`)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    return {
      day: date.toLocaleDateString('en-US', {
        weekday: 'short'
      }),
      date: date.getDate()
    }
  })
})
</script>

<template>
  <aside class="timesheet-create-sidebar">

    <!-- Calendar -->
    <section class="sidebar-card">
      <div class="sidebar-card-header">
        <div>
          <span class="sidebar-eyebrow">WEEK VIEW</span>
          <h3>This Week's Calendar</h3>
        </div>
      </div>

      <div class="week-calendar">
        <div
          v-for="day in weekDays"
          :key="`${day.day}-${day.date}`"
          class="calendar-day"
        >
          <span>{{ day.day }}</span>
          <strong>{{ day.date }}</strong>
        </div>
      </div>
    </section>

    <!-- Recent Timesheets -->
    <section class="sidebar-card">
      <div class="sidebar-card-header">
        <div>
          <span class="sidebar-eyebrow">HISTORY</span>
          <h3>Recent Timesheets</h3>
        </div>
      </div>

      <div class="empty-recent">
        <span class="empty-recent-icon">◷</span>
        <p>No recent timesheets</p>
        <small>Your submitted timesheets will appear here.</small>
      </div>
    </section>

    <!-- Policy -->
    <section class="sidebar-card policy-card">
      <div class="sidebar-card-header">
        <div>
          <span class="sidebar-eyebrow">GUIDELINES</span>
          <h3>Timesheet Policy</h3>
        </div>
      </div>

      <ul class="policy-list">
        <li>Submit your timesheet by the weekly deadline.</li>
        <li>Record accurate hours for each activity.</li>
        <li>Use separate entries for different activities.</li>
      </ul>
    </section>

  </aside>
</template>

<style scoped>
.timesheet-create-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.sidebar-card {
  padding: 17px;
  border: 1px solid #e4e8f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(20, 32, 56, .025);
}

.sidebar-card-header {
  margin-bottom: 14px;
}

.sidebar-eyebrow {
  display: block;
  margin-bottom: 4px;
  color: #8792a5;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
}

.sidebar-card h3 {
  margin: 0;
  color: #25324a;
  font-size: 14px;
  font-weight: 750;
}

.week-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  min-width: 0;
  padding: 7px 2px;
  border: 1px solid #edf0f5;
  border-radius: 6px;
  text-align: center;
}

.calendar-day span {
  display: block;
  color: #929bad;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.calendar-day strong {
  display: block;
  margin-top: 3px;
  color: #33415a;
  font-size: 11px;
}

.empty-recent {
  padding: 12px 4px 5px;
  text-align: center;
}

.empty-recent-icon {
  display: grid;
  width: 32px;
  height: 32px;
  margin: 0 auto 8px;
  place-items: center;
  border-radius: 9px;
  background: #f3f5ff;
  color: #5969df;
  font-size: 16px;
}

.empty-recent p {
  margin: 0;
  color: #46536a;
  font-size: 11px;
  font-weight: 700;
}

.empty-recent small {
  display: block;
  margin-top: 4px;
  color: #98a1b0;
  font-size: 9px;
  line-height: 1.4;
}

.policy-list {
  margin: 0;
  padding: 0 0 0 16px;
  color: #68758b;
  font-size: 10px;
  line-height: 1.6;
}

.policy-list li + li {
  margin-top: 5px;
}

@media (max-width: 1100px) {
  .timesheet-create-sidebar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .timesheet-create-sidebar {
    grid-template-columns: 1fr;
  }
}
</style>
