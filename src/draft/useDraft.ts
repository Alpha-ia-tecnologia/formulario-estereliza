import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnswerUpdate } from '../form/types'
import { type Draft, createDraft, loadDraft, saveDraft } from './storage'

export const SAVE_DELAY_MS = 400

export type SaveState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved'; readonly at: Date }
  | { readonly status: 'error' }

export interface DraftApi {
  readonly draft: Draft
  readonly save: SaveState
  setAnswer(id: string, update: AnswerUpdate): void
  setLastSection(sectionId: string): void
}

function withAnswer(draft: Draft, id: string, update: AnswerUpdate): Draft {
  const { [id]: previous, ...rest } = draft.answers
  const value = typeof update === 'function' ? update(previous) : update
  if (value === previous) return draft
  const answers = value === undefined ? rest : { ...rest, [id]: value }
  return { ...draft, answers, updatedAt: new Date().toISOString() }
}

/**
 * Estado do rascunho do formulário, gravado no navegador pouco depois de
 * cada alteração e também quando a página é fechada.
 */
export function useDraft(): DraftApi {
  const [draft, setDraft] = useState<Draft>(() => loadDraft() ?? createDraft())
  const [save, setSave] = useState<SaveState>({ status: 'idle' })
  const pending = useRef<Draft | null>(null)

  const flush = useCallback(() => {
    const next = pending.current
    if (!next) return
    pending.current = null
    try {
      saveDraft(next)
      setSave({ status: 'saved', at: new Date() })
    } catch {
      setSave({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    pending.current = draft
    const timer = window.setTimeout(flush, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draft, flush])

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  const setAnswer = useCallback((id: string, update: AnswerUpdate) => {
    setDraft((current) => withAnswer(current, id, update))
  }, [])

  const setLastSection = useCallback((sectionId: string) => {
    setDraft((current) => (current.lastSection === sectionId ? current : { ...current, lastSection: sectionId }))
  }, [])

  return { draft, save, setAnswer, setLastSection }
}
