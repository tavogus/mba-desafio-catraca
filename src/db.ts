import pg from 'pg'
import { databaseUrl } from './config.js'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 40,
      allowExitOnIdle: true,
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (!pool) return
  const current = pool
  pool = null
  await current.end()
}

export function num(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Valor numérico inválido: ${String(value)}`)
  return parsed
}

export type Queryable = Pick<pg.Pool, 'query'>
