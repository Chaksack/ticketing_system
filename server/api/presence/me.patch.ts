import type { PresenceRow } from '../../utils/presence'

interface UpdatePresenceBody {
  override?: 'auto' | 'in_meeting' | 'offline'
  statusText?: string | null
  statusEmoji?: string | null
  statusExpiresAt?: string | null
}

const VALID_OVERRIDES = new Set(['auto', 'in_meeting', 'offline'])

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<UpdatePresenceBody>(event)

  if (body.override !== undefined && !VALID_OVERRIDES.has(body.override)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid presence override' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id, last_active_at, presence_override, status_text, status_emoji, status_expires_at FROM staff WHERE id = ?').get(user.id) as PresenceRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Staff member not found' })
  }

  const override = body.override ?? existing.presence_override
  const statusText = body.statusText !== undefined ? body.statusText : existing.status_text
  const statusEmoji = body.statusEmoji !== undefined ? body.statusEmoji : existing.status_emoji
  const statusExpiresAt = body.statusExpiresAt !== undefined ? body.statusExpiresAt : existing.status_expires_at

  await db.prepare(`
    UPDATE staff
    SET presence_override = ?, status_text = ?, status_emoji = ?, status_expires_at = ?, last_active_at = ?
    WHERE id = ?
  `).run(override, statusText, statusEmoji, statusExpiresAt, new Date().toISOString(), user.id)

  const row = await db.prepare('SELECT id, last_active_at, presence_override, status_text, status_emoji, status_expires_at FROM staff WHERE id = ?').get(user.id) as PresenceRow
  return { presence: mapPresenceRow(row) }
})
