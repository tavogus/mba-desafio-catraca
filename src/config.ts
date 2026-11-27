export function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL é obrigatória')
  return url
}

export function cookieSecret(): string {
  return process.env.COOKIE_SECRET ?? 'dev-cookie-secret-catraca'
}

export function port(): number {
  return Number(process.env.PORT ?? 3000)
}

/** 1 no modo do avaliador. 0 nos gates, para não esperar o gateway. */
export function gatewayDelayFactor(): number {
  const raw = process.env.GATEWAY_DELAY_FACTOR
  if (raw === undefined || raw === '') return 1
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return 1
  return value
}
