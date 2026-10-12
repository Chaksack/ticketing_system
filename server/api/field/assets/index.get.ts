import type { AssetRow } from '../../../utils/field'

export default defineEventHandler(async (event) => {
  await requireFieldStaff(event)
  await ensureDb()
  const clientId = getQuery(event).clientId
  const rows = typeof clientId === 'string' && clientId
    ? await useTenantDb().prepare(`${ASSET_SELECT} WHERE field_assets.client_id = ? ORDER BY field_assets.name`).all(clientId) as AssetRow[]
    : await useTenantDb().prepare(`${ASSET_SELECT} ORDER BY field_assets.name`).all() as AssetRow[]
  return { assets: rows.map(mapAssetRow) }
})
