import type { Quote } from '~/types/quote'
import { jsPDF } from 'jspdf'
import { addBrandHeader, addPageFooter, formatPdfDate, loadLogoDataUrl, sectionTitle, statLine, table } from '~/lib/pdfBranding'

export interface QuoteRecordInfo {
  recordName: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

export async function downloadQuotePdf(quote: Quote, record: QuoteRecordInfo) {
  // eslint-disable-next-line new-cap -- jsPDF is the library's real export name
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogoDataUrl()

  let y = addBrandHeader(doc, {
    title: 'Intelligent Building Solutions',
    subtitle: 'Quotation',
    topRight: `Quote #${quote.id}`,
    bottomRight: `Date: ${formatPdfDate(quote.createdAt)}`,
    logo,
  })

  y = sectionTitle(doc, y, 'Prepared For')
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const line of [record.recordName, record.contactName, record.contactEmail, record.contactPhone].filter((line): line is string => !!line)) {
    doc.text(line, 12, y)
    y += 5
  }
  y += 4

  const currency = quote.lineItems[0]?.currency ?? ''

  y = sectionTitle(doc, y, 'Line Items')
  y = table(doc, y, ['Product', 'Qty', 'Unit Price', 'Total'], quote.lineItems.map(item => [
    item.productName,
    item.quantity,
    `${item.unitPrice.toLocaleString()} ${item.currency}`,
    `${(item.unitPrice * item.quantity).toLocaleString()} ${item.currency}`,
  ]))

  y = statLine(doc, y, [
    { label: 'Total', value: `${quote.total.toLocaleString()} ${currency}` },
    { label: 'Status', value: quote.status.toUpperCase() },
  ])

  if (quote.notes) {
    y = sectionTitle(doc, y, 'Notes')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(quote.notes, doc.internal.pageSize.getWidth() - 24)
    doc.text(lines, 12, y)
  }

  addPageFooter(doc)

  doc.save(`quote_${quote.id}.pdf`)
}
