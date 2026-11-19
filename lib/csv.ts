/**
 * CSV helpers shared by every export (F-44).
 *
 * Spreadsheet apps execute cells that start with =, +, -, @ (and tab/CR) as formulas, so a
 * student named "=HYPERLINK(...)" could run code on whoever opens the export. Such text is
 * prefixed with an apostrophe. Plain numbers (including negatives) are left alone.
 */
const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

export function neutralizeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Plain numbers and the "-" placeholder used for empty cells are not formulas.
  if (typeof value === 'number' || PLAIN_NUMBER.test(text) || text === '-') return text
  return FORMULA_START.test(text) ? `'${text}` : text
}

export function csvCell(value: string | number | null | undefined): string {
  return `"${neutralizeCsvValue(value).replaceAll('"', '""')}"`
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
