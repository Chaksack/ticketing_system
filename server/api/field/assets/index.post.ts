import type { AssetRow } from '../../../utils/field'

interface AssetBody { id?: string, clientId?: string | null, name?: string, model?: string, serial?: string, location?: string, installedAt?: string, notes?: string }

/** Create (no `id`) or update (`id`) an asset. */
export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  const body = await readBody<AssetBody>(event) ?? {}
  const name = body.name?.trim()
  if (!name)
    throw createError({ statusCode: 400, statusMessage: 'Give the asset a name' })
  await ensureDb()
  const db = useTenantDb()
  const now = new Date().toISOString()
  const values = [body.clientId || null, name.slice(0, 200), body.model?.trim() || null, body.serial?.trim() || null, body.location?.trim() || null, body.installedAt || null, body.notes?.trim() || null]

  let id = body.id
  if (id) {
    const updated = await db.prepare('UPDATE field_assets SET client_id = ?, name = ?, model = ?, serial = ?, location = ?, installed_at = ?, notes = ?, updated_at = ? WHERE id = ? RETURNING id').get(...values, now, id)
    if (!updated)
      throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }
  else {
    id = await nextPrefixedId('field_asset', 'AST')
    await db.prepare('INSERT INTO field_assets (id, client_id, name, model, serial, location, installed_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, ...values, now, now)
    setResponseStatus(event, 201)
  }
  const row = await db.prepare(`${ASSET_SELECT} WHERE field_assets.id = ?`).get(id) as AssetRow
  return { asset: mapAssetRow(row) }
})
