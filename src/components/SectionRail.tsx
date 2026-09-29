import { overallProgress, sectionCounter, sectionProgress } from '../form/progress'
import { SECTIONS } from '../form/schema'
import type { Answers } from '../form/types'
import { CheckIcon, CloseIcon } from './Icons'

interface SectionRailProps {
  readonly answers: Answers
  readonly currentId: string
  readonly open: boolean
  readonly onSelect: (sectionId: string) => void
  readonly onReview: () => void
  readonly onClose: () => void
}

const percent = (ratio: number) => Math.round(ratio * 100)

/** Lista de etapas com o progresso de cada uma. No celular vira uma gaveta. */
export function SectionRail({ answers, currentId, open, onSelect, onReview, onClose }: SectionRailProps) {
  const overall = overallProgress(answers)
  return (
    <>
      <div className="rail-backdrop" data-open={open} onClick={onClose} aria-hidden />
      <nav className="rail" data-open={open} aria-label="Etapas do formulário">
        <div className="rail__top">
          <p className="rail__percent">
            <strong>{percent(overall.ratio)}%</strong> <span>respondido</span>
          </p>
          <button type="button" className="rail__close button button--ghost button--small" onClick={onClose}>
            <CloseIcon width={18} height={18} />
            <span className="visually-hidden">Fechar etapas</span>
          </button>
        </div>
        <div className="progress-track" aria-hidden>
          <span className="progress-fill" style={{ transform: `scaleX(${overall.ratio})` }} />
        </div>
        <ol className="rail__list">
          {SECTIONS.map((section) => {
            const complete = sectionProgress(section, answers).ratio >= 1
            const counter = sectionCounter(section, answers)
            const current = section.id === currentId
            return (
              <li key={section.id}>
                <button
                  type="button"
                  className="rail__item"
                  data-current={current}
                  data-complete={complete}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onSelect(section.id)}
                >
                  <span className="rail__badge" aria-hidden>
                    {complete ? <CheckIcon width={14} height={14} /> : (section.number ?? '•')}
                  </span>
                  <span className="rail__label">
                    <span className="rail__name">{section.title}</span>{' '}
                    <span className="rail__count">
                      {counter.done} de {counter.total} {counter.noun}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" className="rail__review button button--outline" onClick={onReview}>
          Revisar e enviar
        </button>
      </nav>
    </>
  )
}
