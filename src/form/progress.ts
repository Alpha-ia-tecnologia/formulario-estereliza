import { DOCUMENT_STATUSES, isUnitId, selectedUnits, unitKey } from './options'
import { ALL_FIELDS, SECTIONS, getField } from './schema'
import type { AnswerValue, Answers, Block, Field, Option, Section } from './types'

export interface Progress {
  readonly done: number
  readonly total: number
  readonly ratio: number
}

const DOCUMENT_VALUES: readonly string[] = DOCUMENT_STATUSES.map((status) => status.value)

export function isRecord(value: unknown): value is Readonly<Record<string, string>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0

export function isVisible(field: Field, answers: Answers): boolean {
  return field.when ? field.when(answers) : true
}

export function visibleFields(block: Block, answers: Answers): readonly Field[] {
  return block.fields.filter((field) => isVisible(field, answers))
}

export function resolveOptions(field: Field, answers: Answers): readonly Option[] {
  if (field.kind === 'multi' && field.filterOptions) return field.filterOptions(field.options, answers)
  if (field.kind === 'single' || field.kind === 'multi') return field.options
  return []
}

function ratioOfValidItems(items: readonly { key: string }[], value: AnswerValue | undefined, allowed: readonly string[]): number {
  if (!isRecord(value)) return 0
  const filled = items.filter((item) => allowed.includes(value[item.key] ?? '')).length
  return filled / items.length
}

/** Quanto de um valor foi preenchido, de 0 a 1 (sem considerar unidades). */
export function fieldCompletion(field: Field, value: AnswerValue | undefined): number {
  switch (field.kind) {
    case 'text':
    case 'single':
    case 'number':
      return hasText(value) ? 1 : 0
    case 'multi':
      return Array.isArray(value) && value.length > 0 ? 1 : 0
    case 'ranked':
      return Array.isArray(value) && value.some(hasText) ? 1 : 0
    case 'numberGrid':
    case 'person':
      return isRecord(value) && Object.values(value).some(hasText) ? 1 : 0
    case 'matrix':
      return ratioOfValidItems(field.items, value, field.levels.map((level) => level.value))
    case 'documents':
      return ratioOfValidItems(field.items, value, DOCUMENT_VALUES)
  }
}

/** Preenchimento de um campo; nas perguntas por unidade, a média entre as unidades atendidas. */
export function answerCompletion(field: Field, answers: Answers): number {
  if (!field.perUnit) return fieldCompletion(field, answers[field.id])
  const units = selectedUnits(answers)
  const sum = units.reduce((total, unit) => total + fieldCompletion(field, answers[unitKey(field.id, unit)]), 0)
  return sum / units.length
}

/** Uma pergunta vale o preenchimento do seu campo visível mais completo. */
export function blockCompletion(block: Block, answers: Answers): number {
  return visibleFields(block, answers).reduce((best, field) => Math.max(best, answerCompletion(field, answers)), 0)
}

function toProgress(done: number, total: number): Progress {
  return { done, total, ratio: total === 0 ? 0 : done / total }
}

export function sectionProgress(section: Section, answers: Answers): Progress {
  const done = section.blocks.reduce((sum, block) => sum + blockCompletion(block, answers), 0)
  return toProgress(done, section.blocks.length)
}

export interface Counter {
  readonly done: number
  readonly total: number
  readonly noun: string
}

type ItemizedField = Extract<Field, { kind: 'matrix' | 'documents' }>

const isItemized = (field: Field | undefined): field is ItemizedField =>
  field?.kind === 'matrix' || field?.kind === 'documents'

/**
 * Contador exibido na trilha: perguntas respondidas, ou itens quando a seção é
 * uma única matriz ou lista de documentos (seções 5 e 9).
 */
export function sectionCounter(section: Section, answers: Answers): Counter {
  const [onlyBlock] = section.blocks
  const field = section.blocks.length === 1 && onlyBlock?.fields.length === 1 ? onlyBlock.fields[0] : undefined
  if (isItemized(field)) {
    const total = field.items.length
    return {
      done: Math.round(fieldCompletion(field, answers[field.id]) * total),
      total,
      noun: field.kind === 'matrix' ? field.itemNoun : 'documentos',
    }
  }
  const progress = sectionProgress(section, answers)
  return { done: Math.floor(progress.done), total: progress.total, noun: 'respondidas' }
}

export function overallProgress(answers: Answers): Progress {
  const parts = SECTIONS.map((section) => sectionProgress(section, answers))
  return toProgress(
    parts.reduce((sum, part) => sum + part.done, 0),
    parts.reduce((sum, part) => sum + part.total, 0),
  )
}

/** Separa "1.3@teresina" em campo e unidade; chaves comuns não têm unidade. */
export function splitAnswerKey(key: string): { readonly fieldId: string; readonly unit?: string } {
  const at = key.lastIndexOf('@')
  return at < 0 ? { fieldId: key } : { fieldId: key.slice(0, at), unit: key.slice(at + 1) }
}

/**
 * Cópia só com o que vale exportar: sem campos ocultos e sem respostas de
 * unidades que não estão marcadas.
 */
export function pruneHidden(answers: Answers): Answers {
  const units: readonly string[] = selectedUnits(answers)
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => {
      const { fieldId, unit } = splitAnswerKey(key)
      const field = getField(fieldId)
      if (!field) return true
      if (!isVisible(field, answers)) return false
      return unit === undefined ? true : isUnitId(unit) && units.includes(unit)
    }),
  )
}

export function missingRequired(answers: Answers): readonly Field[] {
  return ALL_FIELDS.filter((field) => field.kind === 'text' && field.required && answerCompletion(field, answers) === 0)
}
