import type { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const PDF_COLORS = {
  brandGreen: [20, 83, 45] as [number, number, number], // Tailwind green-900
  accentGreen: [22, 163, 74] as [number, number, number], // Tailwind green-600
  muted: [107, 114, 128] as [number, number, number],
}

export function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatPdfDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/icons/logo.png')
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  catch {
    return null
  }
}

/** Draws the brand header band and returns the y position content should start at. */
export function addBrandHeader(doc: jsPDF, options: { title: string, subtitle: string, topRight?: string, bottomRight?: string, logo: string | null }): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(...PDF_COLORS.brandGreen)
  doc.rect(0, 0, pageWidth, 28, 'F')

  if (options.logo) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(12, 6, 16, 16, 2, 2, 'F')
    doc.addImage(options.logo, 'PNG', 13.5, 7.5, 13, 13)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(options.title, options.logo ? 32 : 12, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(options.subtitle, options.logo ? 32 : 12, 20)

  doc.setFontSize(9)
  if (options.topRight)
    doc.text(options.topRight, pageWidth - 12, 13, { align: 'right' })
  if (options.bottomRight)
    doc.text(options.bottomRight, pageWidth - 12, 20, { align: 'right' })

  return 38
}

/** Draws a section title with an underline and returns the y position to continue from. */
export function sectionTitle(doc: jsPDF, y: number, title: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setTextColor(...PDF_COLORS.brandGreen)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, 12, y)
  let nextY = y + 3
  doc.setDrawColor(...PDF_COLORS.accentGreen)
  doc.setLineWidth(0.5)
  doc.line(12, nextY, pageWidth - 12, nextY)
  nextY += 6
  return nextY
}

/** Draws a row of big-number stats and returns the y position to continue from. */
export function statLine(doc: jsPDF, y: number, stats: { label: string, value: string }[]): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const colWidth = (pageWidth - 24) / stats.length
  stats.forEach((stat, index) => {
    const x = 12 + index * colWidth
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(stat.value, x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...PDF_COLORS.muted)
    doc.text(stat.label, x, y + 5)
    doc.setTextColor(30, 30, 30)
  })
  return y + 14
}

/** Draws a table (or a "no data" line when empty) and returns the y position to continue from. */
export function table(doc: jsPDF, y: number, head: string[], body: (string | number)[][]): number {
  if (!body.length) {
    doc.setTextColor(...PDF_COLORS.muted)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('No data in this range.', 12, y)
    return y + 8
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: 12, right: 12 },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: PDF_COLORS.brandGreen, textColor: 255 },
    theme: 'striped',
  })
  return (doc as any).lastAutoTable.finalY + 10
}

export function addPageFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setTextColor(...PDF_COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('www.ibsgh.com', 12, pageHeight - 8)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 12, pageHeight - 8, { align: 'right' })
  }
}
