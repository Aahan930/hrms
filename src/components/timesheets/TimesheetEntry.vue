<script setup>
import ProjectSelector from './ProjectSelector.vue'

defineProps({
  entry: {
    type: Object,
    required: true
  },

  index: {
    type: Number,
    required: true
  },

  dayLabel: {
    type: String,
    default: ''
  },

  entriesCount: {
    type: Number,
    required: true
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
  'update',
  'remove',
  'create-activity'
])

function update(field, value) {
  emit('update', field, value)
}

function remove() {
  emit('remove')
}

function createActivity() {
  emit('create-activity')
}
</script>

<template>
  <div class="entry-row">

    <!-- PROJECT / TASK -->
    <div class="entry-cell project-cell">
      <ProjectSelector
        :model-value="entry.project"
        :show-create="false"
        @update:model-value="
          update('project', $event)
        "
      />
    </div>

    <!-- ACTIVITY TYPE -->
    <div class="entry-cell activity-cell">
      <select
        :value="entry.activity_type"
        :disabled="activityLoading"
        @change="
          update(
            'activity_type',
            $event.target.value
          )
        "
      >
        <option value="">
          {{
            activityLoading
              ? 'Loading...'
              : 'Select Activity'
          }}
        </option>

        <option
          v-for="activity in activityTypes"
          :key="activity.name"
          :value="activity.name"
        >
          {{ activity.name }}
        </option>
      </select>

    </div>

    <!-- DELIVERABLES -->
    <div class="entry-cell deliverables-cell">
      <input
        :value="entry.deliverables"
        type="text"
        maxlength="255"
        placeholder="Enter deliverable"
        @input="
          update(
            'deliverables',
            $event.target.value
          )
        "
      />
    </div>

    <!-- DESCRIPTION -->
    <div class="entry-cell description-cell">
      <input
        :value="entry.description"
        type="text"
        placeholder="Describe work"
        @input="
          update(
            'description',
            $event.target.value
          )
        "
      />
    </div>

    <!-- HOURS -->
    <div class="entry-cell hours-cell">
      <input
        :value="entry.hours || ''"
        type="number"
        min="0"
        step="0.25"
        placeholder="0"
        @input="
          update(
            'hours',
            Number($event.target.value) || 0
          )
        "
      />
    </div>

    <!-- REMOVE -->
    <div class="remove-cell">
      <button
        v-if="entriesCount > 1"
        type="button"
        class="remove-entry-btn"
        aria-label="Remove work entry"
        @click="remove"
      >
        ×
      </button>
    </div>

  </div>
</template>

<style scoped>
.entry-row {
  display: grid;
  grid-template-columns:
    minmax(150px, 1fr)
    minmax(150px, 1fr)
    minmax(160px, 1fr)
    minmax(190px, 1.25fr)
    72px
    42px;

  width: 100%;
  min-height: 58px;

  background: #ffffff;
  box-sizing: border-box;
}

.entry-cell,
.remove-cell {
  min-width: 0;
  border-right: 1px solid #e7ebf0;
  box-sizing: border-box;
}

.entry-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 7px;
}

.project-cell {
  padding-left: 10px;
}

.entry-cell :deep(input),
.entry-cell :deep(select) {
  width: 100%;
  min-width: 0;
  height: 32px;
  box-sizing: border-box;

  border: 1px solid #d9e0e8;
  border-radius: 4px;

  background: #ffffff;
  color: #344054;

  font-family: inherit;
  font-size: 10px;
  outline: none;
}

.entry-cell :deep(input) {
  padding: 0 9px;
}

.entry-cell :deep(select) {
  padding: 0 8px;
  cursor: pointer;
}

.entry-cell :deep(input:focus),
.entry-cell :deep(select:focus) {
  border-color: #7da7e8;
  box-shadow: 0 0 0 2px rgba(40, 116, 232, 0.08);
}

.activity-cell {
  align-items: stretch;
}

.create-activity-btn {
  width: fit-content;
  margin-top: 3px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2874e8;
  font-family: inherit;
  font-size: 8px;
  font-weight: 700;
  cursor: pointer;
}

.create-activity-btn:hover {
  text-decoration: underline;
}

.activity-error {
  margin-top: 2px;
  color: #d92d20;
  font-size: 8px;
  line-height: 1.2;
}

.description-cell {
  padding-right: 7px;
}

.hours-cell {
  align-items: center;
  justify-content: center;
  padding: 7px 5px;
}

.hours-cell :deep(input) {
  text-align: center;
  padding: 0 4px;
}

.remove-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 0;
}

.remove-entry-btn {
  width: 24px;
  height: 24px;
  padding: 0;

  border: 1px solid #d9e0e8;
  border-radius: 4px;

  background: #ffffff;
  color: #98a2b3;

  font-family: inherit;
  font-size: 15px;
  line-height: 1;

  cursor: pointer;
}

.remove-entry-btn:hover {
  border-color: #f0a7a2;
  color: #d92d20;
  background: #fff7f6;
}

@media (max-width: 900px) {
  .entry-row {
    grid-template-columns:
      minmax(140px, 1fr)
      minmax(140px, 1fr)
      minmax(160px, 1fr)
      64px
      38px;
  }
}

@media (max-width: 700px) {
  .entry-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 8px;
  }

  .entry-cell,
  .remove-cell {
    border-right: 0;
  }

  .remove-cell {
    justify-content: flex-end;
  }
}
</style>
