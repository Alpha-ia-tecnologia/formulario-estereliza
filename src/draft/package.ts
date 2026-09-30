import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { DOCUMENTS, selectedUnits, unitLabel } from '../form/options'
import { summarize, toMarkdown } from '../form/format'
import { isRecord, pruneHidden } from '../form/progress'
import { FORM_ID, FORM_VERSION, ImportError, parseExport } from '../form/sanitize'
import { synthesisToMarkdown, synthesize } from '../form/synthesis'
import type { Answers } from '../form/types'
import { MAX_FILE_BYTES, exportFileName, safeFileName, uniqueName } from '../lib/files'
import type { Attachment } from './attachments'

export const JSON_NAME = 'respostas.json'
export const MARKDOWN_NAME = 'resumo.md'
const ATTACHMENTS_DIR = 'anexos'
const DOCUMENT_KEYS: readonly string[] = DOCUMENTS.map((doc) => doc.key)

/**
 * Remove o status "anexado" de documentos que ficaram sem arquivo (por exemplo,
 * quando os anexos foram apagados do navegador).
 */
export function reconcileDocuments(answers: Answers, attachments: readonly Attachment[]): Answers {
  const statuses = answers['documentos']
  if (!isRecord(statuses)) return answers
  const withFiles = new Set(attachments.map((attachment) => attachment.docKey))
  const kept = Object.fromEntries(
    Object.entries(statuses).filter(([key, status]) => status !== 'anexado' || withFiles.has(key)),
  )
  const { documentos: _previous, ...rest } = answers
  return Object.keys(kept).length > 0 ? { ...rest, documentos: kept } : rest
}

interface ExportInput {
  readonly answers: Answers
  readonly attachments: readonly Attachment[]
  readonly now?: Date
}

export function buildExportJson({ answers, attachments, now = new Date() }: ExportInput) {
  const clean = pruneHidden(reconcileDocuments(answers, attachments))
  const resumo = summarize(clean).flatMap((section) =>
    section.blocks.map((block) => ({
      secao: section.title,
      numero: block.number ?? null,
      pergunta: block.title,
      resposta: block.answered
        ? block.entries
            .filter((entry) => entry.text !== null)
            .map((entry) => (entry.label ? `${entry.label}: ${entry.text}` : entry.text))
            .join('\n')
        : null,
    })),
  )
  return {
    formulario: FORM_ID,
    versao: FORM_VERSION,
    unidades: selectedUnits(clean).map(unitLabel),
    exportadoEm: now.toISOString(),
    respostas: clean,
    anexos: attachments.map((attachment) => ({ documento: attachment.docKey, nome: attachment.name, bytes: attachment.size })),
    resumo,
    sintese: synthesize(clean, now),
  }
}

export type ExportJson = ReturnType<typeof buildExportJson>

export interface PackageFiles {
  readonly json: ExportJson
  /** resumo.md: relatório completo terminando na síntese. */
  readonly markdown: string
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly fileName: string
}

/** Conteúdo do pacote antes de compactar — usado pelo download e pelo servidor que guarda as respostas. */
export async function buildPackageFiles(input: ExportInput): Promise<PackageFiles> {
  const now = input.now ?? new Date()
  const json = buildExportJson({ ...input, now })
  // O relatório termina com a síntese das respostas.
  const markdown = `${toMarkdown({ exportedAt: json.exportadoEm, answers: json.respostas })}\n${synthesisToMarkdown(json.sintese)}`
  const files: Record<string, Uint8Array> = {
    [JSON_NAME]: strToU8(JSON.stringify(json, null, 2)),
    [MARKDOWN_NAME]: strToU8(markdown),
  }
  const taken = new Set<string>()
  for (const attachment of input.attachments) {
    const path = uniqueName(`${ATTACHMENTS_DIR}/${attachment.docKey}/${safeFileName(attachment.name)}`, taken)
    taken.add(path)
    files[path] = new Uint8Array(await attachment.blob.arrayBuffer())
  }
  return { json, markdown, files, fileName: exportFileName(now, 'zip') }
}

