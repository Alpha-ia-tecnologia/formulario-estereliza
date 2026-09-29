import { getUnit, selectedUnits, unitKey } from '../../form/options'
import type { AnswerUpdate, AnswerValue, Answers, Field, NumberGridField, UnitId } from '../../form/types'
import { SparkIcon } from '../Icons'
import { FieldInput } from './FieldRenderer'
import { asRecord, compactRecord, onlyDigits } from './InputFields'

type PerUnitFieldProps = {
  readonly field: Field
  readonly answers: Answers
  readonly labelledBy: string
  readonly onChange: (id: string, update: AnswerUpdate) => void
}

const sameValue = (a: AnswerValue | undefined, b: AnswerValue | undefined) => JSON.stringify(a) === JSON.stringify(b)

type NumberTableProps = {
  readonly field: NumberGridField
  readonly units: readonly UnitId[]
  readonly answers: Answers
  readonly labelledBy: string
  readonly onChange: (id: string, update: AnswerUpdate) => void
}

const sumOf = (record: Readonly<Record<string, string>>, keys: readonly string[]) =>
  keys.reduce((total, key) => total + (Number(record[key]) || 0), 0)

/** Números por unidade em tabela: unidades nas linhas, itens nas colunas e totais. */
function NumberTable({ field, units, answers, labelledBy, onChange }: NumberTableProps) {
  const itemKeys = field.items.map((item) => item.key)
  const records = units.map((unit) => ({ unit, key: unitKey(field.id, unit), record: asRecord(answers[unitKey(field.id, unit)]) }))
  const hasTotals = Boolean(field.totalLabel)
  const showFooter = hasTotals && units.length > 1

  return (
    <div className="number-table-wrap">
      <table className="number-table" aria-labelledby={labelledBy}>
        <thead>
          <tr>
            <th scope="col">Unidade</th>
            {field.items.map((item) => (
              <th key={item.key} scope="col">
                {item.label}
              </th>
            ))}
            {hasTotals && (
              <th scope="col" className="number-table__total">
                {field.totalLabel}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {records.map(({ unit, key, record }) => {
            const { city } = getUnit(unit)
            return (
              <tr key={unit}>
                <th scope="row">{city}</th>
                {field.items.map((item) => (
                  <td key={item.key}>
                    <input
                      className="input input--number input--cell"
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`${item.label} — ${city}`}
                      value={record[item.key] ?? ''}
                      onChange={(event) => onChange(key, compactRecord({ ...record, [item.key]: onlyDigits(event.target.value) }))}
                    />
                  </td>
                ))}
                {hasTotals && <td className="number-table__total">{sumOf(record, itemKeys)}</td>}
              </tr>
            )
          })}
        </tbody>
        {showFooter && (
          <tfoot>
            <tr>
              <th scope="row">Todas</th>
              {field.items.map((item) => (
                <td key={item.key}>{records.reduce((total, { record }) => total + (Number(record[item.key]) || 0), 0)}</td>
              ))}
              <td className="number-table__total">{records.reduce((total, { record }) => total + sumOf(record, itemKeys), 0)}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {field.suffix && <p className="number-grid__suffix">Valores {field.suffix}</p>}
    </div>
  )
}

/**
 * Pergunta respondida unidade por unidade. Cada unidade marcada na
 * identificação ganha uma linha, gravada na chave `${id}@${unidade}`.
 */
export function PerUnitField({ field, answers, labelledBy, onChange }: PerUnitFieldProps) {
  const units = selectedUnits(answers)
  if (field.kind === 'numberGrid') {
    return <NumberTable field={field} units={units} answers={answers} labelledBy={labelledBy} onChange={onChange} />
  }

  const [first, ...others] = units
  const firstValue = first ? answers[unitKey(field.id, first)] : undefined
  const isChoice = field.kind === 'single' || field.kind === 'multi'
  const canRepeat = isChoice && first !== undefined && firstValue !== undefined && others.some((unit) => !sameValue(answers[unitKey(field.id, unit)], firstValue))

  const repeatFirst = () => {
    for (const unit of others) onChange(unitKey(field.id, unit), firstValue)
  }

  return (
    <div className="unit-lanes" role="group" aria-labelledby={labelledBy}>
      {units.map((unit, index) => {
        const key = unitKey(field.id, unit)
        const laneId = `${key}-unidade`
        const { city, state } = getUnit(unit)
        return (
          <div key={unit} className="unit-lane" style={{ animationDelay: `${index * 45}ms` }}>
            <span id={laneId} className="unit-lane__name">
              {city} <span className="unit-lane__state">{state}</span>
            </span>
            <FieldInput
              field={{ ...field, id: key }}
              value={answers[key]}
              answers={answers}
              labelledBy={laneId}
              onChange={(update) => onChange(key, update)}
            />
          </div>
        )
      })}
      {canRepeat && first && (
        <button type="button" className="suggestion unit-lanes__repeat" onClick={repeatFirst}>
          <SparkIcon width={16} height={16} />
          <span>Repetir a resposta de {getUnit(first).city} nas demais unidades</span>
        </button>
      )}
    </div>
  )
}
