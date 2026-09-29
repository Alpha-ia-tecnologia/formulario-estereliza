import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react'
import { MAX_FILE_BYTES, formatBytes } from '../lib/files'
import { type Attachment, type AttachmentStore, BLOCKED_MESSAGE, createAttachmentStore } from './attachments'

const AttachmentStoreContext = createContext<AttachmentStore | null>(null)

export function AttachmentsProvider({ store, children }: { store?: AttachmentStore; children: ReactNode }) {
  const [value] = useState(() => store ?? createAttachmentStore())
  return <AttachmentStoreContext.Provider value={value}>{children}</AttachmentStoreContext.Provider>
}

export function useAttachmentStore(): AttachmentStore {
  const store = useContext(AttachmentStoreContext)
  if (!store) throw new Error('useAttachmentStore precisa estar dentro de <AttachmentsProvider>')
  return store
}

export interface AttachmentsApi {
  readonly items: readonly Attachment[]
  readonly loading: boolean
  readonly error: string | null
  readonly persistent: boolean
  /** Guarda os arquivos e devolve quantos foram aceitos. */
  add(docKey: string, files: readonly File[]): Promise<number>
  /** Remove o anexo e devolve a lista atualizada. */
  remove(id: string): Promise<readonly Attachment[]>
}

/** Lista e altera os anexos do formulário, com mensagens prontas para a interface. */
export function useAttachments(): AttachmentsApi {
  const store = useAttachmentStore()
  const [items, setItems] = useState<readonly Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<readonly Attachment[]> => {
    try {
      const next = await store.list()
      setItems(next)
      return next
    } catch (error) {
      setError(
        error instanceof Error && error.message === BLOCKED_MESSAGE
          ? BLOCKED_MESSAGE
          : 'Não foi possível ler os anexos salvos neste navegador.',
      )
      return []
    } finally {
      setLoading(false)
    }
  }, [store])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const add = useCallback(
    async (docKey: string, files: readonly File[]) => {
      const tooBig = files.filter((file) => file.size > MAX_FILE_BYTES)
      const accepted = files.filter((file) => file.size <= MAX_FILE_BYTES)
      setError(
        tooBig.length > 0
          ? `${tooBig.map((file) => file.name).join(', ')} passa de ${formatBytes(MAX_FILE_BYTES)}. Envie esse arquivo por outro meio.`
          : null,
      )
      try {
        for (const file of accepted) await store.add({ docKey, name: file.name, blob: file })
      } catch {
        setError('Não foi possível guardar o anexo. O navegador pode estar sem espaço.')
      }
      await refresh()
      return accepted.length
    },
    [store, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await store.remove(id)
      } catch {
        setError('Não foi possível remover o anexo.')
      }
      return refresh()
    },
    [store, refresh],
  )

  return { items, loading, error, persistent: store.persistent, add, remove }
}
