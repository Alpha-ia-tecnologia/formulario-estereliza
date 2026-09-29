import type { MultiField, Option, SingleField } from './types'

/**
 * Resposta "Outra" em campos de escolha. O texto fica no próprio valor, como
 * "outra:<texto>", para funcionar com qualquer chave — inclusive por unidade —
 * sem precisar de um campo companheiro.
 */
const OTHER_PREFIX = 'outra:'

/** Valor do input de rádio/checkbox da opção "Outra". */
export const OTHER_INPUT_VALUE = 'outra'

export const isOtherValue = (value: string): boolean => value.startsWith(OTHER_PREFIX)

export const otherText = (value: string): string => (isOtherValue(value) ? value.slice(OTHER_PREFIX.length) : '')

export const makeOther = (text: string): string => `${OTHER_PREFIX}${text}`

export interface ResolvedOther {
  readonly label: string
  readonly prompt: string
}

export function otherOption(field: SingleField | MultiField): ResolvedOther | null {
  if (!field.other) return null
  const custom = field.other === true ? {} : field.other
  return { label: custom.label ?? 'Outra', prompt: custom.prompt ?? 'Qual?' }
}

/** Rótulo legível de um valor de escolha, inclusive "Outra: texto". */
export function optionLabel(field: SingleField | MultiField, options: readonly Option[], value: string): string {
  if (isOtherValue(value)) {
    const label = otherOption(field)?.label ?? 'Outra'
    const text = otherText(value).trim()
    return text ? `${label}: ${text}` : label
  }
  return options.find((option) => option.value === value)?.label ?? value
}
