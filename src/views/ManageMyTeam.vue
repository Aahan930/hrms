<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Approvals from './Approvals.vue'
import Team from './Team.vue'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() =>
  route.query.tab === 'dashboard' ? 'dashboard' : 'approvals'
)

function selectTab(tab) {
  router.replace({
    path: '/team',
    query: { tab }
  })
}
</script>

<template>
  <div
    class="manage-team-page"
    style="padding: 24px 32px; box-sizing: border-box; width: 100%;"
  >
    <div class="page-heading">
      <h2>Manage My Team</h2>
      <p>Manage team approvals and view your team's activity.</p>
    </div>

    <div class="team-tabs" role="tablist" aria-label="Manage My Team">
      <button
        type="button"
        :class="{ active: activeTab === 'approvals' }"
        @click="selectTab('approvals')"
      >
        Approval
      </button>

      <button
        type="button"
        :class="{ active: activeTab === 'dashboard' }"
        @click="selectTab('dashboard')"
      >
        Team Dashboard
      </button>
    </div>

    <div class="team-tab-content">
      <Approvals v-if="activeTab === 'approvals'" />
      <Team v-else />
    </div>
  </div>
</template>

<style scoped>
.manage-team-page {
  width: 100%;
  box-sizing: border-box;
  text-align: left;
}

.page-heading {
  margin-bottom: 18px;
  text-align: left;
}

.page-heading h2 {
  margin: 0;
  color: #172033;
  font-size: 24px;
  font-weight: 700;
}

.page-heading p {
  margin: 6px 0 0;
  color: #68748a;
  font-size: 14px;
}

.team-tabs {
  display: flex;
  gap: 4px;
  width: fit-content;
  margin-bottom: 20px;
  padding: 4px;
  background: #eef1f7;
  border-radius: 10px;
}

.team-tabs button {
  min-width: 145px;
  padding: 10px 18px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #647087;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.team-tabs button:hover {
  color: #4338ca;
  background: #e4e7ff;
}

.team-tabs button.active {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: none;
}

.team-tab-content {
  width: 100%;
}

/* ===== Child dashboard: strip padding and neutralise leaking global CSS ===== */
.team-tab-content :deep(.team-dashboard) {
  padding: 0 !important;
  margin: 0 !important;
  max-width: none !important;
}

.team-tab-content :deep(.team-dashboard),
.team-tab-content :deep(.team-dashboard *) {
  text-align: left;
}

.team-tab-content :deep(.team-dashboard .hole),
.team-tab-content :deep(.team-dashboard .empty-state),
.team-tab-content :deep(.team-dashboard .empty-table),
.team-tab-content :deep(.team-dashboard .leave-col) {
  text-align: center;
}

/* header: title left, date controls on one row at natural width */
.team-tab-content :deep(.team-dashboard .dashboard-header) {
  flex-wrap: nowrap;
}

.team-tab-content :deep(.team-dashboard .dashboard-header > div:first-child) {
  flex: 1;
  min-width: 0;
}

.team-tab-content :deep(.team-dashboard .header-date) {
  flex: 0 0 auto;
  flex-wrap: nowrap;
  justify-content: flex-end;
}

.team-tab-content :deep(.team-dashboard .header-date input) {
  width: 140px;
  flex: 0 0 auto;
}

.team-tab-content :deep(.team-dashboard .header-date button),
.team-tab-content :deep(.team-dashboard .range-pill) {
  width: auto;
  flex: 0 0 auto;
}

.team-tab-content :deep(.team-dashboard .oc-head),
.team-tab-content :deep(.team-dashboard .oc-body) {
  width: 100%;
}

.team-tab-content :deep(.team-dashboard .search-box input) {
  width: 100%;
  max-width: none;
}

@media (max-width: 600px) {
  .team-tabs {
    width: 100%;
  }

  .team-tabs button {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 750px) {
  .team-tab-content :deep(.team-dashboard .dashboard-header) {
    flex-wrap: wrap;
  }
}
</style>