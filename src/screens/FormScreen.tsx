import { useEffect, useRef, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { ArrowIcon, CheckIcon, MenuIcon } from '../components/Icons'
import { QuestionBlock, blockAnchor } from '../components/QuestionBlock'
import { SectionRail } from '../components/SectionRail'
import type { DraftApi } from '../draft/useDraft'
import { sectionCounter, sectionProgress } from '../form/progress'
import { SECTIONS, getSection, sectionIndex } from '../form/schema'

interface FormScreenProps {
  readonly sectionId: string
  readonly draft: DraftApi
  readonly focusBlockId: string | null
  readonly onFocusHandled: () => void
  readonly goToSection: (sectionId: string) => void
  readonly goToReview: () => void
  readonly goHome: () => void
}

export function FormScreen({ sectionId, draft, focusBlockId, onFocusHandled, goToSection, goToReview, goHome }: FormScreenProps) {
  const section = getSection(sectionId) ?? SECTIONS[0]!
  const index = sectionIndex(section.id)
  const previous = SECTIONS[index - 1]
  const next = SECTIONS[index + 1]
  const answers = draft.draft.answers
  const counter = sectionCounter(section, answers)
  const isComplete = sectionProgress(section, answers).ratio >= 1
  const [railOpen, setRailOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { setLastSection } = draft

  useEffect(() => {
    setLastSection(section.id)
  }, [section.id, setLastSection])

  const focusBlockRef = useRef(focusBlockId)
  focusBlockRef.current = focusBlockId

  // Ao trocar de etapa, leva o foco à pergunta pedida na revisão ou, senão, ao
  // título da etapa (assim leitores de tela anunciam onde a pessoa está).
  useEffect(() => {
    const blockId = focusBlockRef.current
    const target = blockId ? document.getElementById(blockAnchor(blockId)) : null
    if (target) {
      target.scrollIntoView({ block: 'start' })
      target.focus({ preventScroll: true })
      onFocusHandled()
      return
    }
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [section.id, onFocusHandled])

  useEffect(() => {
    if (!railOpen) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setRailOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [railOpen])

  const select = (id: string) => {
    setRailOpen(false)
    goToSection(id)
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#conteudo" onClick={(event) => {
        event.preventDefault()
        headingRef.current?.focus()
      }}>
        Pular para as perguntas
      </a>
      <AppHeader save={draft.save} onHome={goHome}>
        <button type="button" className="button button--outline button--small app-header__review" onClick={goToReview}>
          Revisar e enviar
        </button>
        <button type="button" className="button button--ghost button--small app-header__menu" onClick={() => setRailOpen(true)}>
          <MenuIcon width={20} height={20} />
          <span>Etapas</span>
        </button>
      </AppHeader>

      <div className="shell__body">
        <SectionRail
          answers={answers}
          currentId={section.id}
          open={railOpen}
          onSelect={select}
          onReview={goToReview}
          onClose={() => setRailOpen(false)}
        />

        <main id="conteudo" className="stage">
          <div className="stage__mobile-progress" aria-hidden>
            <div className="progress-track">
              <span className="progress-fill" style={{ transform: `scaleX(${(index + 1) / SECTIONS.length})` }} />
            </div>
          </div>

          <header className="stage__header" key={section.id}>
            <p className="eyebrow">
              Etapa {index + 1} de {SECTIONS.length}
              <span className="stage__count"> · {counter.done} de {counter.total} {counter.noun}</span>
            </p>
            <h1 ref={headingRef} className="stage__title accent-title" tabIndex={-1}>
              {section.number && <span className="stage__number">{section.number}.</span>} {section.title}
            </h1>
            <p className="stage__intro">{section.intro}</p>
            {section.id === 'identificacao' && (
              <p className="stage__note">Um formulário para todas as unidades. O que não se aplicar pode ficar em branco — tudo é salvo automaticamente.</p>
            )}
          </header>

          <div className="questions" key={`q-${section.id}`}>
            {section.blocks.map((block) => (
              <QuestionBlock key={block.id} block={block} answers={answers} onChange={draft.setAnswer} />
            ))}
          </div>

          <nav className="step-nav" aria-label="Navegação entre etapas">
            {previous ? (
              <button type="button" className="button button--ghost" onClick={() => goToSection(previous.id)}>
                <ArrowIcon direction="left" width={20} height={14} />
                <span>Anterior</span>
              </button>
            ) : (
              <button type="button" className="button button--ghost" onClick={goHome}>
                <ArrowIcon direction="left" width={20} height={14} />
                <span>Início</span>
              </button>
            )}
            {isComplete && (
              <span className="step-nav__done" role="status">
                <CheckIcon width={14} height={14} />
                <span>Etapa completa</span>
              </span>
            )}
            {next ? (
              <button type="button" className="button button--primary step-nav__next" onClick={() => goToSection(next.id)}>
                <span>
                  <span className="step-nav__hint">Próxima etapa</span>
                  <span className="step-nav__target">{next.title}</span>
                </span>
                <span className="arrow-circle"><ArrowIcon /></span>
              </button>
            ) : (
              <button type="button" className="button button--primary step-nav__next" onClick={goToReview}>
                <span>
                  <span className="step-nav__hint">Tudo pronto?</span>
                  <span className="step-nav__target">Revisar e enviar</span>
                </span>
                <span className="arrow-circle"><ArrowIcon /></span>
              </button>
            )}
          </nav>
        </main>
      </div>
    </div>
  )
}
