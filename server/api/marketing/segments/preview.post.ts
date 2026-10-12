import type { SegmentCondition } from '../../../../app/types/marketing'

/** Live member count while the conditions are being edited (not saved). */
export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  await ensureDb()
  const { conditions } = await readBody<{ conditions?: SegmentCondition[] }>(event) ?? {}
  return { preview: await previewSegment((conditions ?? []).slice(0, 20)) }
})
