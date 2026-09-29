import { DOCUMENT_STATUSES, getUnit, selectedUnits, unitKey, unitLabel } from './options'
import { optionLabel } from './other'
import { fieldCompletion, isRecord, resolveOptions, visibleFields } from './progress'
import { SECTIONS } from './schema'
import type { AnswerValue, Answers, Field, Option } from './types'

export interface SummaryEntry {
  readonly label?: string
  readonly text: string | null
}

export interface SummaryBlock {
  readonly id: string
  readonly number?: string
  readonly title: string
  readonly answered: boolean
  readonly entries: readonly SummaryEntry[]
}

export interface SummarySection {
  readonly id: string
  readonly number?: string
  readonly title: string
  readonly blocks: readonly SummaryBlock[]
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDateBR(value: string): string {
  const match = ISO_DATE.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

/** Data AAAA-MM-DD que existe no calendário, à meia-noite local; senão null (ex.: 2026-02-30). */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
  const date = new Date(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null
}

const labelOf = (options: readonly Option[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value

function formatStatuses(items: readonly { key: string; label: string }[], value: Readonly<Record<string, string>>): string {
  return items
    .filter((item) => value[item.key])
    .map((item) => `${item.label}: ${labelOf(DOCUMENT_STATUSES, value[item.key] ?? '')}`)
    .join('\n')
}

function formatMatrix(field: Extract<Field, { kind: 'matrix' }>, value: Readonly<Record<string, string>>): string {
  const lines = field.levels.flatMap((level) => {
    const items = field.items.filter((item) => value[item.key] === level.value).map((item) => item.label)
    return items.length > 0 ? [`${level.label}: ${items.join(', ')}`] : []
  })
  const pending = field.items.filter((item) => !field.levels.some((level) => level.value === value[item.key])).length
  return (pending > 0 ? [...lines, `Sem resposta: ${pending} ${field.itemNoun}`] : lines).join('\n')
}

function formatNumberGrid(field: Extract<Field, { kind: 'numberGrid' }>, value: Readonly<Record<string, string>>): string {
  const filled = field.items.filter((item) => (value[item.key] ?? '').trim() !== '')
  const parts = filled.map((item) => `${item.label}: ${value[item.key]}`)
  if (field.totalLabel) {
    const total = filled.reduce((sum, item) => sum + Number(value[item.key]), 0)
    return [...parts, `${field.totalLabel}: ${total}${field.suffix ? ` ${field.suffix}` : ''}`].join(' · ')
  }
  return `${parts.join(' · ')}${field.suffix ? ` (${field.suffix})` : ''}`
}

/** Texto legível de um valor, ou null quando está em branco. */
export function formatFieldValue(field: Field, value: AnswerValue | undefined, answers: Answers): string | null {
  if (value === undefined || fieldCompletion(field, value) === 0) return null
  switch (field.kind) {
    case 'text':
      return field.inputType === 'date' ? formatDateBR(String(value)) : String(value).trim()
    case 'number':
      return `${String(value)}${field.suffix ? ` ${field.suffix}` : ''}`
    case 'single':
      return optionLabel(field, resolveOptions(field, answers), String(value))
    case 'multi':
      return (value as readonly string[]).map((item) => optionLabel(field, field.options, item)).join(', ')
    case 'ranked':
      return (value as readonly string[])
        .map((item, index) => ({ item: item.trim(), position: index + 1 }))
        .filter(({ item }) => item !== '')
        .map(({ item, position }) => `${position}. ${item}`)
        .join('\n')
    case 'numberGrid':
      return isRecord(value) ? formatNumberGrid(field, value) : null
    case 'matrix':
      return isRecord(value) ? formatMatrix(field, value) : null
    case 'documents':
      return isRecord(value) ? formatStatuses(field.items, value) : null
    case 'person': {
      if (!isRecord(value)) return null
      return [value.nome, value.contato].map((part) => part?.trim()).filter(Boolean).join(' — ')
    }
  }
}

/** Linhas de um campo no resumo: uma por unidade nas perguntas feitas unidade por unidade. */
function fieldEntries(field: Field, answers: Answers, showLabel: boolean): readonly SummaryEntry[] {
  if (!field.perUnit) {
    return [{ label: showLabel ? field.label : undefined, text: formatFieldValue(field, answers[field.id], answers) }]
  }
  return selectedUnits(answers).map((unit) => {
    const { city } = getUnit(unit)
    return {
      label: showLabel && field.label ? `${field.label} · ${city}` : city,
      text: formatFieldValue(field, answers[unitKey(field.id, unit)], answers),
    }
  })
}

export function summarize(answers: Answers): readonly SummarySection[] {
  return SECTIONS.map((section) => ({
    id: section.id,
    number: section.number,
    title: section.title,
    blocks: section.blocks.map((block) => {
      const fields = visibleFields(block, answers)
      const entries = fields.flatMap((field) => fieldEntries(field, answers, fields.length > 1))
      return {
        id: block.id,
        number: block.number,
        title: block.title,
        answered: entries.some((entry) => entry.text !== null),
        entries,
      }
    }),
  }))
}

interface MarkdownInput {
  readonly exportedAt: string
  readonly answers: Answers
}

const indent = (text: string) => text.split('\n').join('\n  ')

export function toMarkdown({ exportedAt, answers }: MarkdownInput): string {
  const lines = [
    '# Formulário de requisitos — Sistema Steriliza',
    '',
    `**Unidades atendidas:** ${selectedUnits(answers).map(unitLabel).join(', ')}  `,
    `**Exportado em:** ${formatDateBR(exportedAt.slice(0, 10))}`,
  ]
  for (const section of summarize(answers)) {
    lines.push('', `## ${section.number ? `${section.number}. ` : ''}${section.title}`)
    for (const block of section.blocks) {
      lines.push('', `**${block.number ? `${block.number} ` : ''}${block.title}**`, '')
      if (!block.answered) {
        lines.push('_Em branco_')
        continue
      }
      for (const entry of block.entries) {
        const text = entry.text ?? '—'
        lines.push(entry.label ? `- ${entry.label}: ${indent(text)}` : `- ${indent(text)}`)
      }
    }
  }
  return `${lines.join('\n')}\n`
}
