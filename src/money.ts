export function parseReaisToCents(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!trimmed) return null
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, frac = ''] = normalized.split('.')
  if (whole.length > 7) return null
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

export function formatReais(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(Math.trunc(cents))
  const reais = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${negative ? '-' : ''}${grouped},${frac}`
}

export function centsToInput(cents: number): string {
  const reais = Math.floor(Math.abs(cents) / 100)
  const frac = String(Math.abs(cents) % 100).padStart(2, '0')
  return `${reais},${frac}`
}

export function parseCapacity(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value) || value < 1 || value > 100_000) return null
  return value
}
