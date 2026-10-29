import type { TagRow } from '../../utils/mappers'

/** Rename or recolour a tag (everywhere it's used). */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ name?: string, color?: string }>(event) ?? {}
  const db = useTenantDb()
  const existing = await db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
  const name = body.name?.trim().slice(0, 40) || existing.name
  if (name !== existing.name && await db.prepare('SELECT id FROM tags WHERE LOWER(name) = LOWER(?) AND id <> ?').get(name, id))
    throw createError({ statusCode: 409, statusMessage: `There's already a tag called ${name}` })
  const color = body.color?.trim().slice(0, 20) || existing.color
  await db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, id)
  return { tag: { id, name, color } }
})
