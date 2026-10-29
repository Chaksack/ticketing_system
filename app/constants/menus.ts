import type { NavMenu, NavMenuItems } from '~/types/nav'
import type { OrgApp } from '~/types/organization'
import type { StaffRole } from '~/types/staff'

const SALES: StaffRole[] = ['bd', 'sm']
const SERVICE: StaffRole[] = ['agent', 'engineer', 'engineering_coordinator', 'engineering_lead']
const DISPATCH: StaffRole[] = ['agent', 'engineering_coordinator', 'engineering_lead']

/** "My work" — the same personal tools at the top of every area, like Dynamics 365. */
function myWork(dashboard?: { title: string, link: string, roles?: StaffRole[], adminOnly?: boolean }): NavMenu {
  return {
    heading: 'My work',
    items: [
      ...(dashboard ? [{ ...dashboard, icon: 'i-lucide-layout-dashboard' }] : []),
      { title: 'Calendar', icon: 'i-lucide-calendar-days', link: '/calendar' },
      { title: 'Email', icon: 'i-lucide-mail', link: '/email' },
      { title: 'Timesheets', icon: 'i-lucide-clock', link: '/timesheets' },
    ],
  }
}

export interface NavArea {
  id: string
  label: string
  icon: string
  /** The company app the area belongs to; areas for switched-off apps are hidden. */
  app?: OrgApp
  menu: NavMenu[]
}

/**
 * The workspace sitemap, organised into areas the way Dynamics 365 is: one area's groups show at a
 * time, and "Change area" at the bottom of the sidebar switches between them. The area follows
 * the page you're on (see AppSidebar).
 */
