import { PGlite } from '@electric-sql/pglite'
import { buildPackage } from '../src/draft/package'
import { UPLOAD_LIMITS, createHandler } from './app'
import { serve } from './http'
import { openStore } from './store'

const ZIP_HEADERS = { 'content-type': 'application/zip' }

// Corpo em partes, sem content-length: só o teto durante a leitura pode barrá-lo.
const chunkedBody = (parts: number, size: number): RequestInit =>
  ({
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < parts; index += 1) controller.enqueue(new Uint8Array(size))
        controller.close()
      },
    }),
    duplex: 'half',
  }) as RequestInit

// Inclui iniciar o PostgreSQL em WASM, que leva vários segundos quando os arquivos de teste rodam em paralelo.
const PGLITE_TEST_MS = 60_000

describe('servidor http', () => {
  it('encaminha as requisições ao handler e recusa corpos grandes antes de guardá-los', async () => {
    const db = new PGlite()
    await db.waitReady
    const store = await openStore(db)
    const handler = createHandler({ store, token: '', distDir: null, limits: { ...UPLOAD_LIMITS, maxTotalBytes: 100_000 } })
    const running = await serve(handler, { host: '127.0.0.1', port: 0 })
    const base = `http://127.0.0.1:${running.port}`
    const built = await buildPackage({ answers: { 'ident.nome': 'Ana' }, attachments: [] })

    const created = await fetch(`${base}/api/respostas`, { method: 'POST', headers: ZIP_HEADERS, body: built.blob })
    const health = await fetch(`${base}/api/saude`)
    const head = await fetch(`${base}/api/saude`, { method: 'HEAD' })
    const declared = await fetch(`${base}/api/respostas`, { method: 'POST', headers: ZIP_HEADERS, body: new Uint8Array(200_000) })
    const chunked = await fetch(`${base}/api/respostas`, { method: 'POST', headers: ZIP_HEADERS, ...chunkedBody(4, 40_000) })

    expect(created.status).toBe(201)
    expect((await created.json()).id).toBe(1)
    expect(health.status).toBe(200)
    expect(head.status).toBe(200)
    expect(declared.status).toBe(413)
    expect(chunked.status).toBe(413)
    expect(await chunked.json()).toEqual({ erro: 'O arquivo é grande demais para ser importado.' })
    expect(chunked.headers.get('access-control-allow-origin')).toBe('*')
    expect((await store.get(1))?.respondente).toBe('Ana')
    expect(await store.list()).toHaveLength(1)
    await running.close()
    await db.close()
  }, PGLITE_TEST_MS)
})
