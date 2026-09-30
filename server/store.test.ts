import { PGlite } from '@electric-sql/pglite'
import { type NewResponse, openStore } from './store'

// PostgreSQL de verdade, compilado para WASM e em memória: testa o mesmo SQL que roda em produção.
const db = new PGlite()

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.exec('DROP TABLE IF EXISTS respostas')
})

const record = (over: Partial<NewResponse> = {}): NewResponse => ({
  recebidoEm: '2026-09-29T15:00:00.000Z',
  respondente: 'Ana',
  cargo: 'Gerente',
  unidades: ['São Luís — MA', 'Teresina — PI'],
  preenchido: 48,
  anexos: 1,
  sintese: 'Levantamento de requisitos da Steriliza para 2 unidades.',
  dados: '{"formulario":"steriliza-requisitos"}',
  resumo: '# Resumo',
  pacote: new Uint8Array([80, 75, 3, 4]),
  ...over,
})

describe('store (PostgreSQL)', () => {
  it('guarda uma resposta e devolve o número e a hora de recebimento', async () => {
    const store = await openStore(db)

    expect(await store.save(record())).toEqual({ id: 1, recebidoEm: '2026-09-29T15:00:00.000Z' })
    expect((await store.save(record({ recebidoEm: '2026-09-30T08:00:00.000Z' }))).id).toBe(2)
    expect(await store.sizeBytes()).toBeGreaterThan(0)
  })

  it('lista da mais recente para a mais antiga, só com o resumo de cada uma', async () => {
    const store = await openStore(db)
    await store.save(record())
    await store.save(record({ recebidoEm: '2026-09-30T08:00:00.000Z', respondente: 'Bia', unidades: ['Teresina — PI'] }))

    const listed = await store.list()

    expect(listed.map((item) => item.id)).toEqual([2, 1])
    expect(listed[0]).toEqual({
      id: 2,
      recebidoEm: '2026-09-30T08:00:00.000Z',
      respondente: 'Bia',
      cargo: 'Gerente',
      unidades: ['Teresina — PI'],
      preenchido: 48,
      anexos: 1,
      sintese: 'Levantamento de requisitos da Steriliza para 2 unidades.',
    })
    expect(listed[0]).not.toHaveProperty('dados')
    expect(listed[0]).not.toHaveProperty('pacote')
  })

  it('recupera a resposta completa, com o pacote em bytes e o JSON consultável por SQL', async () => {
    const store = await openStore(db)
    await store.save(record())

    const saved = await store.get(1)
    const queried = await db.query<{ formulario: string }>("SELECT dados->>'formulario' AS formulario FROM respostas")

    expect(JSON.parse(saved?.dados ?? '')).toEqual({ formulario: 'steriliza-requisitos' })
    expect(saved?.resumo).toBe('# Resumo')
    expect(saved?.pacote).toBeInstanceOf(Uint8Array)
    expect([...(saved?.pacote ?? [])]).toEqual([80, 75, 3, 4])
    expect(saved?.unidades).toEqual(['São Luís — MA', 'Teresina — PI'])
    expect(queried.rows[0]?.formulario).toBe('steriliza-requisitos')
    expect(await store.get(99)).toBeNull()
    expect(await store.get(2 ** 40)).toBeNull()
  })

  it('tira o caractere nulo, que o PostgreSQL não aceita em texto', async () => {
    const store = await openStore(db)

    await store.save(record({ respondente: 'A\u0000na', dados: JSON.stringify({ nome: 'A\u0000na' }) }))
    const saved = await store.get(1)

    expect(saved?.respondente).toBe('Ana')
    expect(JSON.parse(saved?.dados ?? '')).toEqual({ nome: 'Ana' })
  })

  it('abrir de novo não recria a tabela nem perde respostas', async () => {
    await (await openStore(db)).save(record())

    const reopened = await openStore(db)

    expect(await reopened.list()).toHaveLength(1)
  })
})
