import { describe, expect, test } from 'vitest'
import { SEED } from '../src/auth/session.js'
import { getPool } from '../src/db.js'
import { cancelPublishedEvent } from '../src/tickets/cancel.js'
import { processDueTickets } from '../src/tickets/worker.js'
import { createDraft, createPublished, loginOrganizerA, loginParticipant, useApp } from './helpers.js'

const ctx = useApp()

describe('F05 vitrine', () => {
  test('vitrine mostra só publicado e some no cancelamento', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    await createDraft(ctx.app, cookie, { name: 'Rascunho da vitrine' })
    const eventId = await createPublished(ctx.app, cookie, { name: 'Show publicado' })
    const home = await ctx.app.inject({ method: 'GET', url: '/' })
    expect(home.statusCode).toBe(200)
    expect(home.body).toContain('Show publicado')
    expect(home.body).not.toContain('Rascunho da vitrine')
    const hidden = await ctx.app.inject({ method: 'GET', url: `/eventos/${(await createDraft(ctx.app, cookie, { name: 'Outro rascunho' }))}` })
    expect(hidden.statusCode).toBe(404)
    expect(hidden.body).not.toContain('Outro rascunho')

    await cancelPublishedEvent(SEED.organizerA.id, eventId)
    const after = await ctx.app.inject({ method: 'GET', url: '/' })
    expect(after.body).not.toContain('Show publicado')
  })

  test('compra na vitrine chega em meus ingressos e confirma', async () => {
    const organizer = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, organizer, { name: 'Jazz no Porão', price: '100,00', capacity: '3' })
    const participant = await loginParticipant(ctx.app)
    const bought = await ctx.app.inject({
      method: 'POST',
      url: `/eventos/${eventId}/comprar`,
      headers: { cookie: participant, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'cardNumber=4000000000000001',
    })
    expect(bought.statusCode).toBe(303)
    expect(bought.headers.location).toBe('/meus-ingressos')
    const pending = await ctx.app.inject({ method: 'GET', url: '/meus-ingressos', headers: { cookie: participant } })
    expect(pending.body).toContain('Jazz no Porão')
    expect(pending.body).toContain('Status: pendente')
    const code = /Código: ([A-Z2-9]{8})/.exec(pending.body)?.[1]
    expect(code).toBeTruthy()
    await processDueTickets()
    const confirmed = await ctx.app.inject({ method: 'GET', url: '/meus-ingressos', headers: { cookie: participant } })
    expect(confirmed.body).toContain('Status: confirmado')
    expect(confirmed.body).toContain(`Código: ${code}`)
  })

  test('sem vaga a vitrine exibe Ingressos esgotados', async () => {
    const organizer = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, organizer, { capacity: '1', name: 'Lotado' })
    const participant = await loginParticipant(ctx.app)
    await ctx.app.inject({
      method: 'POST',
      url: `/eventos/${eventId}/comprar`,
      headers: { cookie: participant, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'cardNumber=4000000000000001',
    })
    const page = await ctx.app.inject({ method: 'GET', url: `/eventos/${eventId}`, headers: { cookie: participant } })
    expect(page.body).toContain('Ingressos esgotados')
    expect(page.body).not.toContain('Comprar ingresso')
    const home = await ctx.app.inject({ method: 'GET', url: '/' })
    expect(home.body).toContain('Ingressos esgotados')
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/eventos/${eventId}/comprar`,
      headers: { cookie: participant, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'cardNumber=4000000000000001',
    })
    expect(again.statusCode).toBe(409)
    expect(again.body).toContain('Ingressos esgotados')
    const count = await getPool().query<{ n: number }>('SELECT COUNT(*)::int AS n FROM tickets WHERE event_id = $1', [eventId])
    expect(Number(count.rows[0]?.n)).toBe(1)
  })

  test('visitante vê a vitrine e não compra sem entrar', async () => {
    const organizer = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, organizer, { name: 'Aberto ao público' })
    const home = await ctx.app.inject({ method: 'GET', url: '/' })
    expect(home.statusCode).toBe(200)
    expect(home.body).toContain('Aberto ao público')
    const post = await ctx.app.inject({
      method: 'POST',
      url: `/eventos/${eventId}/comprar`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'cardNumber=4000000000000001',
    })
    expect(post.statusCode).toBe(303)
    expect(String(post.headers.location)).toContain('/entrar')
  })
})
