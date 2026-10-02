import { useState } from 'react'
import logo from '../assets/logo-steriliza.png'
import { AppHeader } from '../components/AppHeader'
import { AlertIcon, ArrowIcon } from '../components/Icons'
import { ReviewList } from '../components/ReviewList'
import { SendPanel } from '../components/SendPanel'
import { SynthesisPanel } from '../components/SynthesisPanel'
import { useAttachments } from '../draft/AttachmentsContext'
import type { DraftApi } from '../draft/useDraft'
import { summarize } from '../form/format'
import { selectedUnits, unitLabel } from '../form/options'
import { missingRequired, overallProgress, pruneHidden } from '../form/progress'
import { prefersReducedMotion } from '../lib/transition'
import { useApi } from '../lib/useApi'

/** Leva à síntese e põe o foco nela, para o teclado e o leitor de tela seguirem o salto. */
function showSynthesis() {
  const target = document.getElementById('sintese')
  target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  target?.focus({ preventScroll: true })
}

type ReviewScreenProps = {
  readonly draft: DraftApi
  readonly goToSection: (sectionId: string, blockId?: string) => void
  readonly goHome: () => void
}

export function ReviewScreen({ draft, goToSection, goHome }: ReviewScreenProps) {
  const [isOnlyBlank, setIsOnlyBlank] = useState(false)
  const attachments = useAttachments()
  const api = useApi()
  // A revisão mostra só o que vale: sem campos ocultos nem opções escondidas por outras respostas.
  const answers = pruneHidden(draft.draft.answers)
  const summary = summarize(answers)
  const percent = Math.round(overallProgress(answers).ratio * 100)
  const blocks = summary.flatMap((section) => section.blocks)
  const blankCount = blocks.filter((block) => !block.answered).length
  const isMissingRespondent = missingRequired(answers).length > 0
  const attachmentCount = attachments.items.length
  const unitsText = selectedUnits(answers).map(unitLabel).join(', ')

  return (
    <div className="shell shell--review">
      <AppHeader save={draft.save} onHome={goHome}>
        <button type="button" className="button button--ghost button--small" onClick={() => goToSection(draft.draft.lastSection)}>
          <ArrowIcon direction="left" width={18} height={13} />
          <span>Voltar ao formulário</span>
        </button>
      </AppHeader>

      <div className="review">
        <main className="review__main">
          <div className="print-header" aria-hidden>
            <img src={logo} alt="" width={150} height={20} />
            <span>Formulário de requisitos · Sistema multiunidade</span>
          </div>

          <header className="review__header">
            <p className="eyebrow">Última etapa</p>
            <h1 className="accent-title">Revise e envie</h1>
            <p className="stage__intro">
              Confira as respostas da Steriliza. Toque em qualquer pergunta para ajustar — você volta direto para ela.
            </p>
            <p className="review__units">
              <strong>Unidades atendidas:</strong> {unitsText}
            </p>
            <p className="review__jump">
              <button
                type="button"
                className="link-button"
                onClick={showSynthesis}
              >
                Ver a síntese no fim do relatório
              </button>
            </p>
          </header>

          <div className="review__stats">
            <p className="stat">
              <strong>{percent}%</strong> <span>respondido</span>
            </p>
            <p className="stat">
              <strong>{blocks.length - blankCount}</strong> <span>perguntas com resposta</span>
            </p>
            <p className="stat">
              <strong>{attachmentCount}</strong> <span>{attachmentCount === 1 ? 'anexo' : 'anexos'}</span>
            </p>
            {blankCount > 0 && (
              <label className="review__filter">
                <input type="checkbox" checked={isOnlyBlank} onChange={(event) => setIsOnlyBlank(event.target.checked)} />
                <span>Mostrar só as {blankCount} em branco</span>
              </label>
            )}
          </div>

          {isMissingRespondent && (
            <p className="notice notice--danger" role="alert">
              <AlertIcon width={18} height={18} />
              <span>
                Falta informar <strong>quem respondeu</strong> para gerar o pacote.{' '}
                <button type="button" className="link-button" onClick={() => goToSection('identificacao', 'ident.nome')}>
                  Preencher agora
                </button>
              </span>
            </p>
          )}

          <ReviewList summary={summary} isOnlyBlank={isOnlyBlank} onEdit={goToSection} />

          <SynthesisPanel answers={answers} />
        </main>

        <SendPanel answers={answers} attachments={attachments.items} canExport={!isMissingRespondent && !attachments.loading} api={api} />
      </div>
    </div>
  )
}
