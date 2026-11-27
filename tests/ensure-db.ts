import pg from 'pg'

export async function ensureDatabase(connectionString: string): Promise<void> {
  const url = new URL(connectionString)
  const dbName = url.pathname.replace(/^\//, '')
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error(`Nome de banco inválido: ${dbName}`)
  url.pathname = '/postgres'
  const client = new pg.Client({ connectionString: url.toString() })
  await client.connect()
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if ((found.rowCount ?? 0) === 0) await client.query(`CREATE DATABASE ${dbName}`)
  } finally {
    await client.end()
  }
}
