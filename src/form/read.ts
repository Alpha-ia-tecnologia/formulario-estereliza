import { getUnit, selectedUnits, unitKey } from './options'
import { optionLabel } from './other'
import { isRecord } from './progress'
import { getField } from './schema'
import type { Answers, UnitId } from './types'

/**
 * Leitura das respostas para a síntese: devolve valores já normalizados e
 * rótulos legíveis, sem depender de como cada campo é desenhado na tela.
 */

export const textOf = (answers: Answers, id: string): string => {
  const value = answers[id]
  return typeof value === 'string' ? value.trim() : ''
}

export const listOf = (answers: Answers, id: string): readonly string[] => {
  const value = answers[id]
  return Array.isArray(value) ? value : []
}

export const recordOf = (answers: Answers, id: string): Readonly<Record<string, string>> => {
  const value = answers[id]
  return isRecord(value) ? value : {}
}

/** Qualquer sequência de espaços e quebras de linha vira um espaço só. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Texto de várias linhas em uma linha só: "a; b; c". */
export const textLines = (answers: Answers, id: string): string =>
  textOf(answers, id)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('; ')

/** Junta itens em português: "a", "a e b", "a, b e c". */
export function joinPt(items: readonly string[]): string {
  const filled = items.filter(Boolean)
  if (filled.length <= 1) return filled[0] ?? ''
  return `${filled.slice(0, -1).join(', ')} e ${filled.at(-1)}`
}

/** Nome exibido da unidade: a cidade, ou hospital e cidade nas unidades dentro de hospitais. */
export const nameOf = (unit: UnitId): string => getUnit(unit).name

/** Rótulo legível de um valor de escolha, inclusive "Outra: texto". */
export function choiceLabel(fieldId: string, value: string): string {
  const field = getField(fieldId)
  if (!field || (field.kind !== 'single' && field.kind !== 'multi')) return value
  return optionLabel(field, field.options, value)
}

/** Rótulos de uma resposta de escolha (única ou múltipla) comum à empresa. */
export function choiceText(answers: Answers, fieldId: string): string {
  const single = textOf(answers, fieldId)
  if (single) return choiceLabel(fieldId, single)
  return joinPt(listOf(answers, fieldId).map((value) => choiceLabel(fieldId, value)))
}

/** Valores marcados por uma unidade numa pergunta feita unidade por unidade. */
export function unitValues(answers: Answers, fieldId: string, unit: UnitId): readonly string[] {
  const value = answers[unitKey(fieldId, unit)]
  if (typeof value === 'string') return value.trim() ? [value] : []
  return Array.isArray(value) ? value : []
}

/** Unidades atendidas que responderam a pergunta e cumprem a condição. */
export function unitsWhere(
  answers: Answers,
  fieldId: string,
  test: (values: readonly string[]) => boolean,
): readonly UnitId[] {
  return selectedUnits(answers).filter((unit) => {
    const values = unitValues(answers, fieldId, unit)
    return values.length > 0 && test(values)
  })
}

/**
 * Agrupa uma pergunta por unidade pela resposta:
 * "Vapor em todas as unidades; Óxido de etileno em São Luís".
 */
export function groupByAnswer(answers: Answers, fieldId: string): string {
  const units = selectedUnits(answers)
  const groups = new Map<string, UnitId[]>()
  for (const unit of units) {
    for (const value of unitValues(answers, fieldId, unit)) {
      const label = choiceLabel(fieldId, value)
      groups.set(label, [...(groups.get(label) ?? []), unit])
    }
  }
  return [...groups]
    .map(([label, where]) =>
      where.length === units.length && units.length > 1 ? `${label} em todas as unidades` : `${label} em ${joinPt(where.map(nameOf))}`,
    )
    .join('; ')
}
