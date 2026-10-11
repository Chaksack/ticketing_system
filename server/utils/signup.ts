import type { H3Event } from 'h3'
import type { StaffRole } from '../../app/types/staff'
import type { SignupDraft } from './auth'

/** Onboarding roles (step 4) → the app's staff roles. */
export const SIGNUP_ROLES: Record<string, { label: string, roles: StaffRole[] }> = {
  salesperson: { label: 'Salesperson', roles: ['bd'] },
  sales_manager: { label: 'Sales manager', roles: ['sm'] },
  service_agent: { label: 'Service agent', roles: ['agent'] },
  technician: { label: 'Technician', roles: ['engineer'] },
  administrator: { label: 'Administrator', roles: ['admin'] },
}

export const SIGNUP_MIN_PASSWORD = 12

export async function readSignupDraft(event: H3Event): Promise<SignupDraft | undefined> {
  const session = await useAuthSession(event)
  return session.data.signup
}

export async function requireSignupDraft(event: H3Event): Promise<SignupDraft> {
  const draft = await readSignupDraft(event)
  if (!draft)
    throw createError({ statusCode: 409, statusMessage: 'Your sign-up session expired. Please start again.' })
  return draft
}

export async function saveSignupDraft(event: H3Event, draft: SignupDraft) {
  const session = await useAuthSession(event)
  await session.update({ ...session.data, signup: draft })
}

/** What the wizard may see of the draft (never the password hash). */
export function publicDraft(draft: SignupDraft | undefined) {
  if (!draft)
    return null
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    org: draft.org ?? null,
    apps: draft.apps ?? null,
  }
}
