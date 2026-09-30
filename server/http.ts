import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http'
import { Readable } from 'node:stream'
import { type Handler, apiError } from './app'

/**
 * Adaptador entre o node:http e o handler baseado em Request/Response. O corpo
 * é entregue como fluxo, sem guardar nada: quem decide se e quanto ler é o handler.
 */

export interface ServeOptions {
  readonly host: string
  /** 0 escolhe uma porta livre (útil em testes). */
  readonly port: number
  /** Atrás de um proxy reverso, usa o último endereço de X-Forwarded-For (o que o proxy anotou). */
  readonly trustProxy?: boolean
}

export interface RunningServer {
  readonly server: Server
  readonly port: number
  close(): Promise<void>
}

function toRequest(req: IncomingMessage): Request {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value)
    else if (Array.isArray(value)) headers.set(name, value.join(', '))
  }
  const method = req.method ?? 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
  // `duplex` é exigido pelo fetch para corpo em fluxo e ainda não consta nos tipos do TypeScript.
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>) : undefined,
    duplex: hasBody ? 'half' : undefined,
  }
  return new Request(url, init)
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? '')
  const last = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1)
  return (trustProxy && last) || req.socket.remoteAddress || ''
}

async function write(req: IncomingMessage, res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, name) => {
    headers[name] = value
  })
  // Resposta dada antes de o corpo terminar de chegar: fecha a conexão em vez de descartar o resto.
  if (!req.complete) headers.connection = 'close'
  res.writeHead(response.status, headers)
  res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined)
}

export function serve(handler: Handler, { host, port, trustProxy = false }: ServeOptions): Promise<RunningServer> {
  async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let request: Request
    try {
      request = toRequest(req)
    } catch {
      await write(req, res, apiError(400, 'Requisição inválida.'))
      return
    }
    try {
      await write(req, res, await handler(request, clientIp(req, trustProxy)))
    } catch {
      if (res.headersSent) res.destroy()
      else await write(req, res, apiError(500, 'Erro interno no servidor.'))
    }
  }

  const server = createServer((req, res) => {
    dispatch(req, res).catch(() => res.destroy())
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const address = server.address()
      resolve({
        server,
        port: typeof address === 'object' && address ? address.port : port,
        close: () =>
          new Promise((done, fail) => {
            server.closeAllConnections()
            server.close((error) => (error ? fail(error) : done()))
          }),
      })
    })
  })
}
