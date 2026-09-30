import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { buildExportJson, buildPackage, readPackage } from '../src/draft/package'
import type { Answers } from '../src/form/types'
import { type Handler, type HandlerOptions, createHandler } from './app'
import { openStore } from './store'

const ANSWERS: Answers = {
  'ident.nome': 'Ana',
  'ident.cargo': 'Gerente',
  'ident.unidades': ['teresina'],
  '2.8@teresina': 'offline',
}
const NOW = new Date('2026-09-29T15:00:00.000Z')
const TOKEN = 'segredo-de-teste'

const db = new PGlite()

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.exec('DROP TABLE IF EXISTS respostas')
})

async function zipBytes(answers: Answers = ANSWERS): Promise<Uint8Array<ArrayBuffer>> {
  const built = await buildPackage({ answers, attachments: [], now: NOW })
  return new Uint8Array(await built.blob.arrayBuffer())
}

const post = (handler: Handler, body: BodyInit, type = 'application/zip', ip = '10.0.0.1') =>
  handler(new Request('http://formulario.local/api/respostas', { method: 'POST', headers: { 'content-type': type }, body }), ip)

const get = (handler: Handler, path: string, token?: string) =>
  handler(new Request(`http://formulario.local${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }), '10.0.0.1')

async function setup(over: Partial<HandlerOptions> = {}) {
  const store = await openStore(db)
  const handler = createHandler({ store, token: TOKEN, distDir: null, now: () => NOW, ...over })
  return { store, handler }
}

describe('recebimento de respostas', () => {
  it('recebe o pacote .zip, normaliza no servidor e guarda', async () => {
    const { store, handler } = await setup()

    const response = await post(handler, await zipBytes())

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: 1, recebidoEm: '2026-09-29T15:00:00.000Z' })
    const saved = await store.get(1)
    expect(saved).toMatchObject({ respondente: 'Ana', cargo: 'Gerente', unidades: ['Teresina — PI'], anexos: 0 })
    expect(saved?.sintese).toMatch(/^Levantamento de requisitos da Steriliza para 1 unidade \(Teresina\)/)
    const dados = JSON.parse(saved?.dados ?? '{}')
    expect(dados.formulario).toBe('steriliza-requisitos')
    expect(dados.sintese.attention[0].text).toMatch(/^Precisa funcionar sem internet em Teresina/)
    expect(saved?.resumo).toContain('## Síntese')
  })

  it('aceita também o respostas.json avulso', async () => {
    const { store, handler } = await setup()
    const json = JSON.stringify(buildExportJson({ answers: ANSWERS, attachments: [], now: NOW }))

    const response = await post(handler, json, 'application/json')

    expect(response.status).toBe(201)
    expect((await store.get(1))?.respondente).toBe('Ana')
  })

  it('recusa arquivos que não são deste formulário, com a mensagem da importação', async () => {
    const { handler } = await setup()

    const corrupted = await post(handler, new Uint8Array([1, 2, 3]))
    const other = await post(handler, JSON.stringify({ formulario: 'outro', versao: 2 }), 'application/json')

    expect(corrupted.status).toBe(400)
    expect(await corrupted.json()).toEqual({ erro: 'O arquivo .zip está corrompido ou não pôde ser aberto.' })
    expect(other.status).toBe(400)
    expect(await other.json()).toEqual({ erro: 'Este arquivo não é do formulário de requisitos da Steriliza.' })
  })

  it('recusa corpo maior que o limite do pacote', async () => {
    const { handler } = await setup({ limits: { maxJsonBytes: 100, maxFileBytes: 100, maxTotalBytes: 100 } })

    const response = await post(handler, new Uint8Array(200))

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ erro: 'O arquivo é grande demais para ser importado.' })
  })

  it('limita envios por endereço e no total', async () => {
    const { handler } = await setup({ rateLimit: { max: 2, windowMs: 60_000 }, globalRateLimit: { max: 3, windowMs: 60_000 } })
    const zip = await zipBytes()

    expect((await post(handler, zip)).status).toBe(201)
    expect((await post(handler, zip)).status).toBe(201)
    expect((await post(handler, zip)).status).toBe(429)
    expect((await post(handler, zip, 'application/zip', '10.0.0.2')).status).toBe(201)
    expect((await post(handler, zip, 'application/zip', '10.0.0.3')).status).toBe(429)
  })

  it('não processa mais envios ao mesmo tempo do que a cota', async () => {
    const { handler } = await setup({ quotas: { maxInFlight: 2 } })
    const zip = await zipBytes()

    const statuses = (await Promise.all([post(handler, zip), post(handler, zip), post(handler, zip)])).map((response) => response.status)

    expect([...statuses].sort()).toEqual([201, 201, 503])
    expect((await post(handler, zip)).status).toBe(201)
  })

  it('recusa novos envios quando a tabela passa do tamanho máximo', async () => {
    const { handler } = await setup({ quotas: { maxDbBytes: 1 } })

    const response = await post(handler, await zipBytes())

    expect(response.status).toBe(507)
    expect(await response.json()).toEqual({ erro: 'O servidor está sem espaço para novas respostas. Avise o responsável pelo projeto.' })
  })
})

describe('leitura das respostas guardadas', () => {
  it('exige o token para ler', async () => {
    const { handler } = await setup()
    await post(handler, await zipBytes())

    expect((await get(handler, '/api/respostas')).status).toBe(401)
    expect((await get(handler, '/api/respostas', 'errado')).status).toBe(401)
    expect((await get(handler, '/api/respostas/1', 'errado')).status).toBe(401)
    const listed = await get(handler, '/api/respostas', TOKEN)
    expect(listed.status).toBe(200)
    expect(await listed.json()).toEqual([
      expect.objectContaining({ id: 1, respondente: 'Ana', unidades: ['Teresina — PI'], recebidoEm: '2026-09-29T15:00:00.000Z' }),
    ])
  })

  it('trava as tentativas com token errado — inclusive para o token certo, para não virar oráculo', async () => {
    const { handler } = await setup({ authRateLimit: { max: 2, windowMs: 60_000 } })

    expect((await get(handler, '/api/respostas', 'errado')).status).toBe(401)
    expect((await get(handler, '/api/respostas', 'errado')).status).toBe(401)
    expect((await get(handler, '/api/respostas', 'errado')).status).toBe(429)
    expect((await get(handler, '/api/respostas', TOKEN)).status).toBe(429)
  })

  it('sem token configurado, a leitura fica desligada', async () => {
    const { handler } = await setup({ token: '' })

    const response = await get(handler, '/api/respostas', '')

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ erro: 'Leitura desligada: configure API_TOKEN no servidor.' })
  })

  it('devolve a resposta completa, o pacote reimportável e o resumo', async () => {
    const { handler } = await setup()
    await post(handler, await zipBytes())

    const dados = await get(handler, '/api/respostas/1', TOKEN)
    const pacote = await get(handler, '/api/respostas/1/pacote.zip', TOKEN)
    const resumo = await get(handler, '/api/respostas/1/resumo.md', TOKEN)

    expect(dados.headers.get('content-type')).toMatch(/^application\/json/)
    expect((await dados.json()).respostas['ident.nome']).toBe('Ana')
    expect(pacote.headers.get('content-type')).toBe('application/zip')
    expect(pacote.headers.get('content-disposition')).toBe('attachment; filename="steriliza-requisitos-1.zip"')
    const bytes = new Uint8Array(await pacote.arrayBuffer())
    expect((await readPackage(new File([bytes], 'pacote.zip'))).answers['ident.nome']).toBe('Ana')
    expect(resumo.headers.get('content-type')).toMatch(/^text\/markdown/)
    expect(await resumo.text()).toContain('## Síntese')
    expect((await get(handler, '/api/respostas/99', TOKEN)).status).toBe(404)
    expect((await get(handler, '/api/respostas/99999999999', TOKEN)).status).toBe(404)
    expect((await get(handler, '/api/respostas/abc', TOKEN)).status).toBe(404)
  })
})

describe('rotas gerais', () => {
  it('responde à saúde sem token e ao preflight com CORS', async () => {
    const { handler } = await setup()

    const health = await get(handler, '/api/saude')
    const head = await handler(new Request('http://formulario.local/api/saude', { method: 'HEAD' }), '10.0.0.1')
    const preflight = await handler(new Request('http://formulario.local/api/respostas', { method: 'OPTIONS' }), '10.0.0.1')

    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ ok: true })
    expect(head.status).toBe(200)
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization')
    expect(health.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('serve o formulário compilado na raiz quando existe', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'steriliza-dist-'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Formulário</title>')
    const { handler } = await setup({ distDir: dir })

    const page = await get(handler, '/')
    const head = await handler(new Request('http://formulario.local/', { method: 'HEAD' }), '10.0.0.1')
    const missing = await get(handler, '/outra')

    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toMatch(/^text\/html/)
    expect(await page.text()).toContain('<title>Formulário</title>')
    expect(head.status).toBe(200)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ erro: 'Rota não encontrada.' })
    rmSync(dir, { recursive: true, force: true })
  })

  it('explica quando o formulário ainda não foi compilado', async () => {
    const { handler } = await setup({ distDir: null })

    const page = await get(handler, '/')

    expect(page.status).toBe(404)
    expect(await page.text()).toContain('npm run build')
  })

  it('não aceita outros métodos na rota de envio', async () => {
    const { handler } = await setup()

    const response = await handler(new Request('http://formulario.local/api/respostas', { method: 'DELETE' }), '10.0.0.1')

    expect(response.status).toBe(405)
  })

  it('responde 500 genérico quando o banco falha, sem vazar o erro', async () => {
    const onError = vi.fn()
    const { store } = await setup()
    const broken = createHandler({ store: { ...store, list: () => Promise.reject(new Error('conexão recusada')) }, token: TOKEN, distDir: null, onError })

    const response = await get(broken, '/api/respostas', TOKEN)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ erro: 'Erro interno no servidor.' })
    expect(onError).toHaveBeenCalledWith(new Error('conexão recusada'))
  })
})
