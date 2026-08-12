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
    ],
  },
  {
    heading: 'Apps',
    items: [
      {
        title: 'Kanban Board',
        icon: 'i-lucide-kanban',
        link: '/kanban',
        new: true,
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
    ],
  },
]

export const navMenuBottom: NavMenuItems = [
  {
    title: 'Help & Support',
    icon: 'i-lucide-circle-help',
    link: '',
  },
  {
    title: 'Feedback',
    icon: 'i-lucide-send',
    link: '',
  },
]
