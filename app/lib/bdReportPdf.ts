import type { BdReportSummary } from '~/types/bd-report'
import type { BdQuotaProgress } from '~/types/quota'
import { jsPDF } from 'jspdf'
import { addBrandHeader, addPageFooter, formatPdfDate, loadLogoDataUrl, sectionTitle, statLine, table, titleCase } from '~/lib/pdfBranding'

function formatPdfDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export async function downloadBdReportPdf(summary: BdReportSummary, quota?: { label: string, progress: BdQuotaProgress[] }) {
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
  y = statLine(doc, y, [
    { label: 'Tasks Completed', value: String(summary.tasks.completedCount) },
    { label: 'Tasks Overdue (now)', value: String(summary.tasksOverdue) },
    { label: 'New Projects', value: String(summary.projects.newCount) },
  ])
  y = table(doc, y, ['Project Status (all projects, now)', 'Count'], summary.projects.byStatus.map(row => [titleCase(row.status), row.count]))

  // Project payments
  y = sectionTitle(doc, y, 'Project Payments')
  y = table(
    doc,
    y,
    ['Currency', 'Payments Received', 'Costs Incurred', 'Still Due (now)', 'Projects With Balance'],
    summary.projectFinancials.map(row => [row.currency, row.paymentsReceived.toLocaleString(), row.costsIncurred.toLocaleString(), row.outstandingDue.toLocaleString(), row.projectsWithBalance]),
  )

  // Quotes & orders
  y = sectionTitle(doc, y, 'Quotes & Orders')
  y = statLine(doc, y, [
    { label: 'Quotes Created', value: String(summary.quotes.createdCount) },
    ...summary.quotes.ordersByCurrency.map(row => ({ label: `Confirmed Orders (${row.count})`, value: `${row.currency} ${row.total.toLocaleString()}` })),
  ])
  y = table(doc, y, ['Quote Status', 'Count', 'Value'], summary.quotes.byStatus.map(row => [titleCase(row.status), row.count, row.value.toLocaleString()]))

  // Quota progress
  if (quota) {
    y = sectionTitle(doc, y, `Quota Progress (${quota.label})`)
    y = table(
      doc,
      y,
      ['Rep', 'Won Value', 'Target', '% of Target'],
      quota.progress.map(rep => [rep.staffName, rep.achievedValue.toLocaleString(), rep.targetValue === null ? 'No target' : rep.targetValue.toLocaleString(), rep.percent === null ? '—' : `${rep.percent}%`]),
    )
  }

  // Rep scorecard
  y = sectionTitle(doc, y, 'Rep Scorecard')
  y = table(
    doc,
    y,
    ['Rep', 'New Leads', 'New Tenders', 'Won', 'Lost', 'Won Value', 'Activities', 'Interactions', 'Tasks Done'],
    summary.reps.map(rep => [rep.staffName, rep.newLeads, rep.newTenders, rep.dealsWon, rep.dealsLost, rep.wonValue.toLocaleString(), rep.calendarActivities, rep.interactionsLogged, rep.tasksCompleted]),
  )

  // Calendar activity
  y = sectionTitle(doc, y, 'Calendar Activity')
  y = statLine(doc, y, [
    { label: 'Total Activities', value: String(summary.calendar.totalCount) },
    { label: 'Completed', value: String(summary.calendar.completedCount) },
    { label: 'Still Scheduled', value: String(summary.calendar.scheduledCount) },
    { label: 'Linked to Deal/Client', value: String(summary.calendar.linkedCount) },
  ])
  y = table(doc, y, ['Activity Type', 'Count'], summary.calendar.byType.map(row => [row.type, row.count]))
  y = table(
    doc,
    y,
    ['When', 'Type', 'Activity', 'Regarding', 'Staff'],
    summary.calendar.events.map(event => [
      formatPdfDateTime(event.startAt),
      event.activityType,
      event.location ? `${event.title} (${event.location})` : event.title,
      event.regardingType ? `${titleCase(event.regardingType)}: ${event.regardingLabel ?? '(deleted)'}` : '—',
      event.staff.join(', ') || '—',
    ]),
  )

  // Interactions
  y = sectionTitle(doc, y, 'Logged Interactions')
  y = statLine(doc, y, [
    { label: 'Total Logged', value: String(summary.interactions.totalCount) },
    ...summary.interactions.byType.map(row => ({ label: titleCase(row.type), value: String(row.count) })),
  ])

  // Coming up
  y = sectionTitle(doc, y, 'Coming Up (Next 14 Days)')
  y = table(
    doc,
    y,
    ['When', 'Type', 'Activity', 'Regarding', 'Staff'],
    summary.upcoming.events.map(event => [
      formatPdfDateTime(event.startAt),
      event.activityType,
      event.title,
      event.regardingType ? `${titleCase(event.regardingType)}: ${event.regardingLabel ?? '(deleted)'}` : '—',
      event.staff.join(', ') || '—',
    ]),
  )
  table(
    doc,
    y,
    ['Tender Deadline', 'Tender', 'Stage', 'Est. Value'],
    summary.upcoming.tenderDeadlines.map(tender => [formatPdfDate(tender.submissionDeadline), tender.title, titleCase(tender.stage), tender.estimatedValue?.toLocaleString() ?? '—']),
  )

  addPageFooter(doc)

  doc.save(`bd-sm-report_${summary.range.from}_${summary.range.to}.pdf`)
}
