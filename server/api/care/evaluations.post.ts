import type { CareEvaluation } from '../../../app/types/care'

const POINTS = { met: 1, partly: 0.5, missed: 0 } as const

/** Score one conversation against the client's scorecard (weighted). */
export default defineEventHandler(async (event) => {
  const user = await requirePlatformStaff(event)
  const body = await readBody<{ engagementId?: string, refType?: 'chat' | 'ticket', refId?: string, refTitle?: string, agentName?: string, scores?: CareEvaluation['scores'], note?: string, shared?: boolean }>(event) ?? {}
  const engagement = await loadEngagement(body.engagementId ?? '')
  if (!engagement || !body.refId || (body.refType !== 'chat' && body.refType !== 'ticket'))
    throw createError({ statusCode: 400, statusMessage: 'Pick a conversation to evaluate' })

  const scores = engagement.scorecard.map((row) => {
    const given = body.scores?.find(s => s.label === row.label)?.result
    if (!given || !(given in POINTS))
      throw createError({ statusCode: 400, statusMessage: `Score "${row.label}"` })
    return { label: row.label, weight: row.weight, result: given }
  })
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
  const score = Math.round((scores.reduce((sum, s) => sum + s.weight * POINTS[s.result], 0) / totalWeight) * 100)

  // Match the evaluated agent to a Canopy staff member, so their desktop shows their quality.
  const agent = body.agentName ? await useTenantDb().prepare('SELECT id, name FROM staff WHERE name = ? LIMIT 1').get(body.agentName) as { id: string, name: string } | undefined : undefined

  await ensureCareTables()
  const id = careId()
  await useControlDb().prepare(`
    INSERT INTO cp_care_evaluations (id, engagement_id, org_id, ref_type, ref_id, ref_title, agent_id, agent_name, evaluator_id, evaluator_name, scores, score, note, shared, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, engagement.id, engagement.orgId, body.refType, body.refId, (body.refTitle ?? body.refId).slice(0, 200), agent?.id ?? null, agent?.name ?? body.agentName ?? null, user.id, user.name, JSON.stringify(scores), score, body.note?.trim().slice(0, 2000) || null, body.shared ? 1 : 0, new Date().toISOString())
  setResponseStatus(event, 201)
  return { score }
})
