<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 22
  }
})

const iconClass = computed(() => {
  const classes = {
    'Birthday & Anniversary Leave': 'birthday',
    'Personal Time Off': 'personal',
    'Maternity Leave': 'maternity',
    'Paternity Leave': 'paternity',
    'Intern Leave': 'intern',
    'Carry Forward': 'carry',
    'Comp Off': 'comp',
    'Compensatory Off': 'comp',
    'Optional Leave': 'optional',
    'Intern Adjustment': 'adjustment',
    'FTE Adjustment': 'fte',
    'Casual Leave': 'casual',
    'Sick Leave': 'sick'
  }

  return classes[props.type] || 'default'
})
</script>

<template>
  <span
    class="leave-type-icon"
    :class="iconClass"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      flex: `0 0 ${size}px`
    }"
  >
    <svg
      v-if="type === 'Casual Leave'"
      viewBox="0 0 24 24"
    >
      <path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13"/>
    </svg>

    <svg
      v-else-if="type === 'Sick Leave'"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14"/>
    </svg>

    <svg
      v-else-if="type === 'Paternity Leave' || type === 'Maternity Leave'"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="7" r="3"/>
      <path d="M6 21c.5-4 2.5-6 6-6s5.5 2 6 6"/>
    </svg>

    <svg
      v-else-if="type === 'Comp Off' || type === 'Compensatory Off'"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8"/>
      <path d="M12 8v5l3 2"/>
    </svg>

    <svg
      v-else-if="type === 'Optional Leave'"
      viewBox="0 0 24 24"
    >
      <rect x="5" y="4" width="14" height="16" rx="2"/>
      <path d="M8 8h8M8 12h8M8 16h5"/>
    </svg>

    <svg
      v-else-if="type === 'Carry Forward'"
      viewBox="0 0 24 24"
    >
      <path d="M7 7h10l-3-3M17 7l-3 3M17 17H7l3 3M7 17l3-3"/>
    </svg>

    <svg
      v-else
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8"/>
      <path d="M12 8v8M8 12h8"/>
    </svg>
  </span>
</template>

<style scoped>
.leave-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  box-sizing: border-box;
}

.leave-type-icon svg {
  width: 58%;
  height: 58%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.leave-type-icon.birthday {
  color: #ef5b68;
  background: #fff0f2;
}

.leave-type-icon.personal {
  color: #8056d8;
  background: #f2edff;
}

.leave-type-icon.maternity {
  color: #ef5b68;
  background: #fff0f2;
}

.leave-type-icon.paternity {
  color: #4b8de8;
  background: #edf5ff;
}

.leave-type-icon.intern {
  color: #7a59d6;
  background: #f2eeff;
}

.leave-type-icon.carry {
  color: #8158d7;
  background: #f1edff;
}

.leave-type-icon.comp {
  color: #e9a12d;
  background: #fff5df;
}

.leave-type-icon.optional {
  color: #4f9bdc;
  background: #edf7ff;
}

.leave-type-icon.adjustment {
  color: #35a56f;
  background: #eaf8f1;
}

.leave-type-icon.fte {
  color: #4f8ee7;
  background: #edf4ff;
}

.leave-type-icon.casual {
  color: #39a875;
  background: #eaf8f1;
}

.leave-type-icon.sick {
  color: #e45b62;
  background: #fff0f1;
}

.leave-type-icon.default {
  color: #4d83dd;
  background: #edf4ff;
}
</style>
