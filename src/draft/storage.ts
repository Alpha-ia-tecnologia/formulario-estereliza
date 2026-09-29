import { UNITS_FIELD_ID, UNIT_IDS } from '../form/options'
import { isRecord } from '../form/progress'
import { sanitizeAnswers } from '../form/sanitize'
import { SECTIONS } from '../form/schema'
import type { Answers } from '../form/types'
import { isoDay } from '../lib/files'

/** Rascunho único do formulário, que cobre todas as unidades. */
export interface Draft {
  readonly version: 2
  readonly answers: Answers
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastSection: string
}

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const DRAFT_KEY = 'steriliza-requisitos:v2'
const FIRST_SECTION_ID = SECTIONS[0]?.id ?? ''

const defaultStorage = (): DraftStorage => window.localStorage

export function createDraft(now: Date = new Date()): Draft {
  const timestamp = now.toISOString()
  return {
    version: 2,
    answers: { 'ident.data': isoDay(now), [UNITS_FIELD_ID]: [...UNIT_IDS] },
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSection: FIRST_SECTION_ID,
  }
}

export function loadDraft(storage: DraftStorage = defaultStorage()): Draft | null {
  try {
    const raw = storage.getItem(DRAFT_KEY)
    if (raw === null) return null
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data)) return null
    const value = data as Record<string, unknown>
    if (value.version !== 2) return null
    const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString()
    return {
      version: 2,
      answers: sanitizeAnswers(value.answers),
      createdAt,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
      lastSection: typeof value.lastSection === 'string' ? value.lastSection : FIRST_SECTION_ID,
    }
  } catch {
    // JSON corrompido ou armazenamento bloqueado: começa de um rascunho novo.
    return null
  }
}

/** Grava o rascunho. Lança erro se o navegador recusar (cota cheia, modo privado). */
export function saveDraft(draft: Draft, storage: DraftStorage = defaultStorage()): void {
  storage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function removeDraft(storage: DraftStorage = defaultStorage()): void {
  storage.removeItem(DRAFT_KEY)
}
