import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'Team',
    items: [
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
      {
        title: 'Timesheets',
        icon: 'i-lucide-clock',
        link: '/timesheets',
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
        title: 'Pipeline',
        icon: 'i-lucide-trending-up',
        children: [
          {
            title: 'Leads',
            icon: 'i-lucide-target',
            link: '/leads',
            roles: ['bd', 'sm'],
          },
          {
            title: 'Tenders',
            icon: 'i-lucide-gavel',
            link: '/tenders',
            roles: ['bd', 'sm'],
          },
          {
            title: 'Clients',
            icon: 'i-lucide-users',
            link: '/clients',
            roles: ['bd', 'sm'],
          },
        ],
      },
      {
        title: 'Work',
        icon: 'i-lucide-calendar-check-2',
        children: [
          {
            title: 'Tasks',
            icon: 'i-lucide-calendar-check-2',
            link: '/tasks',
            roles: ['bd', 'sm'],
          },
          {
            title: 'Sprints',
            icon: 'i-lucide-rocket',
            link: '/sprints',
            roles: ['bd', 'sm'],
          },
        ],
      },
      {
        title: 'Delivery',
        icon: 'i-lucide-package-check',
        children: [
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
        ],
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
    heading: 'Finance',
    items: [
      {
        title: 'Invoices',
        icon: 'i-lucide-receipt',
        link: '/invoices',
        roles: ['bd', 'sm', 'finance'],
      },
      {
        title: 'Ledger',
        icon: 'i-lucide-book-text',
        children: [
          {
            title: 'Chart of Accounts',
            icon: 'i-lucide-list-tree',
            link: '/chart-of-accounts',
            roles: ['finance'],
          },
          {
            title: 'Journal Entries',
            icon: 'i-lucide-book-text',
            link: '/journal-entries',
            roles: ['finance'],
          },
          {
            title: 'Fiscal Periods',
            icon: 'i-lucide-calendar-range',
            link: '/fiscal-periods',
            roles: ['finance'],
          },
        ],
      },
      {
        title: 'Financial Statements',
        icon: 'i-lucide-file-bar-chart',
        link: '/financial-statements',
        roles: ['finance'],
      },
      {
        title: 'Budgets',
        icon: 'i-lucide-target',
        link: '/budgets',
        roles: ['finance'],
      },
      {
        title: 'Vendors',
        icon: 'i-lucide-truck',
        link: '/vendors',
        roles: ['finance'],
      },
      {
        title: 'Vendor Bills',
        icon: 'i-lucide-file-text',
        link: '/vendor-bills',
        roles: ['finance'],
      },
      {
        title: 'Payment Runs',
        icon: 'i-lucide-banknote',
        link: '/payment-runs',
        roles: ['finance'],
      },
      {
        title: 'Project Profitability',
        icon: 'i-lucide-line-chart',
        link: '/project-profitability',
        roles: ['finance'],
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
        roles: ['agent', 'engineer', 'engineering_coordinator', 'engineering_lead'],
      },
      {
        title: 'Reports',
        icon: 'i-lucide-bar-chart-3',
        link: '/reports',
        adminOnly: true,
      },
      {
        title: 'Resource Utilization',
        icon: 'i-lucide-gauge',
        link: '/resource-utilization',
        roles: ['engineering_lead', 'engineering_coordinator', 'finance'],
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
        title: 'Automation',
        icon: 'i-lucide-workflow',
        children: [
          {
            title: 'Automations',
            icon: 'i-lucide-workflow',
            link: '/admin/automations',
            adminOnly: true,
          },
          {
            title: 'BD Automations',
            icon: 'i-lucide-route',
            link: '/admin/bd-automations',
            adminOnly: true,
          },
        ],
      },
      {
        title: 'Configuration',
        icon: 'i-lucide-settings-2',
        children: [
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
            title: 'Products',
            icon: 'i-lucide-package',
            link: '/admin/products',
            adminOnly: true,
          },
          {
            title: 'BD Quotas',
            icon: 'i-lucide-target',
            link: '/admin/bd-quotas',
            adminOnly: true,
          },
        ],
      },
      {
        title: 'Activity Log',
        icon: 'i-lucide-history',
        link: '/admin/activity',
        adminOnly: true,
      },
    ],
  },
  {
    heading: 'Tools',
    items: [
      {
        title: 'Integrations',
        icon: 'i-lucide-plug',
        link: '/settings/integrations',
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
  // {
  //   title: 'Feedback',
  //   icon: 'i-lucide-send',
  //   link: '',
  // },
]
