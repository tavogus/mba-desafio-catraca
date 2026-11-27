import type { FastifyInstance } from 'fastify'
import { redirect, sendHtml } from '../http.js'
import { isValidEmail, normalizeEmail, safeNext } from '../validate.js'
import { esc } from '../web/html.js'
import { layout } from '../web/layout.js'
import { sessionIdFrom } from './guard.js'
import { hashPassword, verifyPassword } from './passwords.js'
import {
  SESSION_COOKIE,
  createParticipant,
  createSession,
  deleteSession,
  findUserByEmail,
} from './session.js'

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  signed: true,
  maxAge: 60 * 60 * 24 * 7,
}

function loginPage(error: string | null, next: string | null): string {
  return layout({
    title: 'Entrar',
    user: null,
    body: `<h1>Entrar</h1>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
      <form method="post" action="/entrar">
        ${next ? `<input type="hidden" name="next" value="${next}">` : ''}
        <label>E-mail <input name="email" type="email" autocomplete="username" required></label>
        <label>Senha <input name="password" type="password" autocomplete="current-password" required></label>
        <button type="submit">Entrar</button>
      </form>
      <p><a href="/cadastro">Criar conta de participante</a></p>`,
  })
}

function registerPage(error: string | null): string {
  return layout({
    title: 'Criar conta',
    user: null,
    body: `<h1>Criar conta</h1>
      <p>A conta criada aqui é de participante. Organizador entra com a conta da seed.</p>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
      <form method="post" action="/cadastro">
        <label>Nome <input name="name" autocomplete="name" required></label>
        <label>E-mail <input name="email" type="email" autocomplete="email" required></label>
        <label>Senha <input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <button type="submit">Criar conta</button>
      </form>`,
  })
}

function text(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/entrar', async (req, reply) => {
    const next = safeNext((req.query as { next?: unknown }).next)
    return sendHtml(reply, loginPage(null, next ? escapeAttr(next) : null))
  })

  app.post('/entrar', async (req, reply) => {
    const email = normalizeEmail(text(req.body, 'email'))
    const password = text(req.body, 'password')
    const next = safeNext(text(req.body, 'next'))
    const user = email ? await findUserByEmail(email) : null
    const valid = user ? await verifyPassword(password, user.passwordHash) : false
    if (!user || !valid) {
      return sendHtml(reply, loginPage('E-mail ou senha inválidos.', next ? escapeAttr(next) : null), 400)
    }
    const sessionId = await createSession(user.id)
    reply.setCookie(SESSION_COOKIE, sessionId, COOKIE_OPTIONS)
    const destination = next ?? (user.role === 'organizer' ? '/organizador' : '/')
    return redirect(reply, destination)
  })

  app.get('/cadastro', async (_req, reply) => sendHtml(reply, registerPage(null)))

  app.post('/cadastro', async (req, reply) => {
    const name = text(req.body, 'name').trim()
    const email = normalizeEmail(text(req.body, 'email'))
    const password = text(req.body, 'password')
    if (!name || name.length > 120) return sendHtml(reply, registerPage('Informe o nome.'), 400)
    if (!isValidEmail(email)) return sendHtml(reply, registerPage('Informe um e-mail válido.'), 400)
    if (password.length < 8 || password.length > 200) {
      return sendHtml(reply, registerPage('A senha precisa ter pelo menos 8 caracteres.'), 400)
    }
    try {
      const user = await createParticipant({ name, email, passwordHash: await hashPassword(password) })
      const sessionId = await createSession(user.id)
      reply.setCookie(SESSION_COOKIE, sessionId, COOKIE_OPTIONS)
      return redirect(reply, '/')
    } catch (error) {
      if (isUnique(error)) return sendHtml(reply, registerPage('Já existe uma conta com esse e-mail.'), 400)
      throw error
    }
  })

  app.post('/sair', async (req, reply) => {
    const sessionId = await sessionIdFrom(req)
    if (sessionId) await deleteSession(sessionId)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return redirect(reply, '/')
  })
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505'
}