export const navAreas: NavArea[] = [
  {
    id: 'service',
    label: 'Customer Service',
    icon: 'i-lucide-headset',
    app: 'service',
    menu: [
      myWork({ title: 'Service dashboard', link: '/reports', adminOnly: true }),
      {
        heading: 'Support desk',
        items: [
          { title: 'Cases', icon: 'i-lucide-ticket', link: '/tickets', roles: SERVICE },
          { title: 'Live chat', icon: 'i-lucide-messages-square', link: '/inbox', roles: SERVICE },
          { title: 'Conversation monitor', icon: 'i-lucide-monitor-dot', link: '/service/monitor', roles: SERVICE },
          { title: 'Customers', icon: 'i-lucide-contact', link: '/service/customers', roles: SERVICE },
          // Client records stay with sales and admins (the Clients page's own permission).
          { title: 'Companies', icon: 'i-lucide-building-2', link: '/clients', roles: SALES },
        ],
      },
      {
        heading: 'Support setup',
        items: [
          { title: 'Tags', icon: 'i-lucide-tags', link: '/service/tags', roles: SERVICE },
          { title: 'Quick replies', icon: 'i-lucide-zap', link: '/admin/macros', adminOnly: true },
          { title: 'Support agents', icon: 'i-lucide-users-round', link: '/service/agents', roles: SERVICE },
          { title: 'Team schedules', icon: 'i-lucide-calendar-range', link: '/service/schedules', roles: SERVICE },
          { title: 'Channels', icon: 'i-lucide-radio-tower', link: '/service/channels', roles: SERVICE },
          { title: 'SLA policies', icon: 'i-lucide-timer', link: '/admin/sla', adminOnly: true },
          { title: 'Automations', icon: 'i-lucide-workflow', link: '/admin/automations', adminOnly: true },
        ],
      },
      {
        heading: 'AI capabilities',
        items: [
          { title: 'Knowledge base', icon: 'i-lucide-book-open', link: '/knowledge', roles: SERVICE },
          { title: 'AI agents', icon: 'i-lucide-bot', link: '/ai-agents', roles: SERVICE },
          { title: 'Model settings', icon: 'i-lucide-cpu', link: '/ai-agents/model', roles: SERVICE },
          { title: 'Playbooks', icon: 'i-lucide-list-checks', link: '/ai-agents/playbooks', roles: SERVICE },
          { title: 'AI tools', icon: 'i-lucide-wrench', link: '/ai-agents/tools', roles: SERVICE },
          { title: 'AI activity', icon: 'i-lucide-scroll-text', link: '/ai-agents/activity', roles: SERVICE },
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: 'i-lucide-trending-up',
    app: 'sales',
    menu: [
      myWork({ title: 'Sales dashboard', link: '/overview', roles: SALES }),
      {
        heading: 'Customers',
        items: [
          { title: 'Clients', icon: 'i-lucide-building', link: '/clients', roles: SALES },
        ],
      },
      {
        heading: 'Sales',
        items: [
          { title: 'Pipeline board', icon: 'i-lucide-kanban', link: '/pipeline', roles: SALES },
          { title: 'Leads', icon: 'i-lucide-target', link: '/leads', roles: SALES },
          { title: 'Tenders', icon: 'i-lucide-gavel', link: '/tenders', roles: SALES },
        ],
      },
      {
        heading: 'Collateral',
        items: [
          { title: 'Products', icon: 'i-lucide-package', link: '/admin/products', adminOnly: true },
          { title: 'AMC plans', icon: 'i-lucide-shield-check', link: '/amc-plans', roles: SALES },
        ],
      },
      {
        heading: 'Performance',
        items: [
          { title: 'BD & SM report', icon: 'i-lucide-bar-chart-3', link: '/bd-reports', roles: SALES },
          { title: 'Quotas', icon: 'i-lucide-goal', link: '/admin/bd-quotas', adminOnly: true },
          { title: 'Sales automations', icon: 'i-lucide-route', link: '/admin/bd-automations', adminOnly: true },
        ],
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'i-lucide-megaphone',
    app: 'marketing',
    menu: [
      myWork(),
      {
        heading: 'Marketing',
        items: [
          { title: 'Journeys', icon: 'i-lucide-route', link: '/marketing/journeys', roles: SALES },
          { title: 'Segments', icon: 'i-lucide-users-round', link: '/marketing/segments', roles: SALES },
        ],
      },
    ],
  },
  {
    id: 'field',
    label: 'Field Service',
    icon: 'i-lucide-wrench',
    app: 'field',
    menu: [
      myWork(),
      {
        heading: 'Scheduling',
        items: [
          { title: 'Schedule board', icon: 'i-lucide-calendar-range', link: '/field', roles: DISPATCH },
          { title: 'Work orders', icon: 'i-lucide-clipboard-list', link: '/field/work-orders', roles: SERVICE },
        ],
      },
      {
        heading: 'Service',
        items: [
          { title: 'Assets', icon: 'i-lucide-hard-drive', link: '/field/assets', roles: SERVICE },
        ],
      },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'i-lucide-folder-kanban',
    app: 'projects',
    menu: [
      myWork(),
      {
        heading: 'Projects',
        items: [
          { title: 'Projects', icon: 'i-lucide-folder-kanban', link: '/projects', roles: SALES },
          { title: 'Tasks', icon: 'i-lucide-calendar-check-2', link: '/tasks', roles: SALES },
          { title: 'Sprints', icon: 'i-lucide-rocket', link: '/sprints', roles: SALES },
        ],
      },
      {
        heading: 'Resources',
        items: [
          { title: 'Resource utilisation', icon: 'i-lucide-gauge', link: '/resource-utilization', roles: ['engineering_lead', 'engineering_coordinator', 'finance'] },
          { title: 'Executive dashboard', icon: 'i-lucide-presentation', link: '/executive-dashboard', adminOnly: true },
        ],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'i-lucide-settings',
    menu: [
      {
        heading: 'Organisation',
        items: [
          { title: 'Organisation', icon: 'i-lucide-building-2', link: '/admin/organization', adminOnly: true },
          { title: 'Users & roles', icon: 'i-lucide-users', link: '/admin', adminOnly: true },
          { title: 'Canopy Care results', icon: 'i-lucide-headset', link: '/admin/care-results', adminOnly: true },
          { title: 'Activity log', icon: 'i-lucide-scroll-text', link: '/admin/activity', adminOnly: true },
        ],
      },
      {
        heading: 'Integrations',
        items: [
          { title: 'API keys', icon: 'i-lucide-key-round', link: '/admin/api-keys', adminOnly: true },
          { title: 'ERP connections', icon: 'i-lucide-cable', link: '/admin/erp-connections', adminOnly: true },
          { title: 'My integrations', icon: 'i-lucide-plug', link: '/settings/integrations' },
        ],
      },
      {
        heading: 'Personal',
        items: [
          { title: 'Profile & preferences', icon: 'i-lucide-user-cog', link: '/settings/profile' },
          { title: 'Process map', icon: 'i-lucide-git-fork', link: '/process-map' },
        ],
      },
    ],
  },
]

/** Every workspace group, across areas (search and permission checks use this). */
export const navMenu: NavMenu[] = navAreas.flatMap(area => area.menu)

export const navMenuBottom: NavMenuItems = [
  {
    title: 'Help & Support',
    icon: 'i-lucide-circle-help',
    link: '/help',
  },
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
      { title: 'Team & access', icon: 'i-lucide-users-round', link: '/hq/team', platformOnly: true },
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
