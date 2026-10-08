<script setup>
import { computed } from 'vue'

const props = defineProps({
  hours: {
    type: Number,
    default: 0
  }
})

const totalHours = computed(() =>
  Math.max(0, Number(props.hours) || 0)
)

const progress = computed(() =>
  Math.min((totalHours.value / 40) * 100, 100)
)
</script>

<template>
  <section class="weekly-summary">
    <div class="weekly-summary-header">
      <span class="weekly-summary-eyebrow">THIS WEEK</span>
      <h3>Weekly Summary</h3>
      <p>Track your recorded hours.</p>
    </div>

    <div
      class="summary-ring"
      :style="{
        background: `conic-gradient(
          #5367e8 ${progress}%,
          #edf1ff ${progress}% 100%
        )`
      }"
    >
      <div class="summary-ring-inner">
        <strong>{{ totalHours.toFixed(1) }}h</strong>
        <span>logged</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.weekly-summary {
  width: 260px;
  box-sizing: border-box;
  padding: 18px;
  border: 1px solid #e3e8f1;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 9px rgba(20, 32, 56, .025);
}

.weekly-summary-header {
  margin-bottom: 14px;
}

.weekly-summary-eyebrow {
  display: block;
  margin-bottom: 4px;
  color: #8792a5;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .9px;
}

.weekly-summary h3 {
  margin: 0;
  color: #25324a;
  font-size: 14px;
  font-weight: 750;
}

.weekly-summary-header p {
  margin: 4px 0 0;
  color: #8993a5;
  font-size: 9px;
}

.summary-ring {
  width: 92px;
  height: 92px;
  margin: 4px auto 2px;
  display: grid;
  place-items: center;
  border-radius: 50%;
}

.summary-ring-inner {
  width: 72px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #ffffff;
}

.summary-ring-inner strong {
  color: #25324a;
  font-size: 18px;
  line-height: 1;
}

.summary-ring-inner span {
  margin-top: 4px;
  color: #8993a5;
  font-size: 8px;
}

@media (max-width: 700px) {
  .weekly-summary {
    width: 100%;
  }
}
</style>
