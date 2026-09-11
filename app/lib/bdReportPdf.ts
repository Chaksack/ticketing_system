import type { BdReportSummary } from '~/types/bd-report'
import { jsPDF } from 'jspdf'
import { addBrandHeader, addPageFooter, formatPdfDate, loadLogoDataUrl, sectionTitle, statLine, table, titleCase } from '~/lib/pdfBranding'

export async function downloadBdReportPdf(summary: BdReportSummary) {
  // eslint-disable-next-line new-cap -- jsPDF is the library's real export name
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogoDataUrl()

  let y = addBrandHeader(doc, {
    title: 'Intelligent Building Solutions',
    subtitle: 'BD & SM Report',
    topRight: `${formatPdfDate(summary.range.from)} – ${formatPdfDate(summary.range.to)}`,
    bottomRight: `Generated ${formatPdfDate(new Date().toISOString())}`,
    logo,
  })

  // Leads
  y = sectionTitle(doc, y, 'Leads')
  y = statLine(doc, y, [
    { label: 'New Leads', value: String(summary.leads.newCount) },
    { label: 'Converted', value: String(summary.leads.convertedCount) },
    { label: 'Conversion Rate', value: `${summary.leads.conversionRate}%` },
    { label: 'Pipeline Value', value: summary.leads.estimatedValueTotal.toLocaleString() },
    { label: 'Weighted Value', value: summary.leads.weightedValueTotal.toLocaleString() },
  ])
  y = statLine(doc, y, [
    { label: 'Win Rate (Decided)', value: summary.leads.winRate === null ? 'N/A' : `${summary.leads.winRate}%` },
    { label: 'Avg Deal Size', value: summary.leads.averageDealSize === null ? 'N/A' : summary.leads.averageDealSize.toLocaleString() },
    { label: 'Avg Sales Cycle', value: summary.leads.avgSalesCycleDays === null ? 'N/A' : `${summary.leads.avgSalesCycleDays} days` },
  ])
  y = table(doc, y, ['Stage', 'Count'], summary.leads.byStage.map(row => [titleCase(row.stage), row.count]))
  y = table(doc, y, ['Source', 'Count'], summary.leads.bySource.map(row => [row.source, row.count]))

  // Tenders
  y = sectionTitle(doc, y, 'Tenders')
  y = statLine(doc, y, [
    { label: 'New Tenders', value: String(summary.tenders.newCount) },
    { label: 'Won', value: String(summary.tenders.convertedCount) },
    { label: 'Win Rate', value: `${summary.tenders.conversionRate}%` },
    { label: 'Pipeline Value', value: summary.tenders.estimatedValueTotal.toLocaleString() },
    { label: 'Weighted Value', value: summary.tenders.weightedValueTotal.toLocaleString() },
  ])
  y = statLine(doc, y, [
    { label: 'Win Rate (Decided)', value: summary.tenders.winRate === null ? 'N/A' : `${summary.tenders.winRate}%` },
    { label: 'Avg Deal Size', value: summary.tenders.averageDealSize === null ? 'N/A' : summary.tenders.averageDealSize.toLocaleString() },
    { label: 'Avg Sales Cycle', value: summary.tenders.avgSalesCycleDays === null ? 'N/A' : `${summary.tenders.avgSalesCycleDays} days` },
  ])
  y = table(doc, y, ['Stage', 'Count'], summary.tenders.byStage.map(row => [titleCase(row.stage), row.count]))
  y = table(doc, y, ['Source', 'Count'], summary.tenders.bySource.map(row => [row.source, row.count]))

  // Clients
  y = sectionTitle(doc, y, 'Clients')
  y = statLine(doc, y, [
    { label: 'New Clients', value: String(summary.clients.newCount) },
    { label: 'Stage Changes', value: String(summary.clients.stageChanges) },
  ])
  y = table(doc, y, ['Stage', 'Count'], summary.clients.byStage.map(row => [titleCase(row.stage), row.count]))

  // AMC
  y = sectionTitle(doc, y, 'AMC Contracts')
  y = statLine(doc, y, [
    { label: 'New Contracts', value: String(summary.amc.newContracts) },
  ])
  y = table(doc, y, ['Status', 'Count'], summary.amc.byStatus.map(row => [titleCase(row.status), row.count]))
  y = table(doc, y, ['Currency', 'Total Value'], summary.amc.valueByCurrency.map(row => [row.currency, row.total.toLocaleString()]))

  // Tasks & Projects
  y = sectionTitle(doc, y, 'Tasks & Projects')
  statLine(doc, y, [
    { label: 'Tasks Completed', value: String(summary.tasks.completedCount) },
    { label: 'New Projects', value: String(summary.projects.newCount) },
  ])

  addPageFooter(doc)

  doc.save(`bd-sm-report_${summary.range.from}_${summary.range.to}.pdf`)
}
