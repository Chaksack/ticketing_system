import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'General',
    items: [
      // {
      //   title: 'Home',
      //   icon: 'i-lucide-home',
      //   link: '/',
      // },
      // {
      //   title: 'Email',
      //   icon: 'i-lucide-mail',
      //   link: '/email',
      // },
      {
        title: 'Tickets',
        icon: 'i-lucide-calendar-check-2',
        link: '/tickets',
      },
      {
        title: 'Reports',
        icon: 'i-lucide-bar-chart-3',
        link: '/reports',
        adminOnly: true,
      },
    ],
  },
  {
    heading: 'Administration',
    items: [
      {
        title: 'Admin',
        icon: 'i-lucide-shield',
        link: '/admin',
        adminOnly: true,
      },
      {
        title: 'SLA Policies',
        icon: 'i-lucide-timer',
        link: '/admin/sla',
        adminOnly: true,
      },
      {
        title: 'Macros',
        icon: 'i-lucide-zap',
        link: '/admin/macros',
        adminOnly: true,
      },
      {
        title: 'Automations',
        icon: 'i-lucide-workflow',
        link: '/admin/automations',
        adminOnly: true,
      },
    ],
  },
]

export const navMenuBottom: NavMenuItems = [
  {
    title: 'Help & Support',
    icon: 'i-lucide-circle-help',
    link: '/help',
  },
  {
    title: 'Feedback',
    icon: 'i-lucide-send',
    link: '',
  },
]
