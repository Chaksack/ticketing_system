import type { CalendarEvent } from '~/types/calendar-event'
import { jsPDF } from 'jspdf'
import { addBrandHeader, addPageFooter, formatPdfDate, loadLogoDataUrl, sectionTitle, table } from '~/lib/pdfBranding'

function formatEventTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export async function downloadCalendarReportPdf(events: CalendarEvent[], range: { from: string, to: string }) {
  // eslint-disable-next-line new-cap -- jsPDF is the library's real export name
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogoDataUrl()

  let y = addBrandHeader(doc, {
    title: 'Intelligent Building Solutions',
    subtitle: 'Calendar Activity Report',
    topRight: `${formatPdfDate(range.from)} – ${formatPdfDate(range.to)}`,
    bottomRight: `Generated ${formatPdfDate(new Date().toISOString())}`,
    logo,
  })

  const byDay = new Map<string, CalendarEvent[]>()
  for (const calendarEvent of events) {
    const key = new Date(calendarEvent.startAt).toISOString().slice(0, 10)
    const list = byDay.get(key) ?? []
    list.push(calendarEvent)
    byDay.set(key, list)
  }

  const sortedDays = [...byDay.keys()].sort()

  if (!sortedDays.length) {
    y = sectionTitle(doc, y, 'Activities')
    table(doc, y, ['Time', 'Type', 'Title', 'Location', 'Attendees', 'Regarding'], [])
  }

  for (const day of sortedDays) {
    const dayEvents = [...byDay.get(day)!].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    y = sectionTitle(doc, y, new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    y = table(doc, y, ['Time', 'Type', 'Title', 'Location', 'Attendees', 'Regarding'], dayEvents.map(calendarEvent => [
      `${formatEventTime(calendarEvent.startAt)} – ${formatEventTime(calendarEvent.endAt)}`,
      calendarEvent.activityType || '—',
      calendarEvent.title,
      calendarEvent.location || '—',
      calendarEvent.attendees.map(a => a.name).join(', ') || '—',
      calendarEvent.regardingLabel || '—',
    ]))
  }

  addPageFooter(doc)

  doc.save(`calendar-report_${range.from.slice(0, 10)}_${range.to.slice(0, 10)}.pdf`)
}
