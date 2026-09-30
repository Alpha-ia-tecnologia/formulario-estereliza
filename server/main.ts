import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import pg from 'pg'
import { UPLOAD_LIMITS, createHandler } from './app'
import { serve } from './http'
import { type Store, openStore } from './store'

/**
 * Entrada do `npm run server`: sobe o formulário compilado e a API que guarda
 * as respostas no PostgreSQL. Configuração por variáveis de ambiente (veja
 * .env.example).
 */

const MIN_TOKEN_LENGTH = 32
const MEGABYTE = 1024 * 1024
/** Conexões abertas com o banco: poucos envios, e no máximo 2 processados por vez. */
const POOL_SIZE = 5
/** No deploy, o banco pode subir depois do app: tenta por cerca de 1 minuto. */
const CONNECT_ATTEMPTS = 30
const CONNECT_DELAY_MS = 2000

const megabytes = (name: string, fallbackMb: number): number => {
  const value = Number(process.env[name] ?? fallbackMb)
  return (Number.isFinite(value) && value > 0 ? value : fallbackMb) * MEGABYTE
}

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '0.0.0.0'
const databaseUrl = (process.env.DATABASE_URL ?? '').trim()
const token = (process.env.API_TOKEN ?? '').trim()
const distDir = resolve(process.env.DIST_DIR ?? 'dist')
const trustProxy = process.env.TRUST_PROXY === '1'

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`PORT inválida: ${process.env.PORT}`)
  process.exit(1)
}
if (!databaseUrl) {
  console.error('Defina DATABASE_URL com a conexão do PostgreSQL, por exemplo:\n  postgres://usuario:senha@host:5432/banco')
  process.exit(1)
}
if (token && token.length < MIN_TOKEN_LENGTH) {
  console.error(
    `API_TOKEN precisa ter pelo menos ${MIN_TOKEN_LENGTH} caracteres. Gere um com:\n` +
      `  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`,
  )
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: POOL_SIZE })
// Sem este ouvinte, uma conexão ociosa que cai derruba o processo.
pool.on('error', (error) => console.error('[banco] conexão ociosa caiu:', error.message))

async function connect(): Promise<Store> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await openStore(pool)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      if (attempt >= CONNECT_ATTEMPTS) throw new Error(`Não foi possível conectar ao PostgreSQL: ${reason}`)
      console.error(`[banco] aguardando o PostgreSQL (tentativa ${attempt}/${CONNECT_ATTEMPTS}): ${reason}`)
      await sleep(CONNECT_DELAY_MS)
    }
  }
}

const store = await connect()
const handler = createHandler({
  store,
  token,
  distDir,
  limits: { ...UPLOAD_LIMITS, maxTotalBytes: megabytes('MAX_UPLOAD_MB', 60) },
  quotas: { maxDbBytes: megabytes('MAX_DB_MB', 2048) },
})
const running = await serve(handler, { host, port, trustProxy })

const shownHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host
console.log(`Formulário e API no ar em http://${shownHost}:${running.port}`)
console.log('Respostas guardadas no PostgreSQL, tabela "respostas".')
if (!token) console.log('Leitura das respostas desligada: defina API_TOKEN para consultar a API.')

let isStopping = false
const stop = async () => {
  if (isStopping) return
  isStopping = true
  try {
    await running.close()
    await pool.end()
  } catch (error) {
    console.error('[servidor] erro ao encerrar', error)
  } finally {
    process.exit(0)
  }
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
