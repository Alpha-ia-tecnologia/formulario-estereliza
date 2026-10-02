import { parseIsoDate } from './format'
import { DOCUMENT_STATUSES, UNIT_IDS, unitKey } from './options'
import { isOtherValue } from './other'
import { isRecord } from './progress'
import { ALL_FIELDS } from './schema'
import type { AnswerValue, Answers, Field } from './types'

/**
 * Validação de fronteira: arquivos importados e o rascunho salvo vêm de fora
 * do código, então cada resposta é conferida contra o schema e o que não se
 * encaixa é descartado.
 */

export const FORM_ID = 'steriliza-requisitos'
/**
 * Versão 4: entram as unidades dentro de hospitais (Unimed Teresina e DOMU São
 * Luís), a integração com a Cobli e a operação sem internet; recebimento, limpeza
 * e preparo viram uma etapa só, e saem a hospedagem e "quem completa as
 * respostas". Versões anteriores usam os mesmos ids com outro significado (ex.:
 * 2.8 era a hospedagem), por isso não são importadas.
 */
export const FORM_VERSION = 4
export const MAX_TEXT_LENGTH = 5000

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

const DIGITS = /^\d{1,9}$/
const DOCUMENT_VALUES: readonly string[] = DOCUMENT_STATUSES.map((status) => status.value)

const cleanText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : undefined

function cleanRecord(
  value: unknown,
  keys: readonly string[],
  accept: (entry: string) => boolean,
): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) return undefined
  const entries = keys.flatMap((key) => {
    const entry = (value as Record<string, unknown>)[key]
    return typeof entry === 'string' && accept(entry) ? [[key, entry.slice(0, MAX_TEXT_LENGTH)] as const] : []
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function cleanValue(field: Field, value: unknown): AnswerValue | undefined {
  switch (field.kind) {
    case 'text': {
      const text = cleanText(value)
      if (field.inputType === 'date') return text !== undefined && parseIsoDate(text) ? text : undefined
      return text
    }
    case 'number':
      return typeof value === 'string' && DIGITS.test(value) ? value : undefined
    case 'single': {
      if (typeof value !== 'string') return undefined
      if (field.options.some((option) => option.value === value)) return value
      return field.other && isOtherValue(value) ? value.slice(0, MAX_TEXT_LENGTH) : undefined
    }
    case 'multi': {
      if (!Array.isArray(value)) return undefined
      const allowed = field.options.map((option) => option.value)
      const seen = new Set<string>()
      let hasOther = false
      const picked = value.flatMap((item): string[] => {
        if (typeof item !== 'string') return []
        if (allowed.includes(item)) {
          if (seen.has(item)) return []
          seen.add(item)
          return [item]
        }
        // No máximo uma resposta "Outra", com o texto limitado.
        if (field.other && isOtherValue(item) && !hasOther) {
          hasOther = true
          return [item.slice(0, MAX_TEXT_LENGTH)]
        }
        return []
      })
      return picked.length > 0 ? picked : undefined
    }
    case 'ranked':
      return Array.isArray(value) ? value.slice(0, field.count).map((item) => cleanText(item) ?? '') : undefined
    case 'numberGrid':
      return cleanRecord(value, field.items.map((item) => item.key), (entry) => DIGITS.test(entry))
    case 'matrix': {
      const levels = field.levels.map((level) => level.value)
      return cleanRecord(value, field.items.map((item) => item.key), (entry) => levels.includes(entry))
    }
    case 'documents':
      return cleanRecord(value, field.items.map((item) => item.key), (entry) => DOCUMENT_VALUES.includes(entry))
    case 'person':
      return cleanRecord(value, ['nome', 'contato'], () => true)
  }
}

/** Chaves aceitas para um campo: a própria, ou uma por unidade quando é por unidade. */
const keysOf = (field: Field): readonly string[] =>
  field.perUnit ? UNIT_IDS.map((unit) => unitKey(field.id, unit)) : [field.id]

export function sanitizeAnswers(raw: unknown): Answers {
  if (!isRecord(raw)) return {}
  const source = raw as Record<string, unknown>
  const entries = ALL_FIELDS.flatMap((field) =>
    keysOf(field).flatMap((key) => {
      if (!Object.hasOwn(source, key)) return []
      const value = cleanValue(field, source[key])
      return value === undefined ? [] : [[key, value] as const]
    }),
  )
  return Object.fromEntries(entries)
}

export interface ParsedExport {
  readonly answers: Answers
}

export function parseExport(raw: unknown): ParsedExport {
  if (!isRecord(raw)) throw new ImportError('O arquivo não contém respostas deste formulário.')
  const data = raw as Record<string, unknown>
  if (data.formulario !== FORM_ID) throw new ImportError('Este arquivo não é do formulário de requisitos da Steriliza.')
  if (data.versao !== FORM_VERSION) {
    throw new ImportError('Este arquivo é de uma versão anterior do formulário e não pode ser importado.')
  }
  return { answers: sanitizeAnswers(data.respostas) }
}
