import { randomBytes } from 'node:crypto'

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newId(prefix: string): string {
  const bytes = randomBytes(8)
  let body = ''
  for (const byte of bytes) body += ID_ALPHABET[byte % ID_ALPHABET.length]
  return `${prefix}_${body}`
}

export function newCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return code
}
