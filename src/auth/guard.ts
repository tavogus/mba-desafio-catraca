import type { FastifyReply, FastifyRequest } from 'fastify'
import { redirect, sendHtml } from '../http.js'
import { safeNext } from '../validate.js'
import { layout } from '../web/layout.js'
import { SESSION_COOKIE, type User, userFromSession } from './session.js'

export async function currentUser(req: FastifyRequest): Promise<User | null> {
  const raw = req.cookies?.[SESSION_COOKIE]
  if (!raw) return null
  const unsigned = req.unsignCookie(raw)
  if (!unsigned.valid || !unsigned.value) return null
  return userFromSession(unsigned.value)
}

export async function sessionIdFrom(req: FastifyRequest): Promise<string | null> {
  const raw = req.cookies?.[SESSION_COOKIE]
  if (!raw) return null
  const unsigned = req.unsignCookie(raw)
  if (!unsigned.valid || !unsigned.value) return null
  return unsigned.value
}

export async function requireOrganizer(req: FastifyRequest, reply: FastifyReply): Promise<User | null> {
  const user = await currentUser(req)
  if (!user) {
    const next = safeNext(req.url)
    redirect(reply, next ? `/entrar?next=${encodeURIComponent(next)}` : '/entrar')
    return null
  }
  if (user.role !== 'organizer') {
    sendHtml(
      reply,
      layout({
        title: 'Acesso restrito',
        user,
        body: '<h1>Acesso restrito a organizadores</h1><p>Esta área é só de quem organiza eventos.</p>',
      }),
      403,
    )
    return null
  }
  return user
}
