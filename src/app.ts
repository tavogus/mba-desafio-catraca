import cookie from '@fastify/cookie'
import formbody from '@fastify/formbody'
import Fastify, { type FastifyInstance } from 'fastify'
import { registerAuthRoutes } from './auth/routes.js'
import { cookieSecret } from './config.js'
import { getPool } from './db.js'
import { registerEventRoutes } from './events/routes.js'
import { sendHtml } from './http.js'
import { registerOrganizerRoutes } from './organizer/routes.js'
import { registerPartnerRoutes } from './partner/routes.js'
import { registerStorefrontRoutes } from './storefront/routes.js'
import { currentUser } from './auth/guard.js'
import { layout } from './web/layout.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: cookieSecret() })
  await app.register(formbody)

  app.get('/health', async () => {
    await getPool().query('SELECT 1')
    return { ok: true }
  })

  app.get('/favicon.ico', async (_req, reply) => reply.code(204).send())

  await registerAuthRoutes(app)
  await registerEventRoutes(app)
  await registerPartnerRoutes(app)
  await registerStorefrontRoutes(app)
  await registerOrganizerRoutes(app)

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' })
    const user = await currentUser(req).catch(() => null)
    return sendHtml(reply, layout({ title: 'Não encontrado', user, body: '<h1>Página não encontrada</h1>' }), 404)
  })

  app.setErrorHandler((error, req, reply) => {
    if (reply.sent) return
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : ''
    const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number((error as { statusCode?: number }).statusCode) : 500
    if (req.url.startsWith('/api/') && (code.startsWith('FST_ERR_CTP_') || statusCode === 400)) {
      return reply.code(422).send({ error: 'invalid_request' })
    }
    console.error(error)
    if (req.url.startsWith('/api/')) return reply.code(500).send({ error: 'internal_error' })
    return sendHtml(reply, layout({ title: 'Erro', user: null, body: '<h1>Erro interno</h1>' }), 500)
  })

  return app
}
