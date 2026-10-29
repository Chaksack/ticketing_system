import type { DirectoryClient, DirectoryProject } from '../../../app/types/directory'

/**
 * Client and project names for pickers on cases, chats and field service — readable by any staff
 * member, unlike the full client records (sales and admins only). Nothing financial is included.
 */
export default defineEventHandler(async (event): Promise<{ clients: DirectoryClient[], projects: DirectoryProject[] }> => {
  await requireSessionUser(event)
  await ensureDb()
  const db = useTenantDb()
  const rows = await db.prepare('SELECT id, name, stage, contact_name, contact_email FROM clients ORDER BY name').all() as { id: string, name: string, stage: string, contact_name: string | null, contact_email: string | null }[]
  const contacts = await db.prepare('SELECT client_id, name, title, email FROM client_contacts').all() as { client_id: string, name: string, title: string | null, email: string | null }[]
  const extra = await db.prepare('SELECT client_id, email FROM client_contact_emails').all() as { client_id: string, email: string }[]
  const projects = await db.prepare('SELECT id, name, client_id, status FROM projects ORDER BY name').all() as { id: string, name: string, client_id: string, status: string }[]

  return {
    clients: rows.map((row) => {
      const own = contacts.filter(c => c.client_id === row.id)
      const emails = [row.contact_email, ...own.map(c => c.email), ...extra.filter(e => e.client_id === row.id).map(e => e.email)]
        .filter((email): email is string => !!email)
        .map(email => email.trim().toLowerCase())
      return {
        id: row.id,
        name: row.name,
        stage: row.stage,
        contactName: row.contact_name ?? undefined,
        emails: [...new Set(emails)],
        contacts: own.map(c => ({ name: c.name, title: c.title ?? undefined, email: c.email ?? undefined })),
      }
    }),
    projects: projects.map(p => ({ id: p.id, name: p.name, clientId: p.client_id, status: p.status })),
  }
})
