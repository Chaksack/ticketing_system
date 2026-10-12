import type { CareEngagement } from '../../../../app/types/care'
import { CARE_MODELS, CARE_STAGES } from '../../../../app/types/care'

/** Save the engagement (scope, model, playbook, checklist, scorecard, agents, stage). */
export default defineEventHandler(async (event) => {
  const user = await requirePlatformStaff(event)
  const existing = await loadEngagement(getRouterParam(event, 'id') ?? '')
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Engagement not found' })
  const body = await readBody<Partial<CareEngagement>>(event) ?? {}

  const stage = [...CARE_STAGES.map(s => s.value), 'ended'].includes(body.stage ?? '') ? body.stage! : existing.stage
  const scorecard = (body.scorecard ?? existing.scorecard).filter(r => r.label?.trim()).slice(0, 12).map(r => ({ label: r.label.trim().slice(0, 80), weight: Math.max(1, Math.min(100, Math.round(Number(r.weight) || 1))) }))
  if (!scorecard.length)
    throw createError({ statusCode: 400, statusMessage: 'The scorecard needs at least one line' })
  // Going live needs the transition checklist done — that's the point of having one.
  if (stage === 'live' && existing.stage !== 'live' && (body.checklist ?? existing.checklist).some(item => !item.done))
    throw createError({ statusCode: 400, statusMessage: 'Finish the transition checklist before going live' })

  const text = (value: string | undefined, fallback: string, max = 2000) => (value ?? fallback).slice(0, max)
  const next: CareEngagement = {
    ...existing,
    stage,
    model: CARE_MODELS.some(m => m.value === body.model) ? body.model! : existing.model,
    channels: (body.channels ?? existing.channels).slice(0, 10),
    reasons: (body.reasons ?? existing.reasons).filter(r => r.label?.trim()).slice(0, 20).map(r => ({ label: r.label.trim().slice(0, 100), inScope: !!r.inScope })),
    hours: text(body.hours, existing.hours, 120),
    languages: text(body.languages, existing.languages, 200),
    monthlyContacts: Math.max(0, Math.round(Number(body.monthlyContacts ?? existing.monthlyContacts) || 0)),
    ahtMinutes: Math.max(1, Math.min(120, Number(body.ahtMinutes ?? existing.ahtMinutes) || 1)),
    greeting: text(body.greeting, existing.greeting, 400),
    slaText: text(body.slaText, existing.slaText, 200),
    replyTargetSeconds: Math.max(10, Math.min(86400, Math.round(Number(body.replyTargetSeconds ?? existing.replyTargetSeconds) || 120))),
    dos: text(body.dos, existing.dos),
    donts: text(body.donts, existing.donts),
    checklist: (body.checklist ?? existing.checklist).slice(0, 20).map(i => ({ label: String(i.label).slice(0, 200), done: !!i.done })),
    scorecard,
    agentIds: (body.agentIds ?? existing.agentIds).slice(0, 100),
    recommendations: (body.recommendations ?? existing.recommendations).slice(0, 20).map(r => ({ id: r.id || careId(), text: String(r.text).slice(0, 500), approvedAt: r.approvedAt, approvedBy: r.approvedBy })),
  }
  const saved = await saveEngagement(next)
  if (stage !== existing.stage)
    await recordAudit({ actorId: user.id, actorName: user.name, orgId: existing.orgId, action: 'care.stage_changed', detail: `${existing.stage} → ${stage}` })
  return { engagement: saved }
})
