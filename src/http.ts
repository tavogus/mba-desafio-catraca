import type { FastifyReply } from 'fastify'

export function redirect(reply: FastifyReply, location: string) {
  return reply.code(303).header('location', location).header('cache-control', 'no-store').send()
}

export function sendHtml(reply: FastifyReply, html: string, status = 200) {
  return reply.code(status).header('cache-control', 'no-store').type('text/html; charset=utf-8').send(html)
}
