import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'Team',
    items: [
      {
        title: 'Chat',
        icon: 'i-lucide-message-square',
        link: '/chat',
      },
      {
        title: 'Calendar',
        icon: 'i-lucide-calendar-days',
        link: '/calendar',
      },
      {
        title: 'Email',
        icon: 'i-lucide-mail',
        link: '/email',
      },
    ],
  },
  {
    heading: 'BD & SM',
    items: [
      {
        title: 'Overview',
        icon: 'i-lucide-home',
        link: '/',
        roles: ['bd', 'sm'],
      },
      {
        title: 'Tasks',
        icon: 'i-lucide-calendar-check-2',
        link: '/tasks',
        roles: ['bd', 'sm'],
      },
      {
        title: 'Leads',
        icon: 'i-lucide-target',
        link: '/leads',
        roles: ['bd', 'sm'],
      },
      {
        title: 'Clients',
        icon: 'i-lucide-users',
        link: '/clients',
        roles: ['bd', 'sm'],
      },
      {
        title: 'AMC Plans',
        icon: 'i-lucide-construction',
        link: '/amc-plans',
        roles: ['bd', 'sm'],
      },
      {
        title: 'Projects',
        icon: 'i-lucide-folder-kanban',
        link: '/projects',
        roles: ['bd', 'sm'],
      },
      {
        title: 'Reports',
        icon: 'i-lucide-bar-chart-3',
        link: '/bd-reports',
        roles: ['bd', 'sm'],
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
      {
        title: 'Activity Log',
        icon: 'i-lucide-history',
        link: '/admin/activity',
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
