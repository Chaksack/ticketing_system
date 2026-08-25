import type { StaffRole } from './staff'

export interface NavLink {
  title: string
  link: string
  icon?: string
  new?: boolean
  adminOnly?: boolean
  roles?: StaffRole[]
}

export interface NavSectionTitle {
  heading: string
}

export interface NavGroup {
  title: string
  icon?: string
  new?: boolean
  children: NavLink[]
}

export interface NavMenu {
  heading: string
  items: NavMenuItems
}

export declare type NavMenuItems = (NavLink | NavGroup | NavSectionTitle)[]
