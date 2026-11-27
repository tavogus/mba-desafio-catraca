import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import { SEED } from '../src/auth/session.js'
import { buildApp } from '../src/app.js'
import { getPool } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { seed } from '../src/auth/session.js'
import { shiftDateTimeLocal } from '../src/time.js'

export async function resetDatabase(): Promise<void> {
  const pool = getPool()
  await migrate(pool)
  await pool.query('TRUNCATE TABLE tickets, events, sessions, users, partner_keys RESTART IDENTITY CASCADE')
  await seed(pool)
}

export function useApp(): { app: FastifyInstance } {
  const ctx = {} as { app: FastifyInstance }
  beforeAll(async () => {
    await resetDatabase()
    ctx.app = await buildApp()
  })
  beforeEach(async () => {
    await resetDatabase()
  })
  afterAll(async () => {
    await ctx.app?.close()
  })
  return ctx
}

export function cookieFrom(response: { headers: { 'set-cookie'?: string | string[] | number } }): string {
  const raw = response.headers['set-cookie']
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [String(raw)]
  if (list.length === 0) throw new Error('resposta sem Set-Cookie')
  return list.map((entry) => entry.split(';')[0]).join('; ')
}

export async function loginAs(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/entrar',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ email, password }).toString(),
  })
  if (res.statusCode !== 303) throw new Error(`login falhou: ${res.statusCode} ${res.body}`)
  return cookieFrom(res)
}

export function eventFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: 'Jazz no Porão',
    startsAt: shiftDateTimeLocal(40),
    venue: 'Porão da Vila',
    capacity: '10',
    price: '100,00',
    ...overrides,
  }
}

export function eventIdFromLocation(location: string | undefined): string {
  const match = /\/organizador\/eventos\/([^/?]+)/.exec(location ?? '')
  if (!match?.[1]) throw new Error(`location sem evento: ${location}`)
  return decodeURIComponent(match[1])
}

export async function createDraft(app: FastifyInstance, cookie: string, overrides: Record<string, string> = {}): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/organizador/eventos',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams(eventFields(overrides)).toString(),
  })
  if (res.statusCode !== 303) throw new Error(`criar evento falhou: ${res.statusCode} ${res.body}`)
  return eventIdFromLocation(res.headers.location)
}

export async function publish(app: FastifyInstance, cookie: string, eventId: string): Promise<void> {
  const res = await app.inject({
    method: 'POST',
    url: `/organizador/eventos/${eventId}/publicar`,
    headers: { cookie },
  })
  if (res.statusCode !== 303) throw new Error(`publicar falhou: ${res.statusCode} ${res.body}`)
}

export async function createPublished(app: FastifyInstance, cookie: string, overrides: Record<string, string> = {}): Promise<string> {
  const eventId = await createDraft(app, cookie, overrides)
  await publish(app, cookie, eventId)
  return eventId
}

export async function loginOrganizerA(app: FastifyInstance): Promise<string> {
  return loginAs(app, SEED.organizerA.email, SEED.organizerA.password)
}

export async function loginOrganizerB(app: FastifyInstance): Promise<string> {
  return loginAs(app, SEED.organizerB.email, SEED.organizerB.password)
}

export async function loginParticipant(app: FastifyInstance): Promise<string> {
  return loginAs(app, SEED.participant.email, SEED.participant.password)
}
