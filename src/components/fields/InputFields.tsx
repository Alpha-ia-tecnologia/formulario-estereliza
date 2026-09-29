import { useState } from 'react'
import { isRecord } from '../../form/progress'
import { MAX_TEXT_LENGTH } from '../../form/sanitize'
import type {
  AnswerValue,
  Answers,
  NumberField,
  NumberGridField,
  PersonField,
  RankedField,
  TextField,
} from '../../form/types'
import { formatPhoneBR } from '../../lib/phone'
import { SparkIcon } from '../Icons'
import { SuggestionChips } from './SuggestionChips'

type Change = (value: AnswerValue | undefined) => void

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_DIGITS = 9

const asText = (value: AnswerValue | undefined) => (typeof value === 'string' ? value : '')
export const asRecord = (value: AnswerValue | undefined): Readonly<Record<string, string>> => (isRecord(value) ? value : {})
const orUndefined = (text: string) => (text === '' ? undefined : text)
export const onlyDigits = (text: string) => text.replace(/\D/g, '').slice(0, MAX_DIGITS)

/** Remove chaves vazias; devolve undefined quando nada sobra. */
export function compactRecord(record: Readonly<Record<string, string>>) {
  const entries = Object.entries(record).filter(([, entry]) => entry.trim() !== '')
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

interface BaseProps<F> {
  readonly field: F
  readonly value: AnswerValue | undefined
  readonly labelledBy: string
  readonly onChange: Change
}

export function TextInput({ field, value, answers, labelledBy, onChange }: BaseProps<TextField> & { answers: Answers }) {
  const [touched, setTouched] = useState(false)
  const text = asText(value)
  const invalidEmail = field.inputType === 'email' && touched && text !== '' && !EMAIL_PATTERN.test(text)
  const errorId = `${field.id}-erro`
  const suggestion = field.suggest?.(answers)
  const showSuggestion = suggestion && !text.includes(suggestion.value)
  const lines = text.split('\n').map((line) => line.trim())

  const handle = (next: string) => onChange(orUndefined(field.inputType === 'tel' ? formatPhoneBR(next) : next))

  // Chips: num campo de uma linha, o chip vira a resposta; num campo de várias
  // linhas, cada chip entra (ou sai) como uma linha, sem apagar o que foi digitado.
  const isChipActive = (item: string) => (field.multiline ? lines.includes(item) : text.trim() === item)
  const pickChip = (item: string) => {
    if (!field.multiline) {
      onChange(text.trim() === item ? undefined : item)
      return
    }
    const kept = lines.filter((line) => line !== '' && line !== item)
    onChange(orUndefined((lines.includes(item) ? kept : [...kept, item]).join('\n')))
  }

  const common = {
    id: field.id,
    className: `input${field.multiline ? ' input--area' : ''}`,
    value: text,
    placeholder: field.placeholder,
    maxLength: MAX_TEXT_LENGTH,
    'aria-labelledby': labelledBy,
    'aria-required': field.required || undefined,
    'aria-invalid': invalidEmail || undefined,
    'aria-describedby': invalidEmail ? errorId : undefined,
  }

  return (
    <div className="text-field">
      {field.multiline ? (
        <textarea {...common} rows={3} onChange={(event) => handle(event.target.value)} />
      ) : (
        <input
          {...common}
          type={field.inputType ?? 'text'}
          inputMode={field.inputType === 'tel' ? 'tel' : undefined}
          autoComplete={field.autoComplete}
          onChange={(event) => handle(event.target.value)}
          onBlur={() => setTouched(true)}
        />
      )}
      {invalidEmail && (
        <p id={errorId} className="field-error">
          Confira o e-mail: parece faltar algo (ex.: nome@empresa.com.br).
        </p>
      )}
      {field.suggestions && <SuggestionChips items={field.suggestions} isActive={isChipActive} onPick={pickChip} />}
      {showSuggestion && (
        <button
          type="button"
          className="suggestion"
          onClick={() => onChange(text.trim() === '' ? suggestion.value : `${text.trimEnd()}\n${suggestion.value}`)}
        >
          <SparkIcon width={16} height={16} />
          <span>{suggestion.label}</span>
        </button>
      )}
    </div>
  )
}

export function NumberInput({ field, value, labelledBy, onChange }: BaseProps<NumberField>) {
  return (
    <div className="number-field">
      <input
        id={field.id}
        className="input input--number"
        inputMode="numeric"
        value={asText(value)}
        placeholder={field.placeholder}
        aria-labelledby={labelledBy}
        onChange={(event) => onChange(orUndefined(onlyDigits(event.target.value)))}
      />
      {field.suffix && <span className="number-field__suffix">{field.suffix}</span>}
    </div>
  )
}

export function NumberGrid({ field, value, labelledBy, onChange }: BaseProps<NumberGridField>) {
  const record = asRecord(value)
  const total = field.items.reduce((sum, item) => sum + (Number(record[item.key]) || 0), 0)
  return (
    <div className="number-grid" role="group" aria-labelledby={labelledBy}>
      {field.items.map((item) => {
        const id = `${field.id}-${item.key}`
        return (
          <label key={item.key} className="number-grid__cell" htmlFor={id}>
            <span className="number-grid__label">{item.label}</span>
            <input
              id={id}
              className="input input--number"
              inputMode="numeric"
              placeholder="0"
              value={record[item.key] ?? ''}
              onChange={(event) => onChange(compactRecord({ ...record, [item.key]: onlyDigits(event.target.value) }))}
            />
          </label>
        )
      })}
      {field.totalLabel ? (
        <p className="number-grid__total" aria-live="polite">
          <span>{field.totalLabel}</span>
          <strong>
            {total} {field.suffix}
          </strong>
        </p>
      ) : (
        field.suffix && <p className="number-grid__suffix">Valores {field.suffix}</p>
      )}
    </div>
  )
}

export function RankedInputs({ field, value, labelledBy, onChange }: BaseProps<RankedField>) {
  const list = Array.isArray(value) ? value : []
  const slots = Array.from({ length: field.count }, (_, position) => list[position] ?? '')
  const commit = (next: readonly string[]) => onChange(next.some((item) => item.trim() !== '') ? next : undefined)
  const update = (index: number, text: string) => commit(slots.map((item, position) => (position === index ? text : item)))
  const isFull = slots.every((item) => item.trim() !== '')

  // Chips ocupam a primeira posição vazia; tocar de novo libera a posição.
  const positionOf = (item: string) => slots.findIndex((slot) => slot.trim() === item)
  const pickChip = (item: string) => {
    const taken = positionOf(item)
    if (taken >= 0) {
      update(taken, '')
      return
    }
    const empty = slots.findIndex((slot) => slot.trim() === '')
    if (empty >= 0) update(empty, item)
  }

  return (
    <div className="ranked-field">
    <ol className="ranked" aria-labelledby={labelledBy}>
      {Array.from({ length: field.count }, (_, index) => (
        <li key={index} className="ranked__row">
          <span className="ranked__number" aria-hidden>
            {index + 1}
          </span>
          <input
            className="input"
            aria-label={`Problema ${index + 1}`}
            value={slots[index]}
            placeholder={field.placeholders?.[index]}
            maxLength={MAX_TEXT_LENGTH}
            onChange={(event) => update(index, event.target.value)}
          />
        </li>
      ))}
    </ol>
      {field.suggestions && (
        <SuggestionChips
          items={field.suggestions}
          isActive={(item) => positionOf(item) >= 0}
          isDisabled={() => isFull}
          onPick={pickChip}
        />
      )}
    </div>
  )
}

export function PersonInputs({ field, value, answers, labelledBy, onChange }: BaseProps<PersonField> & { answers: Answers }) {
  const record = asRecord(value)
  const respondent = asText(answers['ident.nome']).trim()
  const respondentContact = [asText(answers['ident.email']), asText(answers['ident.telefone'])].filter(Boolean).join(' · ')
  const isRespondent = respondent !== '' && record.nome === respondent

  return (
    <div className="person" role="group" aria-labelledby={labelledBy}>
      <label className="person__cell">
        <span className="person__label">Nome</span>
        <input
          className="input"
          value={record.nome ?? ''}
          autoComplete="off"
          maxLength={MAX_TEXT_LENGTH}
          onChange={(event) => onChange(compactRecord({ ...record, nome: event.target.value }))}
        />
      </label>
      <label className="person__cell">
        <span className="person__label">Contato</span>
        <input
          className="input"
          value={record.contato ?? ''}
          placeholder="E-mail ou telefone"
          autoComplete="off"
          maxLength={MAX_TEXT_LENGTH}
          onChange={(event) => onChange(compactRecord({ ...record, contato: event.target.value }))}
        />
      </label>
      {field.canUseRespondent && respondent !== '' && !isRespondent && (
        <button
          type="button"
          className="suggestion suggestion--inline"
          onClick={() => onChange(compactRecord({ nome: respondent, contato: respondentContact }))}
        >
          <SparkIcon width={16} height={16} />
          <span>Sou eu ({respondent})</span>
        </button>
      )}
    </div>
  )
}
