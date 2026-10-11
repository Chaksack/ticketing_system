import type { OnboardingPatch } from '../../../utils/onboardings'

export default defineEventHandler(async (event) => {
  const staff = await requirePlatformStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<OnboardingPatch>(event)

  const before = await getOnboarding(id)
  const onboarding = await updateOnboarding(id, body ?? {})

  // Signature steps are the legally meaningful ones — record who marked them.
  for (const step of ['legalReview', 'clientSigned', 'canopyCountersigned'] as const) {
    if (before.agreement[step] !== onboarding.agreement[step])
      await recordAudit({ actorId: staff.id, actorName: staff.name, orgId: onboarding.orgId, action: `agreement.${step}.${onboarding.agreement[step]}`, detail: `${onboarding.id} · ${onboarding.clientName}` })
  }
  return { onboarding }
})
