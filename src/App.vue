
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { loadRoles, isManager, isHR } from './api'
import logo from './assets/nestorbird-logo.jpeg'

const route = useRoute()
const router = useRouter()

const isAuthPage = computed(() =>
  ['/login', '/signup'].includes(route.path)
)

const user = computed(() => {
  route.path
  return localStorage.getItem('user') || ''
})

const initials = computed(() =>
  user.value
    .split(/[@.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || '?'
)

const manager = ref(isManager())
const hr = ref(isHR())
const mobileMenuOpen = ref(false)

const isAttendanceRoute = computed(() =>
  route.path === '/attendance' ||
  route.path.startsWith('/attendance/')
)

const showEmployeePages = computed(
  () => !hr.value || manager.value
)

const generalLinks = computed(() => [
  { label: 'Dashboard', to: '/', icon: 'home' },
  { label: 'Leaves', to: '/leaves', icon: 'calendar' },
  { label: 'Attendance', to: '/attendance', icon: 'clock' },
  ...(showEmployeePages.value
    ? [
                {
          label: 'Timesheet',
          to: '/timesheet',
          icon: 'file'
        }
      ]
    : [])
])

const managerLinks = computed(() =>
  manager.value
    ? [
        {
          label: 'Manage My Team',
          to: '/team',
          icon: 'users'
        }
      ]
    : []
)

const hrLinks = computed(() =>
  hr.value
    ? [
        {
          label: 'HR Dashboard',
          to: '/hr',
          icon: 'chart'
        },
        {
          label: 'Leave Approvals',
          to: '/approvals',
          icon: 'clipboard'
        }
      ]
    : []
)

const pageTitle = computed(() => {
  if (route.path === '/attendance/correction') {
    return 'Attendance Correction'
  }

  const links = [
    ...generalLinks.value,
    ...managerLinks.value,
    ...hrLinks.value
  ]

  return (
    links.find(link => link.to === route.path)?.label ||
    'Employee Workspace'
  )
})

const roleLabel = computed(() => {
  if (hr.value) return 'HR Manager'
  if (manager.value) return 'Manager'
  return 'Employee'
})

function refreshRoles() {
  manager.value = isManager()
  hr.value = isHR()
}

watch(
  () => route.path,
  () => {
    refreshRoles()
    mobileMenuOpen.value = false
  }
)

onMounted(async () => {
  if (
    localStorage.getItem('user') &&
    !localStorage.getItem('roles')
  ) {
    try {
      await loadRoles()
      refreshRoles()
    } catch (e) {
      console.warn('Unable to load roles:', e)
    }
  }
})

async function logout() {
  try {
    await api.get('/api/method/logout')
  } catch (e) {
    console.warn('Logout request failed:', e)
  }

  localStorage.removeItem('user')
  localStorage.removeItem('roles')

  manager.value = false
  hr.value = false
  mobileMenuOpen.value = false

  await router.push('/login')
}

const icons = {
  home: [
    'M3 10.5 12 3l9 7.5',
    'M5 9.5V21h14V9.5',
    'M9 21v-7h6v7'
  ],
  user: [
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
  ],
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2'
  ],
  edit: [
    'M12 20h9',
    'M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4z'
  ],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h8'
  ],
  check: [
    'M20 6 9 17l-5-5',
    'M4 3h16v18H4z'
  ],
  clipboard: [
    'M9 3h6l1 2h3v17H5V5h3z',
    'M9 3v4h6V3',
    'M9 13l2 2 4-4'
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75'
  ],
  chart: [
    'M3 3v18h18',
    'M7 16v-5',
    'M12 16V7',
    'M17 16v-8'
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4'
  ],
  logout: [
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    'M16 17l5-5-5-5',
    'M21 12H9'
  ],
  menu: [
    'M4 6h16',
    'M4 12h16',
    'M4 18h16'
  ],
  close: [
    'M18 6 6 18',
    'M6 6l12 12'
  ]
}
</script>

