import type { SummaryBlock, SummarySection } from '../form/format'

type ReviewListProps = {
  readonly summary: readonly SummarySection[]
  readonly isOnlyBlank: boolean
  readonly onEdit: (sectionId: string, blockId?: string) => void
}

function Answer({ block }: { block: SummaryBlock }) {
  if (!block.answered) return <p className="review-item__blank">Em branco</p>
  return (
    <>
      {block.entries
        .filter((entry) => entry.text !== null)
        .map((entry) => (
          <p key={entry.label ?? 'resposta'} className="review-item__answer">
            {entry.label && <span className="review-item__label">{entry.label}: </span>}
            {entry.text}
          </p>
        ))}
    </>
  )
}

/** Respostas agrupadas por etapa; cada pergunta leva direto ao campo para editar. */
export function ReviewList({ summary, isOnlyBlank, onEdit }: ReviewListProps) {
  return (
    <>
      {summary.map((section) => {
        const blocks = isOnlyBlank ? section.blocks.filter((block) => !block.answered) : section.blocks
        if (blocks.length === 0) return null
        const headingId = `revisao-${section.id}`
        return (
          <section key={section.id} className="review-section" aria-labelledby={headingId}>
            <header className="review-section__header">
              <h2 id={headingId}>
                {section.number && <span className="review-section__number">{section.number}</span>}{' '}
                {section.title}
              </h2>
              <button type="button" className="link-button" onClick={() => onEdit(section.id)}>
                Editar etapa
              </button>
            </header>
            <dl className="review-list">
              {blocks.map((block) => (
                <div key={block.id} className="review-item" data-answered={block.answered}>
                  <dt>
                    <button type="button" className="review-item__question" onClick={() => onEdit(section.id, block.id)}>
                      {block.number && <span className="review-item__number">{block.number}</span>}{' '}
                      <span>{block.title}</span>
                    </button>
                  </dt>
                  <dd>
                    <Answer block={block} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </>
  )
}
