export const CHECKIN = {
  invalid: 'Ingresso inválido para este evento',
  cancelled: 'Evento cancelado',
  unconfirmed: 'Ingresso não confirmado',
  used: 'Ingresso já utilizado',
  released: 'Entrada liberada',
} as const

export type CheckinMessage = (typeof CHECKIN)[keyof typeof CHECKIN]

export const CHECKIN_MESSAGES: ReadonlySet<string> = new Set(Object.values(CHECKIN))

export const TICKET_STATUS_LABEL: Record<string, string> = {
  pending: 'pendente',
  confirmed: 'confirmado',
  declined: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado',
}