<template>
  <router-view v-if="isAuthPage" />

  <div v-else class="app-shell">
    <div
      v-if="mobileMenuOpen"
      class="mobile-overlay"
      @click="mobileMenuOpen = false"
    ></div>

    <aside
      class="sidebar"
      :class="{ 'sidebar-open': mobileMenuOpen }"
    >
      <div class="sidebar-brand">
        <img
          :src="logo"
          alt="NestorBird logo"
          class="sidebar-logo"
        />

        <div class="brand-text">
          <strong>NestorBird</strong>
          <span>HR MANAGEMENT</span>
        </div>

        <button
          class="mobile-close"
          aria-label="Close navigation"
          @click="mobileMenuOpen = false"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              v-for="(path, index) in icons.close"
              :key="index"
              :d="path"
            />
          </svg>
        </button>
      </div>

      <div class="sidebar-body">
        <div class="workspace-label">
          <span class="workspace-dot"></span>
          EMPLOYEE WORKSPACE
        </div>

        <nav class="nav-section" aria-label="Main navigation">
          <span class="nav-heading">GENERAL</span>

          <router-link
            v-for="link in generalLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            :class="{ 'nav-link-active': route.path === link.to }"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                v-for="(path, index) in icons[link.icon]"
                :key="index"
                :d="path"
              />
            </svg>

            <span>{{ link.label }}</span>

            <span
              v-if="route.path === link.to"
              class="active-indicator"
            ></span>
          </router-link>
        </nav>

        <nav
          v-if="managerLinks.length"
          class="nav-section"
          aria-label="Manager navigation"
        >
          <span class="nav-heading">MANAGEMENT</span>

          <router-link
            v-for="link in managerLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            :class="{ 'nav-link-active': route.path === link.to }"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                v-for="(path, index) in icons[link.icon]"
                :key="index"
                :d="path"
              />
            </svg>

            <span>{{ link.label }}</span>

            <span
              v-if="route.path === link.to"
              class="active-indicator"
            ></span>
          </router-link>
        </nav>

        <nav
          v-if="hrLinks.length"
          class="nav-section"
          aria-label="HR navigation"
        >
          <span class="nav-heading">HUMAN RESOURCES</span>

          <router-link
            v-for="link in hrLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            :class="{ 'nav-link-active': route.path === link.to }"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                v-for="(path, index) in icons[link.icon]"
                :key="index"
                :d="path"
              />
            </svg>

            <span>{{ link.label }}</span>

            <span
              v-if="route.path === link.to"
              class="active-indicator"
            ></span>
          </router-link>
        </nav>
      </div>

      <div class="sidebar-footer">
        <div class="account-card">
          <div class="avatar">{{ initials }}</div>

          <div class="account-info">
            <strong :title="user">{{ user }}</strong>
            <span>{{ roleLabel }}</span>
          </div>

          <button
            class="logout-button"
            aria-label="Log out"
            title="Log out"
            @click="logout"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                v-for="(path, index) in icons.logout"
                :key="index"
                :d="path"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <div class="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="menu-button"
            aria-label="Open navigation"
            @click="mobileMenuOpen = true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path
                v-for="(path, index) in icons.menu"
                :key="index"
                :d="path"
              />
            </svg>
          </button>

          <div class="breadcrumb">
            <span>Workspace</span>
            <span class="breadcrumb-divider">/</span>
            <strong>{{ pageTitle }}</strong>
          </div>
        </div>

        <div class="topbar-right">
          <div class="topbar-workspace">
            <span class="topbar-workspace-label">WORKSPACE</span>
            <strong>NestorBird HRMS</strong>
          </div>
          <span class="topbar-divider"></span>
          <router-link
            to="/profile"
            class="topbar-profile-link"
            aria-label="Open My Profile"
          >
            <div class="topbar-account">
              <div class="topbar-avatar">{{ initials }}</div>
            </div>
          </router-link>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.app-shell {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: #f5f7fc;
  color: #1b2943;
  font-family: Inter, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  flex: 0 0 268px;
  width: 268px;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #172344;
  color: #e6edff;
  z-index: 30;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 96px;
  padding: 22px 21px;
  border-bottom: 1px solid #ffffff13;
}

.sidebar-logo {
  width: 49px;
  height: 49px;
  flex-shrink: 0;
  object-fit: contain;
  border-radius: 11px;
  background: white;
}

.brand-text {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.brand-text strong {
  color: #fff;
  font-size: 19px;
  font-weight: 750;
  letter-spacing: -0.6px;
}

.brand-text span {
  color: #9aabd0;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.6px;
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 23px 13px;
  scrollbar-width: thin;
  scrollbar-color: #43557d transparent;
}

.workspace-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 10px 28px;
  color: #bdcae6;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.2px;
}

