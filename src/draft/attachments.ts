/**
 * Anexos da seção de documentos. Ficam no IndexedDB do navegador
 * (localStorage não comporta arquivos) e seguem para o pacote .zip.
 */
export interface Attachment {
  readonly id: string
  readonly docKey: string
  readonly name: string
  readonly type: string
  readonly size: number
  readonly addedAt: string
  readonly blob: Blob
}

export interface NewAttachment {
  readonly docKey: string
  readonly name: string
  readonly blob: Blob
}

export interface AttachmentStore {
  /** false quando os anexos só duram até a página ser fechada. */
  readonly persistent: boolean
  list(): Promise<readonly Attachment[]>
  add(input: NewAttachment): Promise<Attachment>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

const DB_NAME = 'steriliza-requisitos'
/** Versão 2: anexos do formulário único, sem separação por unidade. */
const DB_VERSION = 2
const STORE_NAME = 'anexos'

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function toAttachment(input: NewAttachment): Attachment {
  return {
    id: newId(),
    docKey: input.docKey,
    name: input.name,
    type: input.blob.type,
    size: input.blob.size,
    addedAt: new Date().toISOString(),
    blob: input.blob,
  }
}

const byDate = (a: Attachment, b: Attachment) => a.addedAt.localeCompare(b.addedAt)

export function createMemoryStore(): AttachmentStore {
  let items: readonly Attachment[] = []
  return {
    persistent: false,
    async list() {
      return items.toSorted(byDate)
    },
    async add(input) {
      const attachment = toAttachment(input)
      items = [...items, attachment]
      return attachment
    },
    async remove(id) {
      items = items.filter((item) => item.id !== id)
    },
    async clear() {
      items = []
    },
  }
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha no IndexedDB'))
  })
}

export const BLOCKED_MESSAGE = 'O formulário está aberto em outra aba com uma versão anterior. Feche a outra aba e recarregue.'

function openDatabase(factory: IDBFactory, onClose: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      // A versão 1 separava anexos por unidade; o formato novo recomeça a lista.
      if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME)
      db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => {
      const db = request.result
      // Libera a conexão quando uma versão mais nova do formulário precisar atualizar o banco.
      db.onversionchange = () => {
        db.close()
        onClose()
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error ?? new Error('Falha no IndexedDB'))
    // Outra aba segura a versão antiga: falha já, em vez de esperar para sempre.
    request.onblocked = () => reject(new Error(BLOCKED_MESSAGE))
  })
}

export function createIndexedDbStore(factory: IDBFactory): AttachmentStore {
  let database: Promise<IDBDatabase> | null = null
  const forget = () => {
    database = null
  }
  const db = () =>
    (database ??= openDatabase(factory, forget).catch((error: unknown) => {
      forget() // permite tentar de novo depois que a outra aba fechar
      throw error
    }))

  /** Executa uma requisição e só resolve depois que a transação é gravada. */
  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const transaction = (await db()).transaction(STORE_NAME, mode)
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha no IndexedDB'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Operação cancelada'))
    })
    const [result] = await Promise.all([promisify(action(transaction.objectStore(STORE_NAME))), committed])
    return result
  }

  return {
    persistent: true,
    async list() {
      const items = await run('readonly', (store) => store.getAll() as IDBRequest<Attachment[]>)
      return items.toSorted(byDate)
    },
    async add(input) {
      const attachment = toAttachment(input)
      await run('readwrite', (store) => store.add(attachment))
      return attachment
    },
    async remove(id) {
      await run('readwrite', (store) => store.delete(id))
    },
    async clear() {
      await run('readwrite', (store) => store.clear())
    },
  }
}

/** Usa IndexedDB quando disponível; senão, mantém os anexos só na memória. */
export function createAttachmentStore(): AttachmentStore {
  return typeof indexedDB === 'undefined' ? createMemoryStore() : createIndexedDbStore(indexedDB)
}
