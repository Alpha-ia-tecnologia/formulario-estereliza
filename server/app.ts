import { createHash, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IMPORT_LIMITS, type ImportLimits } from '../src/draft/package'
import { ImportError } from '../src/form/sanitize'
import { BodyTooLarge, type RateLimit, createLimiter, readBody } from './guard'
import { intake } from './intake'
import type { Store } from './store'

/**
 * Rotas do servidor, sobre Request/Response padrão (sem depender do node:http,
 * o que deixa tudo testável chamando o handler direto):
 *
 *   GET  /                           formulário compilado (dist/index.html)
 *   GET  /api/saude                  { ok: true } — o app usa para descobrir o servidor
 *   POST /api/respostas              recebe o pacote .zip (ou respostas.json) e guarda
 *   GET  /api/respostas              lista (exige token)
 *   GET  /api/respostas/:id          respostas.json normalizado (exige token)
 *   GET  /api/respostas/:id/pacote.zip  pacote reimportável no formulário (exige token)
 *   GET  /api/respostas/:id/resumo.md   relatório com a síntese (exige token)
 *
 * O corpo chega como fluxo: cotas e tetos são decididos antes de ler qualquer byte.
 */

export type { RateLimit } from './guard'

export interface Quotas {
  /** Envios processados ao mesmo tempo; acima disso responde 503 sem ler o corpo. */
  readonly maxInFlight: number
  /** Tamanho do banco a partir do qual novos envios são recusados (507). */
  readonly maxDbBytes: number
}

export interface HandlerOptions {
  readonly store: Store
  /** Token exigido para ler as respostas; vazio desliga a leitura. */
  readonly token: string
  /** Pasta com o index.html compilado, ou null para servir só a API. */
  readonly distDir: string | null
  readonly limits?: ImportLimits
  /** Envios por endereço. */
  readonly rateLimit?: RateLimit
  /** Envios somados de todos os endereços. */
  readonly globalRateLimit?: RateLimit
  /** Leituras com token errado, por endereço. */
  readonly authRateLimit?: RateLimit
  readonly quotas?: Partial<Quotas>
  readonly now?: () => Date
  readonly onError?: (error: unknown) => void
}

export type Handler = (request: Request, clientIp: string) => Promise<Response>

const MINUTE_MS = 60 * 1000
export const DEFAULT_RATE_LIMIT: RateLimit = { max: 30, windowMs: 15 * MINUTE_MS }
export const DEFAULT_GLOBAL_RATE_LIMIT: RateLimit = { max: 300, windowMs: 60 * MINUTE_MS }
export const DEFAULT_AUTH_RATE_LIMIT: RateLimit = { max: 10, windowMs: 15 * MINUTE_MS }
export const DEFAULT_QUOTAS: Quotas = { maxInFlight: 2, maxDbBytes: 2 * 1024 * 1024 * 1024 }
/** Menor que o teto da importação no navegador: aqui qualquer pessoa pode enviar. */
export const UPLOAD_LIMITS: ImportLimits = { ...IMPORT_LIMITS, maxTotalBytes: 60 * 1024 * 1024 }

const GLOBAL_KEY = '*'
const TOO_BIG = 'O arquivo é grande demais para ser importado.'
const RESPONSE_ROUTE = /^\/api\/respostas\/(\d+)(?:\/(pacote\.zip|resumo\.md))?$/

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
} as const

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Authorization, Content-Type',
} as const

const isRead = (method: string) => method === 'GET' || method === 'HEAD'
const json = (body: unknown, status = 200): Response => Response.json(body, { status })
const failure = (status: number, message: string): Response => json({ erro: message }, status)
const text = (body: string, status: number, contentType: string, headers: Record<string, string> = {}): Response =>
  new Response(body, { status, headers: { 'content-type': contentType, ...headers } })

const withHeaders = (response: Response, headers: Readonly<Record<string, string>>): Response => {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
  return response
}

/** Erro no formato da API, com os mesmos cabeçalhos das rotas — para o adaptador HTTP. */
export const apiError = (status: number, message: string): Response =>
  withHeaders(failure(status, message), { ...SECURITY_HEADERS, ...CORS_HEADERS })

// Comparar os hashes iguala o tempo de resposta mesmo quando os tamanhos diferem.
const digest = (value: string) => createHash('sha256').update(value).digest()

function isAuthorized(request: Request, token: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  return given.length > 0 && timingSafeEqual(digest(given), digest(token))
}

