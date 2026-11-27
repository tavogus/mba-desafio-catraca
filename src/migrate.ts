import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type pg from 'pg'

export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE id = $1', [file])
    if ((existing.rowCount ?? 0) > 0) continue
    const sql = await readFile(join(dir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // a transação já foi desfeita
      }
      throw error
    } finally {
      client.release()
    }
  }
}
