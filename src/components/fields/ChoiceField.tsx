import { useEffect, useRef } from 'react'
import { OTHER_INPUT_VALUE, isOtherValue, makeOther, otherOption, otherText } from '../../form/other'
import { resolveOptions } from '../../form/progress'
import { MAX_TEXT_LENGTH } from '../../form/sanitize'
import type { AnswerValue, Answers, MultiField, SingleField } from '../../form/types'
import { CheckIcon } from '../Icons'

type ChoiceFieldProps = {
  readonly field: SingleField | MultiField
  readonly value: AnswerValue | undefined
  readonly answers: Answers
  readonly labelledBy: string
  readonly onChange: (value: AnswerValue | undefined) => void
}

/** Escolha única ou múltipla em "pílulas" tocáveis, com input nativo por baixo. */
export function ChoiceField({ field, value, answers, labelledBy, onChange }: ChoiceFieldProps) {
  const options = resolveOptions(field, answers)
  const single = field.kind === 'single'
  const selected: readonly string[] = single
    ? typeof value === 'string' ? [value] : []
    : Array.isArray(value) ? value : []
  const layout = field.kind === 'single' && field.layout === 'scale' ? 'scale' : 'chips'
  const selectedIndex = options.findIndex((option) => option.value === selected[0])
  const other = otherOption(field)
  const otherEntry = selected.find(isOtherValue)
  const isOtherChecked = otherEntry !== undefined
  const otherInput = useRef<HTMLInputElement>(null)
  const shouldFocusOther = useRef(false)

  // Leva o foco ao "Qual?" só quando a pessoa acabou de marcar "Outra".
  useEffect(() => {
    if (isOtherChecked && shouldFocusOther.current) otherInput.current?.focus()
    shouldFocusOther.current = false
  }, [isOtherChecked])

  const emit = (next: readonly string[]) => onChange(next.length > 0 ? next : undefined)

  const toggle = (optionValue: string) => {
    if (single) {
      onChange(optionValue)
      return
    }
    const picked = selected.includes(optionValue) ? selected.filter((item) => item !== optionValue) : [...selected, optionValue]
    // Mantém a ordem das opções e deixa "Outra" por último.
    emit([...options.map((option) => option.value).filter((item) => picked.includes(item)), ...picked.filter(isOtherValue)])
  }

  const toggleOther = () => {
    shouldFocusOther.current = !isOtherChecked
    if (single) {
      onChange(makeOther(''))
      return
    }
    emit(isOtherChecked ? selected.filter((item) => !isOtherValue(item)) : [...selected, makeOther('')])
  }

  const setOtherText = (text: string) => {
    if (single) onChange(makeOther(text))
    else emit(selected.map((item) => (isOtherValue(item) ? makeOther(text) : item)))
  }

  return (
    <div className="choice-field">
      <div role={single ? 'radiogroup' : 'group'} aria-labelledby={labelledBy} className={`choices choices--${layout}`}>
        {options.map((option, index) => {
          const checked = selected.includes(option.value)
          const included = layout === 'scale' && selectedIndex >= 0 && index <= selectedIndex
          return (
            <label key={option.value} className="choice" data-checked={checked} data-included={included}>
              <input
                className="choice__input"
                type={single ? 'radio' : 'checkbox'}
                name={field.id}
                value={option.value}
                checked={checked}
                onChange={() => toggle(option.value)}
              />
              <span className="choice__box" aria-hidden>
                <CheckIcon width={12} height={12} />
              </span>
              <span className="choice__text">
                <span className="choice__label">{option.label}</span>
                {option.hint && <span className="choice__hint">{option.hint}</span>}
              </span>
            </label>
          )
        })}
        {other && (
          <label className="choice choice--other" data-checked={isOtherChecked}>
            <input
              className="choice__input"
              type={single ? 'radio' : 'checkbox'}
              name={field.id}
              value={OTHER_INPUT_VALUE}
              checked={isOtherChecked}
              onChange={toggleOther}
            />
            <span className="choice__box" aria-hidden>
              <CheckIcon width={12} height={12} />
            </span>
            <span className="choice__text">
              <span className="choice__label">{other.label}</span>
            </span>
          </label>
        )}
      </div>
      {other && isOtherChecked && (
        <div className="choice-other">
          <input
            ref={otherInput}
            className="input"
            aria-label={`${other.label}: ${other.prompt}`}
            placeholder={other.prompt}
            maxLength={MAX_TEXT_LENGTH}
            value={otherText(otherEntry)}
            onChange={(event) => setOtherText(event.target.value)}
          />
        </div>
      )}
      {single && selected.length > 0 && (
        <button type="button" className="link-button choice-field__clear" onClick={() => onChange(undefined)}>
          Limpar escolha
        </button>
      )}
    </div>
  )
}
