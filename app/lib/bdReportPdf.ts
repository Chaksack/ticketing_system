import type { BdReportSummary } from '~/types/bd-report'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const BRAND_GREEN: [number, number, number] = [20, 83, 45] // Tailwind green-900
const ACCENT_GREEN: [number, number, number] = [22, 163, 74] // Tailwind green-600
const MUTED: [number, number, number] = [107, 114, 128]

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function loadLogoDataUrl(): Promise<string | null> {
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

export async function downloadBdReportPdf(summary: BdReportSummary) {
  // eslint-disable-next-line new-cap -- jsPDF is the library's real export name
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const logo = await loadLogoDataUrl()

  // Header band
  doc.setFillColor(...BRAND_GREEN)
  doc.rect(0, 0, pageWidth, 28, 'F')

  if (logo) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(12, 6, 16, 16, 2, 2, 'F')
    doc.addImage(logo, 'PNG', 13.5, 7.5, 13, 13)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Intelligent Building Solutions', logo ? 32 : 12, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('BD & SM Report', logo ? 32 : 12, 20)

  doc.setFontSize(9)
  doc.text(`${formatDate(summary.range.from)} – ${formatDate(summary.range.to)}`, pageWidth - 12, 13, { align: 'right' })
  doc.text(`Generated ${formatDate(new Date().toISOString())}`, pageWidth - 12, 20, { align: 'right' })

  let y = 38

  function sectionTitle(title: string) {
    doc.setTextColor(...BRAND_GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(title, 12, y)
    y += 3
    doc.setDrawColor(...ACCENT_GREEN)
    doc.setLineWidth(0.5)
    doc.line(12, y, pageWidth - 12, y)
    y += 6
  }

  function statLine(stats: { label: string, value: string }[]) {
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
      doc.setTextColor(...MUTED)
      doc.text(stat.label, x, y + 5)
      doc.setTextColor(30, 30, 30)
    })
    y += 14
  }

  function table(head: string[], body: (string | number)[][]) {
    if (!body.length) {
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.text('No data in this range.', 12, y)
      y += 8
      return
    }

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: 12, right: 12 },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: BRAND_GREEN, textColor: 255 },
      theme: 'striped',
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Leads
  sectionTitle('Leads')
  statLine([
    { label: 'New Leads', value: String(summary.leads.newCount) },
    { label: 'Converted', value: String(summary.leads.convertedCount) },
    { label: 'Conversion Rate', value: `${summary.leads.conversionRate}%` },
  ])
  table(['Stage', 'Count'], summary.leads.byStage.map(row => [titleCase(row.stage), row.count]))
  table(['Source', 'Count'], summary.leads.bySource.map(row => [row.source, row.count]))

  // Clients
  sectionTitle('Clients')
  statLine([
    { label: 'New Clients', value: String(summary.clients.newCount) },
    { label: 'Stage Changes', value: String(summary.clients.stageChanges) },
  ])
  table(['Stage', 'Count'], summary.clients.byStage.map(row => [titleCase(row.stage), row.count]))

  // AMC
  sectionTitle('AMC Contracts')
  statLine([
    { label: 'New Contracts', value: String(summary.amc.newContracts) },
  ])
  table(['Status', 'Count'], summary.amc.byStatus.map(row => [titleCase(row.status), row.count]))
  table(['Currency', 'Total Value'], summary.amc.valueByCurrency.map(row => [row.currency, row.total.toLocaleString()]))

  // Tasks & Projects
  sectionTitle('Tasks & Projects')
  statLine([
    { label: 'Tasks Completed', value: String(summary.tasks.completedCount) },
    { label: 'New Projects', value: String(summary.projects.newCount) },
  ])

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('www.ibsgh.com', 12, pageHeight - 8)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 12, pageHeight - 8, { align: 'right' })
  }

  doc.save(`bd-sm-report_${summary.range.from}_${summary.range.to}.pdf`)
}
