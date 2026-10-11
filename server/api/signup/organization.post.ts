import { ORG_SECTORS, ORG_SIZES } from '../../../app/types/organization'

// Step 2 — organisation, workspace address and sector.
export default defineEventHandler(async (event) => {
  const draft = await requireSignupDraft(event)
  const body = await readBody<{ name?: string, slug?: string, country?: string, size?: string, sector?: string }>(event)

  const name = body?.name?.trim()
  if (!name)
    throw createError({ statusCode: 400, statusMessage: 'Organisation name is required' })

  const slugCheck = await checkSlugAvailable(body?.slug ?? '')
  if (!slugCheck.available)
    throw createError({ statusCode: 409, statusMessage: slugCheck.reason ?? 'That workspace address is not available' })

  const sector = ORG_SECTORS.some(s => s.name === body?.sector) ? body!.sector : 'Other'
  const size = ORG_SIZES.includes(body?.size as typeof ORG_SIZES[number]) ? body!.size : undefined

  await saveSignupDraft(event, {
    ...draft,
    org: { name, slug: slugCheck.slug, country: body?.country?.trim() || undefined, size, sector },
  })
  return { ok: true, slug: slugCheck.slug }
})
