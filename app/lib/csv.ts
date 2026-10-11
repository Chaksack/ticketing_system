const BOM = String.fromCharCode(0xFEFF)

type CsvValue = string | number | boolean | null | undefined

function csvCell(value: CsvValue) {
  const text = value === null || value === undefined ? '' : String(value)
  // Leading = + - @ would run as a formula when the file is opened in Excel.
  const safe = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Download rows as a CSV file (UTF-8 with BOM so Excel shows ₵ and accents correctly). */
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const body = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`${BOM}${body}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
