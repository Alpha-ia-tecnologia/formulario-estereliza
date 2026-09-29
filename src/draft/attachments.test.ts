import { IDBFactory } from 'fake-indexeddb'
import { type AttachmentStore, createAttachmentStore, createIndexedDbStore, createMemoryStore } from './attachments'

const stores: ReadonlyArray<[string, () => AttachmentStore]> = [
  ['memória', createMemoryStore],
  ['IndexedDB', () => createIndexedDbStore(new IDBFactory())],
]

describe.each(stores)('anexos em %s', (_name, create) => {
  it('adiciona, lista e remove anexos', async () => {
    const store = create()
    const first = await store.add({ docKey: 'formularios', name: 'a.pdf', blob: new Blob(['abc'], { type: 'application/pdf' }) })
    await store.add({ docKey: 'equipamentos', name: 'b.csv', blob: new Blob(['x']) })

    const listed = await store.list()
    expect(listed.map((item) => item.name)).toEqual(['a.pdf', 'b.csv'])
    expect(listed[0]).toMatchObject({ id: first.id, size: 3, type: 'application/pdf', docKey: 'formularios' })

    await store.remove(first.id)
    expect((await store.list()).map((item) => item.name)).toEqual(['b.csv'])
  })

  it('limpa todos os anexos', async () => {
    const store = create()
    await store.add({ docKey: 'equipamentos', name: '1.csv', blob: new Blob(['1']) })
    await store.add({ docKey: 'faturamento', name: '2.csv', blob: new Blob(['2']) })
    await store.clear()
    expect(await store.list()).toEqual([])
  })
})

describe('atualização do banco de anexos', () => {
  /** Simula o build antigo aberto em outra aba: conexão na versão 1 que nunca fecha. */
  async function openOldTab(factory: IDBFactory): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = factory.open('steriliza-requisitos', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('anexos', { keyPath: 'id' }).createIndex('unit', 'unit')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  it('falha com erro, em vez de travar, quando outra aba segura a versão antiga', async () => {
    const factory = new IDBFactory()
    const oldTab = await openOldTab(factory)
    const store = createIndexedDbStore(factory)

    await expect(store.list()).rejects.toThrow(/outra aba/)

    oldTab.close()
    await expect(store.list()).resolves.toEqual([])
  })

  it('libera a própria conexão quando uma versão mais nova do formulário abre o banco', async () => {
    const factory = new IDBFactory()
    const store = createIndexedDbStore(factory)
    await store.list()

    const newer = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('steriliza-requisitos', 3)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('bloqueado'))
    })
    expect(newer.version).toBe(3)
    newer.close()
  })
})

describe('createAttachmentStore', () => {
  it('cai para memória quando não há IndexedDB', () => {
    expect(createAttachmentStore().persistent).toBe(typeof indexedDB !== 'undefined')
  })
})