export const zipFiles = (files: Readonly<Record<string, Uint8Array>>): Uint8Array<ArrayBuffer> => zipSync(files, { level: 6 })

export interface BuiltPackage {
  readonly blob: Blob
  readonly fileName: string
}

export async function buildPackage(input: ExportInput): Promise<BuiltPackage> {
  const built = await buildPackageFiles(input)
  return {
    blob: new Blob([zipFiles(built.files)], { type: 'application/zip' }),
    fileName: built.fileName,
  }
}

export interface ImportedFile {
  readonly docKey: string
  readonly name: string
  readonly blob: Blob
}

export interface ImportedPackage {
  readonly answers: Answers
  readonly files: readonly ImportedFile[]
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const mimeOf = (name: string) => MIME_TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new ImportError('Não foi possível ler o arquivo. Confira se é o arquivo baixado deste formulário.')
  }
}

function attachmentPath(path: string): { docKey: string; name: string } | null {
  const [dir, docKey, ...rest] = path.split('/')
  if (dir !== ATTACHMENTS_DIR || !docKey || !DOCUMENT_KEYS.includes(docKey) || rest.length !== 1 || !rest[0]) return null
  return { docKey, name: safeFileName(rest[0]) }
}

/** Tetos de tamanho (descompactado) que protegem a aba contra pacotes adulterados. */
export interface ImportLimits {
  readonly maxJsonBytes: number
  readonly maxFileBytes: number
  readonly maxTotalBytes: number
}

export const IMPORT_LIMITS: ImportLimits = {
  maxJsonBytes: 5 * 1024 * 1024,
  maxFileBytes: MAX_FILE_BYTES,
  maxTotalBytes: 200 * 1024 * 1024,
}

const tooBig = () => new ImportError('O arquivo é grande demais para ser importado.')

/**
 * Descompacta só o que interessa e aborta antes de alocar memória quando os
 * tamanhos declarados no .zip passam dos limites.
 */
function unzipWithinLimits(data: Uint8Array, limits: ImportLimits): Record<string, Uint8Array> {
  let budget = limits.maxTotalBytes
  const accept = (size: number) => {
    budget -= size
    if (budget < 0) throw tooBig()
    return true
  }
  try {
    return unzipSync(data, {
      filter: (entry) => {
        if (entry.name === JSON_NAME) {
          if (entry.originalSize > limits.maxJsonBytes) throw tooBig()
          return accept(entry.originalSize)
        }
        if (attachmentPath(entry.name) === null || entry.originalSize > limits.maxFileBytes) return false
        return accept(entry.originalSize)
      },
    })
  } catch (error) {
    if (error instanceof ImportError) throw error
    throw new ImportError('O arquivo .zip está corrompido ou não pôde ser aberto.')
  }
}

/** Lê um pacote .zip ou um respostas.json exportado por este formulário. */
export async function readPackage(
  file: Blob & { readonly name: string },
  limits: ImportLimits = IMPORT_LIMITS,
): Promise<ImportedPackage> {
  const isZip = file.name.toLowerCase().endsWith('.zip')
  if (file.size > (isZip ? limits.maxTotalBytes : limits.maxJsonBytes)) throw tooBig()
  if (!isZip) {
    return { ...parseExport(parseJsonText(await file.text())), files: [] }
  }
  const entries = unzipWithinLimits(new Uint8Array(await file.arrayBuffer()), limits)
  const json = entries[JSON_NAME]
  if (!json) throw new ImportError(`O pacote não contém o arquivo ${JSON_NAME}.`)
  const parsed = parseExport(parseJsonText(strFromU8(json)))
  const files = Object.entries(entries).flatMap(([path, data]) => {
    const target = attachmentPath(path)
    return target ? [{ ...target, blob: new Blob([data.slice()], { type: mimeOf(target.name) }) }] : []
  })
  return { ...parsed, files }
}

/** Dispara o download de um arquivo gerado no navegador. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
