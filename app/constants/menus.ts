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
      {
        title: 'Process map',
        icon: 'i-lucide-git-fork',
        link: '/process-map',
      },
    ],
  },
  {
    heading: 'BD & SM',
    items: [
      {
        title: 'Overview',
        icon: 'i-lucide-home',
        link: '/overview',
        roles: ['bd', 'sm'],
      },
      {
        title: 'Pipeline',
        icon: 'i-lucide-trending-up',
        children: [
          {
            title: 'Board',
            icon: 'i-lucide-kanban',
            link: '/pipeline',
            roles: ['bd', 'sm'],
          },
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
    heading: 'Marketing',
    items: [
      {
        title: 'Journeys',
        icon: 'i-lucide-route',
        link: '/marketing/journeys',
        roles: ['bd', 'sm'],
      },
      {
        title: 'Segments',
        icon: 'i-lucide-users-round',
        link: '/marketing/segments',
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
        roles: ['agent', 'engineer', 'engineering_coordinator', 'engineering_lead'],
      },
      {
        title: 'Live chat',
        icon: 'i-lucide-messages-square',
        link: '/inbox',
        roles: ['agent', 'engineer', 'engineering_coordinator', 'engineering_lead'],
      },
      {
        title: 'Knowledge base',
        icon: 'i-lucide-book-open',
        link: '/knowledge',
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
    heading: 'Field Service',
    items: [
      {
        title: 'Schedule board',
        icon: 'i-lucide-calendar-range',
        link: '/field',
        roles: ['agent', 'engineering_coordinator', 'engineering_lead'],
      },
      {
        title: 'Work orders',
        icon: 'i-lucide-wrench',
        link: '/field/work-orders',
        roles: ['agent', 'engineer', 'engineering_coordinator', 'engineering_lead'],
      },
      {
        title: 'Assets',
        icon: 'i-lucide-hard-drive',
        link: '/field/assets',
        roles: ['agent', 'engineer', 'engineering_coordinator', 'engineering_lead'],
      },
    ],
  },

  {
    heading: 'Administration',
    items: [
      {
        title: 'Organisation',
        icon: 'i-lucide-building',
        link: '/admin/organization',
        adminOnly: true,
      },
      {
        title: 'Canopy Care results',
        icon: 'i-lucide-headset',
        link: '/admin/care-results',
        adminOnly: true,
      },
      {
        title: 'Executive Dashboard',
        icon: 'i-lucide-layout-dashboard',
        link: '/executive-dashboard',
        adminOnly: true,
      },
      {
        title: 'Admin',
        icon: 'i-lucide-shield',
        link: '/admin',
        adminOnly: true,
      },
      {
        title: 'Integrations',
        icon: 'i-lucide-plug',
        children: [
          {
            title: 'API Keys',
            icon: 'i-lucide-key-round',
            link: '/admin/api-keys',
            adminOnly: true,
          },
          {
            title: 'ERP Connections',
            icon: 'i-lucide-cable',
            link: '/admin/erp-connections',
            adminOnly: true,
          },
        ],
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

/**
 * Canopy HQ — Canopy's own internal space for running the platform: client companies, onboarding
 * and Canopy Care. Shown instead of the workspace menu on HQ pages (see AppSidebar).
 */
export const hqMenu: NavMenu[] = [
  {
    heading: 'Canopy HQ',
    items: [
      { title: 'HQ home', icon: 'i-lucide-radar', link: '/hq', homeOnly: true },
      { title: 'Client companies', icon: 'i-lucide-building-2', link: '/console/tenants', platformOnly: true },
      { title: 'Onboarding', icon: 'i-lucide-file-signature', link: '/console/onboarding', platformOnly: true },
    ],
  },
  {
    heading: 'Canopy Care',
    items: [
      { title: 'Engagements', icon: 'i-lucide-headset', link: '/care', platformOnly: true },
      { title: 'Agent desktop', icon: 'i-lucide-messages-square', link: '/care/desktop', homeOnly: true },
      { title: 'Quality', icon: 'i-lucide-badge-check', link: '/care/quality', platformOnly: true },
      { title: 'Workforce', icon: 'i-lucide-calendar-clock', link: '/care/workforce', platformOnly: true },
    ],
  },
]

/** Pages that belong to Canopy HQ rather than a company workspace. */
export const HQ_PREFIXES = ['/hq', '/console', '/care']
