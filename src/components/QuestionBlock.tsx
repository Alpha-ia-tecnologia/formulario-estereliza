import { blockCompletion, visibleFields } from '../form/progress'
import type { AnswerUpdate, Answers, Block } from '../form/types'
import { CheckIcon } from './Icons'
import { FieldRenderer } from './fields/FieldRenderer'

interface QuestionBlockProps {
  readonly block: Block
  readonly answers: Answers
  readonly onChange: (id: string, update: AnswerUpdate) => void
}

export const blockAnchor = (blockId: string) => `pergunta-${blockId.replace(/\./g, '-')}`

/** Uma pergunta numerada, com título, ajuda e um ou mais campos. */
export function QuestionBlock({ block, answers, onChange }: QuestionBlockProps) {
  const anchor = blockAnchor(block.id)
  const titleId = `${anchor}-titulo`
  const fields = visibleFields(block, answers)
  const answered = blockCompletion(block, answers) > 0
  const required = block.fields.some((field) => field.kind === 'text' && field.required)
  const multiple = block.fields.length > 1

  return (
    <section id={anchor} className="question" data-answered={answered} aria-labelledby={titleId} tabIndex={-1}>
      <div className="question__number" aria-hidden>
        {block.number ?? (answered ? <CheckIcon width={14} height={14} /> : '•')}
        {answered && block.number && (
          <span className="question__tick">
            <CheckIcon width={10} height={10} />
          </span>
        )}
      </div>
      <div className="question__body">
        <h2 id={titleId} className="question__title">
          {block.number && <span className="visually-hidden">{block.number} </span>}
          {block.title}
          {required && <span className="question__required">obrigatório</span>}
        </h2>
        {block.help && <p className="question__help">{block.help}</p>}
        <div className="question__fields">
          {fields.map((field) => {
            const labelId = `${field.id}-rotulo`
            return (
              <div key={field.id} className="question__field" data-conditional={Boolean(field.when)}>
                {multiple && field.label && (
                  <p id={labelId} className="question__field-label">
                    {field.label}
                  </p>
                )}
                <FieldRenderer
                  field={field}
                  answers={answers}
                  labelledBy={multiple && field.label ? labelId : titleId}
                  onChange={onChange}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
