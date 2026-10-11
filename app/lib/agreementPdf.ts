import type { ClientOnboarding } from '~/types/organization'
import { jsPDF } from 'jspdf'
import { addBrandHeader, addPageFooter, formatPdfDate, loadLogoDataUrl, sectionTitle, statLine, table } from '~/lib/pdfBranding'
import { ORG_APPS, ORG_PLANS } from '~/types/organization'

/** Customer Service Agreement + SLA schedule for a client onboarding, to send for signature. */
export async function downloadAgreementPdf(onboarding: ClientOnboarding) {
  // eslint-disable-next-line new-cap -- jsPDF is the library's real export name
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogoDataUrl()

  let y = addBrandHeader(doc, {
    title: 'Canopy',
    subtitle: 'Customer Service Agreement & SLA',
    topRight: onboarding.clientName,
    bottomRight: `${onboarding.id} · Draft ${formatPdfDate(new Date().toISOString())}`,
    logo,
  })

  y = sectionTitle(doc, y, 'Client')
  y = statLine(doc, y, [
    { label: 'Client', value: onboarding.clientName },
    { label: 'Plan', value: ORG_PLANS.find(p => p.id === onboarding.plan)?.label ?? onboarding.plan },
    { label: 'Users (est.)', value: onboarding.usersEstimate ? String(onboarding.usersEstimate) : '—' },
  ])
  y = table(doc, y, ['Detail', 'Value'], [
    ['Sector', onboarding.sector ?? '—'],
    ['Country', onboarding.country ?? '—'],
    ['Administrator', onboarding.contactName ? `${onboarding.contactName} <${onboarding.contactEmail ?? ''}>` : '—'],
    ['Workspace address', onboarding.slug ?? '—'],
    ['Apps', ORG_APPS.filter(app => onboarding.apps.includes(app.id)).map(app => app.label).join(', ')],
  ])

  y = sectionTitle(doc, y, 'Customer Service Agreement (CSA)')
  y = table(doc, y, ['Term', 'Agreed'], [
    ['Support channels', onboarding.csa.channels.join(', ') || '—'],
    ['Support hours', onboarding.csa.hours],
    ['Agreement term', onboarding.csa.term],
    ['Authorised client contacts', onboarding.csa.contacts || '—'],
    ['Escalation path', onboarding.csa.escalationPath.filter(Boolean).join(' → ')],
    ['Data Processing Agreement', onboarding.csa.attachDpa ? 'Attached (security schedule included)' : 'Not attached'],
  ])

  y = sectionTitle(doc, y, `Service Level Agreement (SLA) · ${onboarding.sla.tier[0]!.toUpperCase()}${onboarding.sla.tier.slice(1)}`)
  y = table(doc, y, ['Commitment', 'Target'], [
    ['Monthly uptime commitment', onboarding.sla.uptime],
    ['Planned maintenance', onboarding.sla.maintenance],
    ['Data recovery (RPO / RTO)', onboarding.sla.recovery],
  ])
  y = table(doc, y, ['Priority', 'Definition', 'First response', 'Resolution target'], onboarding.sla.rows.map(row => [row.priority, row.definition, row.firstResponse, row.resolution]))
  y = table(doc, y, ['Service credits'], [[onboarding.sla.serviceCredits]])

  y = sectionTitle(doc, y, 'Signatures')
  table(doc, y, ['Party', 'Name', 'Signature', 'Date'], [
    [onboarding.clientName, onboarding.contactName ?? '', '', ''],
    ['Canopy', onboarding.ownerName ?? '', '', ''],
  ])

  addPageFooter(doc)
  doc.save(`canopy-agreement_${onboarding.slug ?? onboarding.id}.pdf`)
}
