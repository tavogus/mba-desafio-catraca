export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidCard(cardNumber: string): boolean {
  return /^\d{16}$/.test(cardNumber)
}

export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  if (!/^\/[A-Za-z0-9/_\-.?=&%]*$/.test(value)) return null
  return value
}
