import { buildApp } from './app.js'
import { port } from './config.js'
import { closePool, getPool } from './db.js'
import { migrate } from './migrate.js'
import { seed } from './auth/session.js'
import { startGatewayWorker } from './tickets/worker.js'

async function waitForDb(): Promise<void> {
  const pool = getPool()
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (error) {
      if (attempt === 30) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

async function main(): Promise<void> {
  await waitForDb()
  const pool = getPool()
  await migrate(pool)
  await seed(pool)
  const app = await buildApp()
  const stopWorker = startGatewayWorker()
  const listenPort = port()
  await app.listen({ port: listenPort, host: '0.0.0.0' })
  console.log(`Catraca ouvindo na porta ${listenPort}`)

  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    stopWorker()
    await app.close()
    await closePool()
    process.exit(0)
  }
  process.on('SIGTERM', () => {
    void shutdown()
  })
  process.on('SIGINT', () => {
    void shutdown()
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
