import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'
import { SEED, seed } from '../src/auth/session.js'
import { getPool } from '../src/db.js'
import { cookieFrom, loginAs, loginOrganizerA, useApp } from './helpers.js'

const ctx = useApp()

describe('F01 identidade', () => {
  test('participante cria conta, entra e sai', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/cadastro',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        name: 'Lia Souza',
        email: 'Lia@Example.com',
        password: 'senha-forte',
      }).toString(),
    })
    expect(created.statusCode).toBe(303)
    const cookie = cookieFrom(created)

    const home = await ctx.app.inject({ method: 'GET', url: '/organizador', headers: { cookie } })
    expect(home.statusCode).toBe(403)
    expect(home.body).toContain('Acesso restrito a organizadores')

    const left = await ctx.app.inject({ method: 'POST', url: '/sair', headers: { cookie } })
    expect(left.statusCode).toBe(303)
    const again = await ctx.app.inject({ method: 'GET', url: '/organizador', headers: { cookie } })
    expect(again.statusCode).toBe(303)
    expect(String(again.headers.location)).toContain('/entrar')

    const relogin = await loginAs(ctx.app, 'lia@example.com', 'senha-forte')
    const stillParticipant = await ctx.app.inject({ method: 'GET', url: '/organizador', headers: { cookie: relogin } })
    expect(stillParticipant.statusCode).toBe(403)
  })

  test('organizador da seed entra; cadastro novo não vira organizador', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const page = await ctx.app.inject({ method: 'GET', url: '/organizador', headers: { cookie } })
    expect(page.statusCode).toBe(200)
    expect(page.body).toContain('Meus eventos')
    expect(page.body).toContain(SEED.organizerA.name)

    const duplicate = await ctx.app.inject({
      method: 'POST',
      url: '/cadastro',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        name: 'Outra Ana',
        email: SEED.organizerA.email,
        password: 'senha-forte',
      }).toString(),
    })
    expect(duplicate.statusCode).toBe(400)
    expect(duplicate.body).toContain('Já existe uma conta com esse e-mail.')
  })

  test('seed roda de novo sem duplicar', async () => {
    await seed()
    await seed()
    const users = await getPool().query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM users WHERE email LIKE '%@catraca.local'`,
    )
    const keys = await getPool().query<{ n: number }>('SELECT COUNT(*)::int AS n FROM partner_keys')
    expect(Number(users.rows[0]?.n)).toBe(3)
    expect(Number(keys.rows[0]?.n)).toBe(1)
  })

  test('visitante e participante não entram na área do organizador', async () => {
    const visitor = await ctx.app.inject({ method: 'GET', url: '/organizador/eventos/evt_qualquer' })
    expect(visitor.statusCode).toBe(303)
    expect(String(visitor.headers.location)).toContain('/entrar')
    expect(visitor.body).not.toContain('evt_qualquer')

    const cookie = await loginAs(ctx.app, SEED.participant.email, SEED.participant.password)
    const participant = await ctx.app.inject({
      method: 'GET',
      url: '/organizador/eventos/evt_qualquer',
      headers: { cookie },
    })
    expect(participant.statusCode).toBe(403)
    expect(participant.body).toContain('Acesso restrito a organizadores')
    expect(participant.body).not.toContain('Confirmados')
  })

  test('README e AGENTS documentam o harness e as credenciais', async () => {
    const readme = await readFile('README.md', 'utf8')
    const agents = await readFile('AGENTS.md', 'utf8')
    const claude = await readFile('CLAUDE.md', 'utf8')
    for (const heading of ['## Como rodar', '## Endereços', '## Credenciais', '## Mapa dos artefatos', '## Decisões', '## Regras de entrega']) {
      expect(readme).toContain(heading)
    }
    expect(readme).toContain(SEED.organizerA.email)
    expect(readme).toContain(SEED.organizerA.password)
    expect(readme).toContain(SEED.organizerB.email)
    expect(readme).toContain(SEED.organizerB.password)
    expect(readme).toContain(SEED.participant.email)
    expect(readme).toContain(SEED.participant.password)
    expect(readme).toContain(SEED.partnerApiKey)
    expect(readme).toContain('http://localhost:3000')
    expect(agents).toContain('./scripts/up.sh')
    expect(agents).toContain('./scripts/down.sh')
    expect(agents).toContain('./scripts/gates.sh')
    expect(claude).toContain('AGENTS.md')
  })
})
