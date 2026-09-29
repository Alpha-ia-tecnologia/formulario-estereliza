import { isRecord } from '../../form/progress'
import type { AnswerValue, MatrixField as MatrixFieldType } from '../../form/types'
import { AlertIcon } from '../Icons'

type MatrixFieldProps = {
  readonly field: MatrixFieldType
  readonly value: AnswerValue | undefined
  readonly labelledBy: string
  readonly onChange: (value: AnswerValue | undefined) => void
}

type Tone = 'strong' | 'soft' | 'neutral' | 'muted'

/** Primeiro nível em destaque, o segundo suave e o último (em escalas longas) apagado. */
function toneOf(index: number, count: number): Tone {
  if (index === 0) return 'strong'
  if (index === 1) return 'soft'
  return index === count - 1 && count > 3 ? 'muted' : 'neutral'
}

/**
 * Matriz item × nível com um controle segmentado por linha — usada nas
 * prioridades dos módulos e no que é comum ou separado por unidade.
 */
export function MatrixField({ field, value, labelledBy, onChange }: MatrixFieldProps) {
  const record = isRecord(value) ? value : {}
  const levels = field.levels.map((level, index) => ({
    ...level,
    tone: toneOf(index, field.levels.length),
    count: field.items.filter((item) => record[item.key] === level.value).length,
  }))
  const pending = field.items.length - levels.reduce((sum, level) => sum + level.count, 0)
  const warnCount = field.warn ? (levels.find((level) => level.value === field.warn?.level)?.count ?? 0) : 0
  const isOverLimit = field.warn !== undefined && warnCount > field.warn.max
  const toneByValue = new Map(levels.map((level) => [level.value, level.tone]))

  return (
    <div className="matrix" role="group" aria-labelledby={labelledBy}>
      <div className="matrix__summary" aria-live="polite">
        {levels.map((level) => (
          <span key={level.value} className="matrix__tally" data-tone={level.tone}>
            <strong>{level.count}</strong> {level.label}
          </span>
        ))}
        <span className="matrix__tally" data-tone="pendente">
          <strong>{pending}</strong> sem resposta
        </span>
      </div>

      {isOverLimit && field.warn && (
        <p className="notice notice--warning" role="status">
          <AlertIcon width={18} height={18} />
          <span>{field.warn.message(warnCount)}</span>
        </p>
      )}

      <ul className="matrix__list">
        {field.items.map((item) => {
          const groupId = `${field.id}-${item.key}`
          const current = record[item.key]
          return (
            <li key={item.key} className="matrix__row" data-tone={(current && toneByValue.get(current)) ?? 'pendente'}>
              <div className="matrix__item">
                <span id={groupId} className="matrix__name">
                  {item.label}
                </span>
                {item.description && <span className="matrix__description">{item.description}</span>}
              </div>
              <div className="segmented" role="radiogroup" aria-labelledby={groupId} data-count={levels.length}>
                {levels.map((level) => (
                  <label key={level.value} className="segmented__option" data-tone={level.tone} title={level.hint}>
                    <input
                      className="segmented__input"
                      type="radio"
                      name={groupId}
                      value={level.value}
                      checked={current === level.value}
                      onChange={() => onChange({ ...record, [item.key]: level.value })}
                    />
                    <span className="segmented__label">{level.label}</span>
                  </label>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
