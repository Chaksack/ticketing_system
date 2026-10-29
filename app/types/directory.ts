/**
 * The light client and project list every staff member can read (GET /api/directory/customers),
 * for pickers and matching a requester's email to a client. Full client records stay with sales
 * and admins (the Clients pages).
 */
export interface DirectoryClient {
  id: string
  name: string
  stage: string
  contactName?: string
  /** Every email that belongs to this client: main contact, extra emails and named contacts. */
  emails: string[]
  contacts: { name: string, title?: string, email?: string }[]
}

export interface DirectoryProject {
  id: string
  name: string
  clientId: string
  status: string
}
