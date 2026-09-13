import type { NewInvoiceInput } from '../../../../utils/invoices'
import type { ClientRow } from '../../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBilling(event)

  const clientId = getRouterParam(event, 'id')
  const body = await readBody<NewInvoiceInput>(event)

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  await ensureDb()
  const db = useDatabase()

  const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as ClientRow | undefined
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const lineItems = body?.lineItems ?? []
  const discount = body.discount ?? 0
  const subtotal = computeInvoiceSubtotal(lineItems)
  const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0

  // A large discount goes through approval instead of creating the invoice immediately — the
  // same gate applies wherever an invoice can be created, see server/utils/invoices.ts.
  if (discountPct > DISCOUNT_APPROVAL_THRESHOLD_PCT) {
    const approval = await createApprovalRequest({
      type: 'invoice_discount',
      subjectLabel: `Invoice for ${client.name} — ${discountPct.toFixed(0)}% discount`,
      payload: { clientId, invoicePayload: body, requestedBy: user.id, requestedByName: user.name },
      requestedBy: user.id,
    })

    setResponseStatus(event, 202)
    return { pending: true, approval }
  }

  const { client: updatedClient, invoice } = await createInvoiceForClient(clientId, body, user)

  setResponseStatus(event, 201)
  return { client: updatedClient, invoice }
})
