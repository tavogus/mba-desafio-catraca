import { gatewayDelayFactor } from '../config.js'

export type GatewayOutcome = 'approved' | 'declined'

const FAST_MIN = 2_000
const FAST_MAX = 4_500
const SLOW_MIN = 30_000
const SLOW_MAX = 38_000

/**
 * O brief pede 2–5 s e 30–40 s. O sorteio fica em [2 s, 4,5 s] e [30 s, 38 s]
 * para a confirmação rápida caber em "até 5 segundos" e o cartão lento
 * continuar pendente antes dos 30 s e já ter respondido aos 45 s.
 */
export function gatewayPlan(
  cardNumber: string,
  randomValue = Math.random(),
  factor = gatewayDelayFactor(),
): { outcome: GatewayOutcome; delayMs: number } {
  const last4 = cardNumber.slice(-4)
  const slow = last4 === '0003' || last4 === '0004'
  const approved = last4 === '0001' || last4 === '0003'
  const min = slow ? SLOW_MIN : FAST_MIN
  const max = slow ? SLOW_MAX : FAST_MAX
  const random = Math.min(1, Math.max(0, randomValue))
  return {
    outcome: approved ? 'approved' : 'declined',
    delayMs: Math.round((min + random * (max - min)) * factor),
  }
}
