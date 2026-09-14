const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

// Ghana uses UTC year-round. Keep product schedule values independent of the
// admin device's time zone while retaining the existing API's UTC timestamps.
export function parseGhanaDateTime(value: string): Date | null {
  const match = DATE_TIME_PATTERN.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)))
  return date.toISOString().slice(0, 16) === value ? date : null
}

export function toGhanaDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16)
}

export function formatGhanaDate(dateValue: string): string {
  return new Intl.DateTimeFormat('en-GH', {
    timeZone: 'Africa/Accra',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateValue}T12:00:00Z`))
}
