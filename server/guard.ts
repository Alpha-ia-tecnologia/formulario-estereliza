/**
 * Proteções do servidor que não dependem das rotas: limite de tentativas por
 * chave numa janela de tempo e leitura do corpo da requisição com teto.
 */

export interface RateLimit {
  readonly max: number
  readonly windowMs: number
}

export interface Limiter {
  /** true quando a chave já usou todas as tentativas da janela. */
  isExhausted(key: string): boolean
  hit(key: string): void
}

/** Chaves lembradas pelo limitador; além disso, as menos recentes saem. */
export const MAX_TRACKED_KEYS = 5000

export function createLimiter({ max, windowMs }: RateLimit, now: () => Date): Limiter {
  const hits = new Map<string, readonly number[]>()
  const recent = (key: string, moment: number) => (hits.get(key) ?? []).filter((time) => time > moment - windowMs)
  return {
    isExhausted: (key) => recent(key, now().getTime()).length >= max,
    hit(key) {
      const moment = now().getTime()
      const times = [...recent(key, moment), moment]
      // Reinserir mantém o mapa ordenado da chave menos recente para a mais recente.
      hits.delete(key)
      hits.set(key, times)
      for (const oldest of hits.keys()) {
        if (hits.size <= MAX_TRACKED_KEYS) break
        hits.delete(oldest)
      }
    },
  }
}

export class BodyTooLarge extends Error {
  override readonly name = 'BodyTooLarge'
}

/**
 * Lê o corpo até o teto. Passou dele, para de ler sem cancelar o fluxo: a
 * resposta 413 sai primeiro e a conexão é fechada em seguida pelo adaptador.
 */
export async function readBody(request: Request, max: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length') ?? 0) > max) throw new BodyTooLarge()
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array(0)
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) throw new BodyTooLarge()
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset)
    return offset + chunk.byteLength
  }, 0)
  return bytes
}
