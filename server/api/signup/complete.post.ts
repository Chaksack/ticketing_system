import type { OrgApp } from '../../../app/types/organization'
import type { SessionUser } from '../../utils/auth'

interface CompleteBody {
  invites?: { email?: string, role?: string }[]
}

const MAX_INVITES = 25

// Step 4 — provisions the company (its own database + first admin), sends the team invites and signs the admin in.
export default defineEventHandler(async (event) => {
  const draft = await requireSignupDraft(event)
  if (!draft.org || !draft.apps?.length)
    throw createError({ statusCode: 409, statusMessage: 'Finish the earlier steps first' })

  const body = await readBody<CompleteBody>(event)
  const invites = (body?.invites ?? [])
    .map(invite => ({ email: invite.email?.trim().toLowerCase() ?? '', role: invite.role ?? '' }))
    .filter(invite => invite.email)
    .slice(0, MAX_INVITES)
  for (const invite of invites) {
    if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(invite.email))
      throw createError({ statusCode: 400, statusMessage: `${invite.email} isn't a valid email` })
    if (!SIGNUP_ROLES[invite.role])
      throw createError({ statusCode: 400, statusMessage: `Choose a role for ${invite.email}` })
    if (invite.email === draft.email)
      throw createError({ statusCode: 400, statusMessage: 'You\'re already the administrator. Remove yourself from the invite list.' })
  }

  const adminName = `${draft.firstName} ${draft.lastName}`
  const { org, adminStaffId } = await provisionOrganization({
    slug: draft.org.slug,
    name: draft.org.name,
    sector: draft.org.sector,
    country: draft.org.country,
    size: draft.org.size,
    apps: draft.apps as OrgApp[],
    source: 'self_serve',
    admin: { name: adminName, email: draft.email, passwordHash: draft.passwordHash },
  })

  // Everything from here runs inside the new company's database.
  setRequestOrg(event, org.id)

  const inviteResults: { email: string, sent: boolean, error?: string }[] = []
  for (const invite of invites) {
    try {
      const { emailSent } = await inviteStaffMember({
        name: invite.email.split('@')[0]!,
        email: invite.email,
        roles: SIGNUP_ROLES[invite.role]!.roles,
      })
      inviteResults.push({ email: invite.email, sent: emailSent })
    }
    catch (error: any) {
      inviteResults.push({ email: invite.email, sent: false, error: error?.statusMessage ?? error?.message ?? 'failed' })
    }
  }

  const user: SessionUser = { id: adminStaffId, name: adminName, email: draft.email, roles: ['admin'] }
  await startUserSession(event, user)
  await recordAudit({ actorName: adminName, orgId: org.id, action: 'workspace.created', detail: `Self-serve sign-up (${org.apps.join(', ')})` })

  setResponseStatus(event, 201)
  return { user: { ...user, org: await sessionOrgSummary() }, invites: inviteResults }
})
