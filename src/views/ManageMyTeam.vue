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
  <div class="manage-team-page">
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
}

.page-heading {
  margin-bottom: 18px;
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
  color: #343d55;
}

.team-tabs button.active {
  background: #ffffff;
  color: #4338ca;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}

.team-tab-content {
  width: 100%;
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
</style>
