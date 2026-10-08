import HRRequests from './views/HR/HRRequests.vue'

import { createRouter, createWebHistory } from 'vue-router'

import { loadRoles, isManager, isHR } from './api'
import HREmployeeDirectory from './views/HR/HREmployeeDirectory.vue'
import HRReports from './views/HR/HRReports.vue'

import Login from './views/Login.vue'
import Home from './views/Home.vue'
import Profile from './views/Profile.vue'
import Leaves from './views/Leaves.vue'
import Attendance from './views/Attendance.vue'
import AttendanceCorrection from './views/AttendanceCorrection.vue'
import Timesheet from './views/Timesheet.vue'
import MarkAttendance from './views/MarkAttendance.vue'
import Approvals from './views/Approvals.vue'
import Team from './views/Team.vue'
import EmployeeDetail from './views/EmployeeDetail.vue'

import HRDashboard from './views/HRDashboard.vue'
import HRTasks from './views/HR/HRTasks.vue'
import HROnboardingForm from './components/hr/HROnboardingForm.vue'
import HRCorrectionRequests from './views/HR/HRCorrectionRequests.vue'
import ManageMyTeam from './views/ManageMyTeam.vue'

const router = createRouter({
  history: createWebHistory(),

  routes: [
    {
      path: '/login',
      component: Login
    },

    {
      path: '/',
      component: Home,
      meta: { auth: true }
    },

    {
      path: '/profile',
      component: Profile,
      meta: { auth: true }
    },

    {
      path: '/leaves',
      component: Leaves,
      meta: { auth: true }
    },

    {
      path: '/attendance',
      component: Attendance,
      meta: { auth: true }
    },

    // Available to employees and managers, but not HR-only users
    {
      path: '/attendance/correction',
      component: AttendanceCorrection,
      meta: {
        auth: true,
        employeePage: true
      }
    },

    {
      path: '/timesheet',
      component: Timesheet,
      meta: {
        auth: true,
        employeePage: true
      }
    },

    {
      path: '/mark-attendance',
      redirect: '/attendance'
    },

    // Manager routes
    {
      path: '/approvals',
      redirect: '/team?tab=approvals',
      meta: {
        auth: true,
        approvalPage: true
      }
    },

    {
      path: '/team',
      component: ManageMyTeam,
      meta: {
        auth: true,
        manager: true
      }
    },

    {
      path: '/team/employee/:id',
      component: EmployeeDetail,
      meta: {
        auth: true,
        manager: true
      }
    },

    // HR routes
    {
      path: '/hr',
      component: HRDashboard,
      meta: {
        auth: true,
        hr: true
      }
    },

    {
      path: '/hr/correction-requests',
      redirect: '/hr/requests',
      meta: {
        auth: true,
        hr: true
      }
    },

    {
      path: '/hr/requests',
      component: HRRequests,
      meta: {
        auth: true,
        hr: true
      }
    },

    {
      path: '/hr-tasks/onboarding/new',
      component: HROnboardingForm,
      meta: {
        auth: true,
        hr: true
      }
    },

    {
      path: '/hr-tasks',
      component: HRTasks,
      meta: {
        auth: true,
        hr: true
      }
    },

    {
      path: '/hr/employee/:id',
      component: EmployeeDetail,
      meta: {
        auth: true,
        hr: true
      }
    },
    {
      path: '/hr/employees',
      component: HREmployeeDirectory,
      meta: { auth: true, hr: true }
    },

    {
      path: '/hr/reports',
      component: HRReports,
      meta: { auth: true, hr: true }
    },
  ]
})

router.beforeEach(async (to) => {
  const user = localStorage.getItem('user')

  // Redirect unauthenticated users to login
  if (to.meta.auth && !user) {
    return '/login'
  }

  // Redirect logged-in users away from login
  if (to.path === '/login' && user) {
    return '/'
  }

  // Load roles before checking restricted routes
  if (
    to.meta.manager ||
    to.meta.hr ||
    to.meta.employeePage ||
    to.meta.approvalPage
  ) {
    if (!localStorage.getItem('roles')) {
      try {
        await loadRoles()
      } catch {
        return '/login'
      }
    }
  }

  // HR-only users cannot access employee-specific pages.
  // Users who are both HR and managers retain access.
  if (
    to.meta.employeePage &&
    isHR() &&
    !isManager()
  ) {
    return '/hr'
  }

  // Manager-only routes
  if (to.meta.manager && !isManager()) {
    return '/'
  }

  // Approval page is available to managers and HR
  if (
    to.meta.approvalPage &&
    !isManager() &&
    !isHR()
  ) {
    return '/'
  }

  // HR-only routes
  if (to.meta.hr && !isHR()) {
    return '/'
  }
})

export default router