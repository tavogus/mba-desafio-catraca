import { ensureDatabase } from './ensure-db.js'

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL é obrigatória para os testes')
  await ensureDatabase(url)
}
