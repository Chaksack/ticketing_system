import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'BD & SM',
    items: [
      {
        title: 'Overview',
        icon: 'i-lucide-home',
        link: '/',
        roles: ['bd'],
      },
      {
        title: 'Tasks',
        icon: 'i-lucide-calendar-check-2',
        link: '/tasks',
        roles: ['bd'],
      },
      {
        title: 'Clients',
        icon: 'i-lucide-users',
        link: '/clients',
        roles: ['bd'],
      },
      {
        title: 'AMC Plans',
        icon: 'i-lucide-users',
        link: '/amc-plans',
        roles: ['bd'],
      },
    ],
  },
  {
    heading: 'Support',
    items: [
      {
        title: 'Tickets',
        icon: 'i-lucide-calendar-check-2',
        link: '/tickets',
        roles: ['agent'],
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