export function createHandler(options: HandlerOptions): Handler {
  const { store, token, distDir } = options
  const limits = options.limits ?? UPLOAD_LIMITS
  const quotas: Quotas = { ...DEFAULT_QUOTAS, ...options.quotas }
  const now = options.now ?? (() => new Date())
  const onError = options.onError ?? ((error: unknown) => console.error('[servidor]', error))
  const perIp = createLimiter(options.rateLimit ?? DEFAULT_RATE_LIMIT, now)
  const global = createLimiter(options.globalRateLimit ?? DEFAULT_GLOBAL_RATE_LIMIT, now)
  const auth = createLimiter(options.authRateLimit ?? DEFAULT_AUTH_RATE_LIMIT, now)
  let inFlight = 0

  const readOnlyWithToken = async (request: Request, clientIp: string, respond: () => Promise<Response>): Promise<Response> => {
    if (request.method !== 'GET') return failure(405, 'Método não permitido.')
    if (!token) return failure(503, 'Leitura desligada: configure API_TOKEN no servidor.')
    // Checado antes de comparar, para que o bloqueio não revele se o token está certo.
    if (auth.isExhausted(clientIp)) return failure(429, 'Muitas tentativas de acesso deste endereço. Tente mais tarde.')
    if (!isAuthorized(request, token)) {
      auth.hit(clientIp)
      return failure(401, 'Token inválido ou ausente.')
    }
    return respond()
  }

  async function receive(request: Request, clientIp: string): Promise<Response> {
    if (perIp.isExhausted(clientIp) || global.isExhausted(GLOBAL_KEY)) return failure(429, 'Muitos envios. Tente mais tarde.')
    if (inFlight >= quotas.maxInFlight) return failure(503, 'O servidor está ocupado com outros envios. Tente de novo em instantes.')
    // Reservado antes de qualquer espera, para que envios simultâneos não passem juntos pela cota.
    inFlight += 1
    try {
      if ((await store.sizeBytes()) > quotas.maxDbBytes) {
        return failure(507, 'O servidor está sem espaço para novas respostas. Avise o responsável pelo projeto.')
      }
      perIp.hit(clientIp)
      global.hit(GLOBAL_KEY)
      const bytes = await readBody(request, limits.maxTotalBytes)
      const record = await intake(bytes, request.headers.get('content-type') ?? '', now(), limits)
      return json(await store.save(record), 201)
    } catch (error) {
      if (error instanceof BodyTooLarge) return failure(413, TOO_BIG)
      if (error instanceof ImportError) return failure(400, error.message)
      throw error
    } finally {
      inFlight -= 1
    }
  }

  async function savedResponse(id: number, part: string | undefined): Promise<Response> {
    const saved = await store.get(id)
    if (!saved) return failure(404, 'Resposta não encontrada.')
    if (part === 'pacote.zip') {
      return new Response(saved.pacote.slice(), {
        headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="steriliza-requisitos-${id}.zip"` },
      })
    }
    if (part === 'resumo.md') return text(saved.resumo, 200, 'text/markdown; charset=utf-8')
    return text(saved.dados, 200, 'application/json; charset=utf-8')
  }

  async function api(request: Request, path: string, clientIp: string): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
    if (path === '/api/saude') return isRead(request.method) ? json({ ok: true }) : failure(405, 'Método não permitido.')
    if (path === '/api/respostas') {
      if (request.method === 'POST') return receive(request, clientIp)
      return readOnlyWithToken(request, clientIp, async () => json(await store.list()))
    }
    const match = RESPONSE_ROUTE.exec(path)
    if (match) return readOnlyWithToken(request, clientIp, () => savedResponse(Number(match[1]), match[2]))
    return failure(404, 'Rota não encontrada.')
  }

  function page(request: Request): Response {
    if (!isRead(request.method)) return failure(405, 'Método não permitido.')
    const notBuilt = () => text('Formulário ainda não compilado: rode `npm run build` e reinicie o servidor.', 404, 'text/plain; charset=utf-8')
    if (!distDir) return notBuilt()
    try {
      return text(readFileSync(join(distDir, 'index.html'), 'utf8'), 200, 'text/html; charset=utf-8', { 'cache-control': 'no-cache' })
    } catch {
      return notBuilt()
    }
  }

  return async (request, clientIp) => {
    const path = new URL(request.url).pathname
    try {
      if (path.startsWith('/api/')) return withHeaders(await api(request, path, clientIp), { ...SECURITY_HEADERS, ...CORS_HEADERS })
      if (path === '/' || path === '/index.html') return withHeaders(page(request), SECURITY_HEADERS)
      return withHeaders(failure(404, 'Rota não encontrada.'), SECURITY_HEADERS)
    } catch (error) {
      onError(error)
      return withHeaders(failure(500, 'Erro interno no servidor.'), SECURITY_HEADERS)
    }
  }
}
