import type pg from 'pg'
import { getPool } from '../db.js'
import { newId } from '../ids.js'
import { hashPassword } from './passwords.js'

export type Role = 'organizer' | 'participant'

export type User = {
  id: string
  name: string
  email: string
  role: Role
}

export const SESSION_COOKIE = 'catraca_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

export const SEED = {
  organizerA: {
    id: 'usr_org_ana',
    name: 'Ana Ribeiro',
    email: 'ana.organizadora@catraca.local',
    password: 'organizadora-a-senha',
  },
  organizerB: {
    id: 'usr_org_bruno',
    name: 'Bruno Martins',
    email: 'bruno.organizador@catraca.local',
    password: 'organizador-b-senha',
  },
  participant: {
    id: 'usr_part_clara',
    name: 'Clara Nunes',
    email: 'clara.participante@catraca.local',
    password: 'participante-senha',
  },
  partnerApiKey: 'catraca_partner_key_local',
} as const

const hashCache = new Map<string, string>()

async function cachedHash(password: string): Promise<string> {
  const hit = hashCache.get(password)
  if (hit) return hit
  const hash = await hashPassword(password)
  hashCache.set(password, hash)
  return hash
}

export async function seed(pool: pg.Pool = getPool()): Promise<void> {
  const people = [
    { ...SEED.organizerA, role: 'organizer' },
    { ...SEED.organizerB, role: 'organizer' },
    { ...SEED.participant, role: 'participant' },
  ] as const
  for (const person of people) {
    const passwordHash = await cachedHash(person.password)
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role`,
      [person.id, person.name, person.email, passwordHash, person.role],
    )
  }
  await pool.query(
    `INSERT INTO partner_keys (id, name, api_key)
     VALUES ('key_local', 'Parceiro local', $1)
     ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key, name = EXCLUDED.name`,
    [SEED.partnerApiKey],
  )
}

function mapUser(row: { id: string; name: string; email: string; role: Role }): User {
  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const res = await getPool().query<{ id: string; name: string; email: string; role: Role; password_hash: string }>(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
    [email],
  )
  const row = res.rows[0]
  if (!row) return null
  return { ...mapUser(row), passwordHash: row.password_hash }
}

export async function createParticipant(input: { name: string; email: string; passwordHash: string }): Promise<User> {
  const id = newId('usr')
  const res = await getPool().query<{ id: string; name: string; email: string; role: Role }>(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'participant')
     RETURNING id, name, email, role`,
    [id, input.name, input.email, input.passwordHash],
  )
  return mapUser(res.rows[0])
}

export async function createSession(userId: string): Promise<string> {
  const id = newId('ses')
  const expires = new Date(Date.now() + SESSION_MS)
  await getPool().query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [id, userId, expires])
  return id
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getPool().query('DELETE FROM sessions WHERE id = $1', [sessionId])
}

export async function userFromSession(sessionId: string): Promise<User | null> {
  const res = await getPool().query<{ id: string; name: string; email: string; role: Role }>(
    `SELECT u.id, u.name, u.email, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId],
  )
  const row = res.rows[0]
  return row ? mapUser(row) : null
}

export async function partnerKeyIsValid(key: string): Promise<boolean> {
  if (!key) return false
  const res = await getPool().query('SELECT 1 FROM partner_keys WHERE api_key = $1', [key])
  return (res.rowCount ?? 0) > 0
}
