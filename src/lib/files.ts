export const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_NAME_LENGTH = 120
const KB = 1024
const MB = KB * 1024

const decimal = (value: number) => value.toFixed(1).replace('.', ',')

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`
  if (bytes < MB) return `${decimal(bytes / KB)} KB`
  return `${decimal(bytes / MB)} MB`
}

function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
}

/** Nome seguro para usar dentro do pacote .zip (sem pastas nem caracteres proibidos). */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001f]/g, '_').trim()
  if (cleaned === '' || cleaned === '.' || cleaned === '..') return 'arquivo'
  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned
  const [stem, extension] = splitExtension(cleaned)
  return `${stem.slice(0, MAX_NAME_LENGTH - extension.length)}${extension}`
}

export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name
  const [stem, extension] = splitExtension(name)
  let counter = 2
  while (taken.has(`${stem} (${counter})${extension}`)) counter += 1
  return `${stem} (${counter})${extension}`
}

const pad = (value: number) => String(value).padStart(2, '0')

export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function exportFileName(date: Date, extension: string): string {
  return `steriliza-requisitos-${isoDay(date)}.${extension}`
}
