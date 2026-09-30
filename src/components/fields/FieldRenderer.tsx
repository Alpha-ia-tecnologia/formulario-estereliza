import { useCallback } from 'react'
import type { AnswerUpdate, AnswerValue, Answers, Field } from '../../form/types'
import { ChoiceField } from './ChoiceField'
import { DocumentsField } from './DocumentsField'
import { NumberGrid, NumberInput, PersonInputs, RankedInputs, TextInput } from './InputFields'
import { MatrixField } from './MatrixField'
import { PerUnitField } from './PerUnitField'

type FieldInputProps = {
  readonly field: Field
  readonly value: AnswerValue | undefined
  readonly answers: Answers
  readonly labelledBy: string
  readonly onChange: (update: AnswerUpdate) => void
}

/** O controle de um valor, conforme o tipo do campo. */
export function FieldInput({ field, value, answers, labelledBy, onChange }: FieldInputProps) {
  const common = { value, labelledBy, onChange }
  switch (field.kind) {
    case 'single':
    case 'multi':
      return <ChoiceField field={field} answers={answers} {...common} />
    case 'text':
      return <TextInput field={field} {...common} />
    case 'number':
      return <NumberInput field={field} {...common} />
    case 'numberGrid':
      return <NumberGrid field={field} {...common} />
    case 'ranked':
      return <RankedInputs field={field} answers={answers} {...common} />
    case 'person':
      return <PersonInputs field={field} answers={answers} {...common} />
    case 'matrix':
      return <MatrixField field={field} {...common} />
    case 'documents':
      return <DocumentsField field={field} {...common} />
  }
}

type FieldRendererProps = {
  readonly field: Field
  readonly answers: Answers
  readonly labelledBy: string
  readonly onChange: (id: string, update: AnswerUpdate) => void
}

export function FieldRenderer({ field, answers, labelledBy, onChange }: FieldRendererProps) {
  // Identidade estável: efeitos dos campos não disparam a cada tecla em outra pergunta.
  const change = useCallback((update: AnswerUpdate) => onChange(field.id, update), [onChange, field.id])
  if (field.perUnit) return <PerUnitField field={field} answers={answers} labelledBy={labelledBy} onChange={onChange} />
  return <FieldInput field={field} value={answers[field.id]} answers={answers} labelledBy={labelledBy} onChange={change} />
}
