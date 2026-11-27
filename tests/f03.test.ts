import { describe, expect, test } from 'vitest'
import { SEED } from '../src/auth/session.js'
import { getPool } from '../src/db.js'
import { getEvent } from '../src/events/service.js'
import { formatReais } from '../src/money.js'
import { CHECKIN } from '../src/tickets/messages.js'
import { cancelPublishedEvent } from '../src/tickets/cancel.js'
import { checkIn } from '../src/tickets/checkin.js'
import { getDashboard } from '../src/tickets/dashboard.js'
import { gatewayPlan } from '../src/tickets/gateway.js'
import { purchaseTicket } from '../src/tickets/purchase.js'
import { getTicketById } from '../src/tickets/queries.js'
import { processDueTickets, startGatewayWorker } from '../src/tickets/worker.js'
import { createPublished, eventFields, loginOrganizerA, useApp } from './helpers.js'

const ctx = useApp()

async function ticketCount(eventId: string): Promise<number> {
  const res = await getPool().query<{ n: number }>('SELECT COUNT(*)::int AS n FROM tickets WHERE event_id = $1', [eventId])
  return Number(res.rows[0]?.n ?? 0)
}

describe('F03 ingressos', () => {
  test('compra nasce pendente e ocupa vaga sem esperar o gateway (R05, R06)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '2', price: '100,00' })
    const started = Date.now()
    const bought = await purchaseTicket({
      eventId,
      buyerEmail: 'ana@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(bought.ok).toBe(true)
    if (!bought.ok) return
    expect(bought.ticket.status).toBe('pending')
    const ticket = await getTicketById(bought.ticket.id)
    expect(ticket?.status).toBe('pending')
    expect(ticket?.priceCents).toBe(10000)
    const dashboard = await getDashboard(eventId)
    expect(dashboard).toMatchObject({ pending: 1, confirmed: 0, availableSeats: 1 })
  })

  test('aprovação confirma e recusa libera a vaga (R08)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '1' })
    const declined = await purchaseTicket({
      eventId,
      buyerEmail: 'n@example.com',
      cardNumber: '4000000000000002',
      channel: 'partner',
      participantId: null,
    })
    expect(declined.ok).toBe(true)
    expect((await getDashboard(eventId))?.availableSeats).toBe(0)
    await processDueTickets()
    if (!declined.ok) return
    expect((await getTicketById(declined.ticket.id))?.status).toBe('declined')
    expect((await getDashboard(eventId))?.availableSeats).toBe(1)

    const approved = await purchaseTicket({
      eventId,
      buyerEmail: 's@example.com',
      cardNumber: '4000000000000001',
      channel: 'storefront',
      participantId: SEED.participant.id,
    })
    expect(approved.ok).toBe(true)
    await processDueTickets()
    if (!approved.ok) return
    expect((await getTicketById(approved.ticket.id))?.status).toBe('confirmed')
    expect((await getDashboard(eventId))?.availableSeats).toBe(0)
  })

  test('cartão que não tem 16 dígitos não cria ingresso', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '3' })
    const result = await purchaseTicket({
      eventId,
      buyerEmail: 'ana@example.com',
      cardNumber: '123',
      channel: 'partner',
      participantId: null,
    })
    expect(result).toEqual({ ok: false, error: 'invalid_request' })
    expect(await ticketCount(eventId)).toBe(0)
  })

  test('ordem dos erros da compra: pedido inválido, evento indisponível, esgotado', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const draftId = await createPublished(ctx.app, cookie, { name: 'Vai sair', capacity: '1' })
    await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${draftId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Vai sair', capacity: '1' })).toString(),
    })
    const invalidFirst = await purchaseTicket({
      eventId: 'evt_inexistente',
      buyerEmail: 'nao-e-email',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(invalidFirst).toEqual({ ok: false, error: 'invalid_request' })

    const draft = await createPublished(ctx.app, cookie, { name: 'Ainda rascunho' })
    await getPool().query(`UPDATE events SET status = 'draft' WHERE id = $1`, [draft])
    const unavailable = await purchaseTicket({
      eventId: draft,
      buyerEmail: 'ana@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(unavailable).toEqual({ ok: false, error: 'event_not_available' })

    const full = await createPublished(ctx.app, cookie, { capacity: '1', name: 'Cheio' })
    const first = await purchaseTicket({
      eventId: full,
      buyerEmail: 'a@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(first.ok).toBe(true)
    const soldOut = await purchaseTicket({
      eventId: full,
      buyerEmail: 'b@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(soldOut).toEqual({ ok: false, error: 'sold_out' })
    expect(await ticketCount(full)).toBe(1)
  })

  test('30 compras simultâneas ocupam exatamente a lotação (R07)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    for (let round = 0; round < 5; round++) {
      const eventId = await createPublished(ctx.app, cookie, { capacity: '5', name: `Carga ${round}` })
      const results = await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
          purchaseTicket({
            eventId,
            buyerEmail: `carga${round}-${index}@example.com`,
            cardNumber: '4000000000000001',
            channel: 'partner',
            participantId: null,
          }),
        ),
      )
      expect(results.filter((result) => result.ok)).toHaveLength(5)
      expect(results.filter((result) => !result.ok && result.error === 'sold_out')).toHaveLength(25)
      expect(await ticketCount(eventId)).toBe(5)
      expect((await getDashboard(eventId))?.availableSeats).toBe(0)
    }
  })

  test('preço vigente fica no ingresso e a receita usa esse valor (R03, R12)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '4', price: '100,00', name: 'Receita' })
    const first = await purchaseTicket({
      eventId,
      buyerEmail: 'a@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    const edited = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Receita', capacity: '4', price: '150,00' })).toString(),
    })
    expect(edited.statusCode).toBe(303)
    const second = await purchaseTicket({
      eventId,
      buyerEmail: 'b@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    await processDueTickets()
    expect((await getTicketById(first.ticket.id))?.priceCents).toBe(10000)
    expect((await getTicketById(second.ticket.id))?.priceCents).toBe(15000)
    const dashboard = await getDashboard(eventId)
    expect(dashboard?.revenueCents).toBe(25000)
    expect(formatReais(dashboard?.revenueCents ?? 0)).toBe('R$ 250,00')
  })

  test('lotação não fica abaixo das vagas ocupadas (R03)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '2', name: 'Piso' })
    await purchaseTicket({
      eventId,
      buyerEmail: 'a@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    await purchaseTicket({
      eventId,
      buyerEmail: 'b@example.com',
      cardNumber: '4000000000000004',
      channel: 'partner',
      participantId: null,
    })
    const rejected = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Piso', capacity: '1' })).toString(),
    })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.body).toContain('A lotação não pode ser menor que as vagas ocupadas.')
    expect((await getEvent(eventId))?.capacity).toBe(2)

    const accepted = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Piso', capacity: '3' })).toString(),
    })
    expect(accepted.statusCode).toBe(303)
    expect((await getEvent(eventId))?.capacity).toBe(3)
  })

  test('cancelamento liquida ingressos e o gateway tardio não muda o status (R11)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '5', price: '50,00', name: 'Cancela' })
    const slow = await purchaseTicket({
      eventId,
      buyerEmail: 'lento@example.com',
      cardNumber: '4000000000000003',
      channel: 'partner',
      participantId: null,
    })
    const fast = await purchaseTicket({
      eventId,
      buyerEmail: 'rapido@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(slow.ok && fast.ok).toBe(true)
    if (!slow.ok || !fast.ok) return
    await getPool().query(`UPDATE tickets SET gateway_due_at = clock_timestamp() + interval '1 hour' WHERE id = $1`, [
      slow.ticket.id,
    ])
    await processDueTickets()
    expect((await getTicketById(fast.ticket.id))?.status).toBe('confirmed')
    expect((await getTicketById(slow.ticket.id))?.status).toBe('pending')

    const cancelled = await cancelPublishedEvent(SEED.organizerA.id, eventId)
    expect(cancelled).toEqual({ ok: true })
    expect((await getTicketById(fast.ticket.id))?.status).toBe('refunded')
    expect((await getTicketById(slow.ticket.id))?.status).toBe('cancelled')

    await getPool().query(`UPDATE tickets SET gateway_due_at = clock_timestamp() - interval '1 minute' WHERE id = $1`, [
      slow.ticket.id,
    ])
    await processDueTickets()
    expect((await getTicketById(slow.ticket.id))?.status).toBe('cancelled')
    expect((await getTicketById(fast.ticket.id))?.status).toBe('refunded')
    expect(await getDashboard(eventId)).toMatchObject({
      confirmed: 0,
      pending: 0,
      checkins: 0,
      availableSeats: 0,
      revenueCents: 0,
      refunded: 1,
    })
    const latePurchase = await purchaseTicket({
      eventId,
      buyerEmail: 'depois@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(latePurchase).toEqual({ ok: false, error: 'event_not_available' })
    expect((await listOnSaleIds())).not.toContain(eventId)
  })

  test('check-in obedece a ordem das mensagens (R10)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '4', name: 'Porta' })
    const otherId = await createPublished(ctx.app, cookie, { capacity: '2', name: 'Outra porta' })
    const pending = await purchaseTicket({
      eventId,
      buyerEmail: 'p@example.com',
      cardNumber: '4000000000000004',
      channel: 'partner',
      participantId: null,
    })
    const confirmed = await purchaseTicket({
      eventId,
      buyerEmail: 'c@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    const other = await purchaseTicket({
      eventId: otherId,
      buyerEmail: 'o@example.com',
      cardNumber: '4000000000000001',
      channel: 'partner',
      participantId: null,
    })
    expect(pending.ok && confirmed.ok && other.ok).toBe(true)
    if (!pending.ok || !confirmed.ok || !other.ok) return
    await getPool().query(`UPDATE tickets SET gateway_due_at = clock_timestamp() + interval '2 hours' WHERE id = $1`, [
      pending.ticket.id,
    ])
    await processDueTickets()

    const organizerId = SEED.organizerA.id
    expect(await checkinMessage(organizerId, eventId, 'ZZZZZZZZ')).toBe(CHECKIN.invalid)
    expect(await checkinMessage(organizerId, eventId, other.ticket.code)).toBe(CHECKIN.invalid)
    expect(await checkinMessage(organizerId, eventId, pending.ticket.code)).toBe(CHECKIN.unconfirmed)
    expect(await checkinMessage(organizerId, eventId, confirmed.ticket.code)).toBe(CHECKIN.released)
    expect(await checkinMessage(organizerId, eventId, confirmed.ticket.code)).toBe(CHECKIN.used)
    expect((await getDashboard(eventId))?.checkins).toBe(1)
    expect((await getDashboard(eventId))?.confirmed).toBe(1)

    expect((await checkIn(SEED.organizerB.id, eventId, confirmed.ticket.code))).toEqual({ ok: false, error: 'not_found' })
    expect((await getTicketById(confirmed.ticket.id))?.checkedIn).toBe(true)

    await cancelPublishedEvent(organizerId, eventId)
    expect(await checkinMessage(organizerId, eventId, confirmed.ticket.code)).toBe(CHECKIN.cancelled)
    expect(await checkinMessage(organizerId, eventId, 'ZZZZZZZZ')).toBe(CHECKIN.invalid)
  })

  test('painel bate com os ingressos (R12)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '5', price: '100,00', name: 'Painel' })
    const a = await mustBuy(eventId, '4000000000000001', 'a@example.com')
    const b = await mustBuy(eventId, '4000000000000002', 'b@example.com')
    const c = await mustBuy(eventId, '4000000000000001', 'c@example.com')
    await getPool().query(`UPDATE tickets SET gateway_due_at = clock_timestamp() + interval '1 hour' WHERE id = $1`, [c])
    await processDueTickets()
    await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Painel', capacity: '5', price: '150,00' })).toString(),
    })
    const d = await mustBuy(eventId, '4000000000000001', 'd@example.com')
    await processDueTickets()
    await checkIn(SEED.organizerA.id, eventId, (await getTicketById(a))!.code)
    const before = await getDashboard(eventId)
    expect(before).toMatchObject({ confirmed: 2, pending: 1, checkins: 1, availableSeats: 2, revenueCents: 25000, refunded: 0 })
    expect((await getTicketById(b))?.status).toBe('declined')
    expect((await getTicketById(d))?.priceCents).toBe(15000)
  })

  test('atraso do modo padrão cai na janela do brief', () => {
    expect(gatewayPlan('4000000000000001', 0, 1)).toEqual({ outcome: 'approved', delayMs: 2000 })
    expect(gatewayPlan('4000000000000001', 1, 1)).toEqual({ outcome: 'approved', delayMs: 4500 })
    expect(gatewayPlan('4000000000000002', 0, 1)).toEqual({ outcome: 'declined', delayMs: 2000 })
    expect(gatewayPlan('4000000000000003', 0, 1)).toEqual({ outcome: 'approved', delayMs: 30000 })
    expect(gatewayPlan('4000000000000003', 1, 1)).toEqual({ outcome: 'approved', delayMs: 38000 })
    expect(gatewayPlan('4000000000000004', 0, 1)).toEqual({ outcome: 'declined', delayMs: 30000 })
    expect(gatewayPlan('4000000000000099', 0.5, 1).outcome).toBe('declined')
    expect(gatewayPlan('4000000000000001', 0, 0).delayMs).toBe(0)
  })

  test(
    'worker confirma o cartão rápido dentro de 8 segundos',
    async () => {
      const previous = process.env.GATEWAY_DELAY_FACTOR
      process.env.GATEWAY_DELAY_FACTOR = '1'
      const stop = startGatewayWorker(100)
      try {
        const cookie = await loginOrganizerA(ctx.app)
        const eventId = await createPublished(ctx.app, cookie, { capacity: '1', name: 'Relógio' })
        const bought = await purchaseTicket({
          eventId,
          buyerEmail: 'tempo@example.com',
          cardNumber: '4000000000000001',
          channel: 'partner',
          participantId: null,
        })
        expect(bought.ok).toBe(true)
        if (!bought.ok) return
        const started = Date.now()
        let status = 'pending'
        while (Date.now() - started < 8000) {
          status = (await getTicketById(bought.ticket.id))?.status ?? 'pending'
          if (status !== 'pending') break
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        const elapsed = Date.now() - started
        expect(status).toBe('confirmed')
        expect(elapsed).toBeGreaterThanOrEqual(1500)
        expect(elapsed).toBeLessThan(8000)
      } finally {
        stop()
        process.env.GATEWAY_DELAY_FACTOR = previous
      }
    },
    20_000,
  )
})

async function checkinMessage(organizerId: string, eventId: string, code: string) {
  const result = await checkIn(organizerId, eventId, code)
  if (!result.ok) throw new Error(result.error)
  return result.message
}

async function mustBuy(eventId: string, cardNumber: string, buyerEmail: string): Promise<string> {
  const bought = await purchaseTicket({
    eventId,
    buyerEmail,
    cardNumber,
    channel: 'partner',
    participantId: null,
  })
  if (!bought.ok) throw new Error(bought.error)
  return bought.ticket.id
}

async function listOnSaleIds(): Promise<string[]> {
  const { listEventsOnSale } = await import('../src/events/service.js')
  return (await listEventsOnSale()).map((event) => event.id)
}
