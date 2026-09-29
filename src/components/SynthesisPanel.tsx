import { useEffect, useMemo, useState } from 'react'
import { synthesisToText, synthesize } from '../form/synthesis'
import type { Answers } from '../form/types'
import { copyText } from '../lib/clipboard'
import { AlertIcon, CheckIcon, SparkIcon } from './Icons'

type CopyState = 'idle' | 'copied' | 'error'

type SynthesisPanelProps = {
  readonly answers: Answers
}

/** Tempo em que o botão mostra o resultado da cópia antes de voltar ao normal. */
export const COPY_FEEDBACK_MS = 3000

const COPY_LABEL: Readonly<Record<CopyState, string>> = {
  idle: 'Copiar síntese',
  copied: 'Síntese copiada',
  error: 'Não foi possível copiar',
}

const COPY_ICON = { idle: SparkIcon, copied: CheckIcon, error: AlertIcon } as const

/** Síntese no fim da revisão: abertura, números, pontos de atenção e resumo por tema. */
export function SynthesisPanel({ answers }: SynthesisPanelProps) {
  const synthesis = useMemo(() => synthesize(answers), [answers])
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const CopyIcon = COPY_ICON[copyState]

  useEffect(() => {
    if (copyState === 'idle') return undefined
    const timer = window.setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [copyState])

  const handleCopy = async () => {
    setCopyState((await copyText(synthesisToText(synthesis))) ? 'copied' : 'error')
  }

  return (
    <section id="sintese" className="synthesis" aria-labelledby="sintese-titulo" tabIndex={-1}>
      <header className="synthesis__header">
        <div>
          <p className="eyebrow">Gerada a partir das respostas</p>
          <h2 id="sintese-titulo" className="synthesis__title accent-title">
            Síntese
          </h2>
        </div>
        <button type="button" className="button button--outline button--small synthesis__copy" onClick={() => void handleCopy()}>
          <CopyIcon width={16} height={16} />
          {COPY_LABEL[copyState]}
        </button>
        <p className="visually-hidden" role="status">
          {copyState === 'idle' ? '' : COPY_LABEL[copyState]}
        </p>
      </header>

      <p className="synthesis__headline">{synthesis.headline}</p>

      <ul className="synthesis__metrics" aria-label="Números">
        {synthesis.metrics.map((metric) => (
          <li key={metric.label} className="metric">
            <strong className="metric__value">{metric.value}</strong>{' '}
            <span className="metric__label">{metric.label}</span>
            {metric.detail && <span className="metric__detail"> {metric.detail}</span>}
          </li>
        ))}
      </ul>

      {synthesis.attention.length > 0 && (
        <div className="synthesis__attention">
          <h3>Pontos de atenção</h3>
          <ul className="synthesis__list">
            {synthesis.attention.map((point) => (
              <li key={point.text} className="attention" data-tone={point.tone}>
                {point.tone === 'alert' ? <AlertIcon width={16} height={16} /> : <span className="attention__dot" aria-hidden />}
                <span>
                  {point.tone === 'alert' && <span className="visually-hidden">Atenção: </span>}
                  {point.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {synthesis.topics.length > 0 ? (
        <div className="synthesis__topics">
          {synthesis.topics.map((topic) => (
            <section key={topic.id} className="synthesis__topic" aria-labelledby={`sintese-${topic.id}`}>
              <h3 id={`sintese-${topic.id}`}>{topic.title}</h3>
              <ul className="synthesis__list">
                {topic.lines.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="synthesis__empty">Responda o formulário para ver aqui o resumo de cada tema.</p>
      )}
    </section>
  )
}