.workspace-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #57d9ad;
  box-shadow: 0 0 0 4px #57d9ad1a;
}

.nav-section {
  display: grid;
  gap: 4px;
  margin-bottom: 26px;
}

.nav-heading {
  margin: 0 12px 11px;
  color: #8395bd;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 44px;
  padding: 10px 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: #c4d0eb;
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 550;
  line-height: 1.4;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.nav-link svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  opacity: 0.85;
}

.nav-link:hover {
  background: #ffffff0e;
  color: #fff;
}

.nav-link-active,
.nav-link-active:hover {
  border-color: #7184f030;
  background: #4963c62e;
  color: #fff;
  font-weight: 700;
}

.nav-link-active svg {
  color: #9fb7ff;
  opacity: 1;
}

.active-indicator {
  position: absolute;
  top: 10px;
  right: 0;
  bottom: 10px;
  width: 3px;
  border-radius: 4px;
  background: #91a8ff;
}

.sidebar-footer {
  padding: 15px 13px 20px;
  border-top: 1px solid #ffffff15;
}

.account-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #ffffff15;
  border-radius: 12px;
  background: #ffffff09;
}

.avatar,
.topbar-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 11px;
  background: #6079e8;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.avatar {
  width: 38px;
  height: 38px;
}

.account-info {
  display: grid;
  flex: 1;
  gap: 5px;
  min-width: 0;
}

.account-info strong {
  overflow: hidden;
  color: #fff;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-info span {
  color: #a5b6da;
  font-size: 10px;
}

.logout-button,
.mobile-close,
.menu-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.logout-button {
  width: 31px;
  height: 31px;
  border-radius: 8px;
  color: #b9c8e9;
}

.logout-button:hover {
  background: #ffffff15;
  color: #fff;
}

.logout-button svg,
.mobile-close svg,
.menu-button svg {
  width: 19px;
  height: 19px;
}

.main-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 72px;
  min-height: 72px;
  padding: 0 32px;
  border-bottom: 1px solid #e8edf5;
  background: #fff;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 17px;
  min-width: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  font-size: 13px;
}

.breadcrumb > span:first-child {
  color: #95a0b4;
}

.breadcrumb-divider {
  color: #cbd4e3;
}

.breadcrumb strong {
  overflow: hidden;
  color: #263651;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-label {
  color: #8190a9;
  font-size: 12px;
  font-weight: 600;
}

.topbar-avatar {
  width: 36px;
  height: 36px;
  background: #e9edff;
  color: #4963c6;
}

.content {
  flex: 1;
  min-width: 0;
  padding: 0;
  background: #f5f7fc;
}

.mobile-close,
.menu-button,
.mobile-overlay {
  display: none;
}

@media (max-width: 1000px) {
  .sidebar {
    flex-basis: 242px;
    width: 242px;
  }

  .topbar {
    padding: 0 22px;
  }
}

@media (max-width: 760px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: min(290px, 86vw);
    height: 100dvh;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }

  .sidebar-open {
    transform: translateX(0);
  }

  .mobile-overlay {
    position: fixed;
    inset: 0;
    display: block;
    background: #0f172a99;
    z-index: 25;
  }

  .mobile-close,
  .menu-button {
    display: grid;
  }

  .mobile-close {
    width: 32px;
    height: 32px;
    margin-left: auto;
    color: #d4def5;
  }

  .menu-button {
    width: 36px;
    height: 36px;
    border: 1px solid #e5eaf3;
    border-radius: 9px;
    color: #354867;
  }

  .topbar {
    height: 64px;
    min-height: 64px;
    padding: 0 16px;
  }

  .portal-label {
    display: none;
  }

  .breadcrumb {
    gap: 8px;
    font-size: 12px;
  }
}

.topbar-profile-link {
  display: block;
  color: inherit;
  text-decoration: none;
  border-radius: 10px;
  transition: background .16s ease;
}

.topbar-profile-link:hover {
  background: #f5f7fc;
}

.topbar-profile-link.router-link-active {
  background: #f1f3ff;
}

.topbar-profile-link .topbar-account {
  padding: 5px 7px;
  border-radius: 9px;
}

.topbar-profile-link .topbar-avatar {
  transition: box-shadow .16s ease;
}

.topbar-profile-link:hover .topbar-avatar,
.topbar-profile-link.router-link-active .topbar-avatar {
  box-shadow: 0 0 0 3px #e8eaff;
}

</style>