/**
 * Cliente do servidor que guarda as respostas (server/). O app descobre o
 * servidor pela rota de saúde e, quando ele existe, oferece "Enviar respostas".
 */

export interface Receipt {
  readonly id: number
  readonly recebidoEm: string
}

export interface ApiClient {
  send(pacote: Blob): Promise<Receipt>
}

/** Erro com mensagem pronta para mostrar a quem responde. */
export class SendError extends Error {
  override readonly name = 'SendError'
}

type FetchFn = typeof fetch
type Env = { readonly VITE_API_URL?: string }

/** A detecção é rápida; o envio pode carregar dezenas de MB numa conexão lenta. */
export const DETECT_TIMEOUT_MS = 5000
export const SEND_TIMEOUT_MS = 10 * 60 * 1000

const NO_CONNECTION = 'Sem conexão com o servidor. Confira a internet e tente de novo, ou baixe o pacote e envie por e-mail.'
const TIMED_OUT = 'O envio demorou demais e foi interrompido. Tente de novo ou baixe o pacote e envie por e-mail.'
const NO_RECEIPT = 'O servidor respondeu sem o número de protocolo. Tente de novo.'
const SERVER_FAILED = 'O servidor não conseguiu receber as respostas. Tente de novo em instantes.'
/** Quando a resposta não traz a mensagem da API (por exemplo, veio de um proxy). */
const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  413: 'O pacote é grande demais para o servidor. Reduza os anexos e tente de novo.',
  429: 'Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo.',
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null
const isTimeout = (error: unknown): boolean => isObject(error) && (error.name === 'TimeoutError' || error.name === 'AbortError')
// Navegadores antigos não têm AbortSignal.timeout; aí o envio segue sem limite.
const timeoutSignal = (ms: number): AbortSignal | undefined =>
  typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined

/** Origem do servidor: a configurada, a própria página (http) ou nenhuma (arquivo aberto do disco). */
export function apiBase(env: Env = import.meta.env, protocol: string = window.location.protocol): string | null {
  const configured = (env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
  if (configured) return configured
  return protocol === 'http:' || protocol === 'https:' ? '' : null
}

export async function detectApi(base: string | null, fetchFn: FetchFn = fetch): Promise<ApiClient | null> {
  if (base === null) return null
  try {
    const response = await fetchFn(`${base}/api/saude`, { method: 'GET', signal: timeoutSignal(DETECT_TIMEOUT_MS) })
    if (!response.ok) return null
    const body: unknown = await response.json()
    return isObject(body) && body.ok === true ? createApi(base, fetchFn) : null
  } catch {
    return null
  }
}

function toReceipt(body: unknown): Receipt {
  if (isObject(body) && typeof body.id === 'number' && typeof body.recebidoEm === 'string') return { id: body.id, recebidoEm: body.recebidoEm }
  throw new SendError(NO_RECEIPT)
}

function toError(status: number, body: unknown): SendError {
  // As mensagens da API são textos fixos do servidor, pensados para quem responde.
  if (isObject(body) && typeof body.erro === 'string') return new SendError(body.erro)
  return new SendError(STATUS_MESSAGES[status] ?? SERVER_FAILED)
}

export function createApi(base: string, fetchFn: FetchFn = fetch): ApiClient {
  return {
    async send(pacote) {
      let response: Response
      try {
        response = await fetchFn(`${base}/api/respostas`, {
          method: 'POST',
          headers: { 'content-type': 'application/zip' },
          body: pacote,
          signal: timeoutSignal(SEND_TIMEOUT_MS),
        })
      } catch (error) {
        throw new SendError(isTimeout(error) ? TIMED_OUT : NO_CONNECTION)
      }
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) throw toError(response.status, body)
      return toReceipt(body)
    },
  }
}
