import { type DragEvent, useEffect, useState } from 'react'
import { useAttachments } from '../../draft/AttachmentsContext'
import { DOCUMENT_STATUSES, type DocumentStatus } from '../../form/options'
import { isRecord } from '../../form/progress'
import type { AnswerUpdate, AnswerValue, DocumentsField as DocumentsFieldType, Item } from '../../form/types'
import { formatBytes } from '../../lib/files'
import { AlertIcon, CloseIcon, PaperclipIcon } from '../Icons'

interface DocumentsFieldProps {
  readonly field: DocumentsFieldType
  readonly value: AnswerValue | undefined
  readonly labelledBy: string
  readonly onChange: (update: AnswerUpdate) => void
}

type StatusRecord = Readonly<Record<string, string>>

const MANUAL_STATUSES = DOCUMENT_STATUSES.filter((status) => status.value !== 'anexado')
const asRecord = (value: AnswerValue | undefined): StatusRecord => (isRecord(value) ? value : {})

function withStatus(record: StatusRecord, key: string, status: DocumentStatus | undefined) {
  const { [key]: _previous, ...rest } = record
  const next = status ? { ...rest, [key]: status } : rest
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * Atualização aplicada sobre o valor mais recente — as gravações acontecem
 * depois de awaits, quando o valor da renderização já pode estar desatualizado.
 */
const setStatus = (key: string, status: DocumentStatus | undefined) => (current: AnswerValue | undefined) =>
  withStatus(asRecord(current), key, status)

/** Tira o "anexado" dos documentos indicados, preservando os demais status. */
const clearAttached = (keys: readonly string[]) => (current: AnswerValue | undefined) => {
  const record = asRecord(current)
  const entries = Object.entries(record).filter(([key, status]) => !(keys.includes(key) && status === 'anexado'))
  if (entries.length === Object.keys(record).length) return current
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** Checklist de documentos: anexar aqui, enviar depois ou marcar que não existe. */
export function DocumentsField({ field, value, labelledBy, onChange }: DocumentsFieldProps) {
  const record = asRecord(value)
  const attachments = useAttachments()
  const [dragging, setDragging] = useState<string | null>(null)

  // "Anexado" sem arquivo acontece quando os anexos foram apagados do navegador.
  useEffect(() => {
    if (attachments.loading) return
    const current = asRecord(value)
    const orphans = field.items
      .map((item) => item.key)
      .filter((key) => current[key] === 'anexado' && !attachments.items.some((file) => file.docKey === key))
    if (orphans.length > 0) onChange(clearAttached(orphans))
  }, [attachments.loading, attachments.items, field.items, value, onChange])

  const addFiles = async (item: Item, files: readonly File[]) => {
    if (files.length === 0) return
    const added = await attachments.add(item.key, files)
    if (added > 0) onChange(setStatus(item.key, 'anexado'))
  }

  const removeFile = async (item: Item, id: string) => {
    const remaining = await attachments.remove(id)
    if (!remaining.some((file) => file.docKey === item.key)) onChange(clearAttached([item.key]))
  }

  const onDrop = (item: Item) => (event: DragEvent) => {
    event.preventDefault()
    setDragging(null)
    void addFiles(item, Array.from(event.dataTransfer.files))
  }

  return (
    <div className="documents" role="group" aria-labelledby={labelledBy}>
      {!attachments.persistent && (
        <p className="notice notice--warning">
          <AlertIcon width={18} height={18} />
          <span>Este navegador não guarda anexos. Eles ficam disponíveis até você fechar a página — baixe o pacote antes disso.</span>
        </p>
      )}
      {attachments.error && (
        <p className="notice notice--danger" role="alert">
          <AlertIcon width={18} height={18} />
          <span>{attachments.error}</span>
        </p>
      )}
      <ul className="documents__list">
        {field.items.map((item) => {
          const files = attachments.items.filter((file) => file.docKey === item.key)
          const status = record[item.key]
          const inputId = `anexo-${item.key}`
          return (
            <li
              key={item.key}
              className="document"
              data-status={status ?? 'pendente'}
              data-dragging={dragging === item.key}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(item.key)
              }}
              onDragLeave={() => setDragging(null)}
              onDrop={onDrop(item)}
            >
              <div className="document__head">
                <span className="document__name" id={`${inputId}-nome`}>
                  {item.label}
                </span>
                <div className="document__actions">
                  <label className="button button--outline button--small document__attach" htmlFor={inputId}>
                    <PaperclipIcon width={16} height={16} />
                    <span>Anexar</span>
                  </label>
                  <input
                    id={inputId}
                    className="visually-hidden"
                    type="file"
                    multiple
                    aria-describedby={`${inputId}-nome`}
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? [])
                      event.target.value = ''
                      void addFiles(item, selected)
                    }}
                  />
                  {files.length === 0 &&
                    MANUAL_STATUSES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="toggle-chip"
                        aria-pressed={status === option.value}
                        onClick={() => onChange(setStatus(item.key, status === option.value ? undefined : option.value))}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
              </div>
              {files.length > 0 && (
                <ul className="document__files">
                  {files.map((file) => (
                    <li key={file.id} className="file-pill">
                      <PaperclipIcon width={14} height={14} />
                      <span className="file-pill__name">{file.name}</span>
                      <span className="file-pill__size">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        className="file-pill__remove"
                        aria-label={`Remover ${file.name}`}
                        onClick={() => void removeFile(item, file.id)}
                      >
                        <CloseIcon width={14} height={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <p className="documents__hint">Dica: arraste arquivos direto para a linha do documento. Limite de 25 MB por arquivo.</p>
    </div>
  )
}
