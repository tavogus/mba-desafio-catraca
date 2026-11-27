const ZONE = 'America/Sao_Paulo'

function parts(date: Date, withSeconds: boolean): Map<Intl.DateTimeFormatPartTypes, string> {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).formatToParts(date)
  return new Map(formatted.map((part) => [part.type, part.value]))
}

export function dateTimeLocalInSaoPaulo(date: Date): string {
  const map = parts(date, false)
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}T${map.get('hour')}:${map.get('minute')}`
}

export function formatStartsAtIso(date: Date): string {
  const map = parts(date, true)
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}T${map.get('hour')}:${map.get('minute')}:${map.get('second')}-03:00`
}

export function shiftDateTimeLocal(days: number, from = new Date()): string {
  return dateTimeLocalInSaoPaulo(new Date(from.getTime() + days * 24 * 60 * 60 * 1000))
}

export function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function parseSaoPauloDateTimeLocal(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.trim())
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] ?? '0')
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  const seconds = String(second).padStart(2, '0')
  const expected = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${seconds}-03:00`
  const date = new Date(expected)
  if (Number.isNaN(date.getTime())) return null
  if (formatStartsAtIso(date) !== expected) return null
  return date
}

export function isFutureInstant(date: Date, now = new Date()): boolean {
  return date.getTime() > now.getTime()
}
