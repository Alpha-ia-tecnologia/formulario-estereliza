import { useCallback, useEffect, useState } from 'react'
import { AttachmentsProvider } from './draft/AttachmentsContext'
import type { AttachmentStore } from './draft/attachments'
import { loadDraft } from './draft/storage'
import { useDraft } from './draft/useDraft'
import { SECTIONS, sectionIndex } from './form/schema'
import { FIRST_SECTION_ID, type Route, parseRoute, toHash } from './lib/route'
import { type NavDirection, transition } from './lib/transition'
import { FormScreen } from './screens/FormScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

type Navigate = (route: Route, direction?: NavDirection) => void

function useHashRoute(): [Route, Navigate] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))

  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const navigate = useCallback<Navigate>((next, direction = 'none') => {
    transition(direction, () => {
      const hash = toHash(next)
      if (window.location.hash !== hash) window.location.hash = hash
      setRoute(next)
    })
  }, [])

  return [route, navigate]
}

type WorkRoute = Exclude<Route, { name: 'welcome' }>

/** Posição de uma rota na sequência de etapas; a revisão vem depois da última. */
const stepOf = (route: WorkRoute): number => (route.name === 'review' ? SECTIONS.length : sectionIndex(route.sectionId))

/** Mantém o rascunho vivo enquanto a pessoa alterna entre etapas e revisão. */
function Workspace({ route, navigate }: { route: WorkRoute; navigate: Navigate }) {
  const draft = useDraft()
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null)
  const current = stepOf(route)

  const goToSection = useCallback(
    (sectionId: string, blockId?: string) => {
      setFocusBlockId(blockId ?? null)
      const target = sectionIndex(sectionId)
      navigate({ name: 'section', sectionId }, target === current ? 'none' : target > current ? 'forward' : 'back')
    },
    [navigate, current],
  )
  const goToReview = useCallback(() => navigate({ name: 'review' }, 'forward'), [navigate])
  const goHome = useCallback(() => navigate({ name: 'welcome' }, 'back'), [navigate])
  const clearFocus = useCallback(() => setFocusBlockId(null), [])

  if (route.name === 'review') {
    return <ReviewScreen draft={draft} goToSection={goToSection} goHome={goHome} />
  }
  return (
    <FormScreen
      sectionId={route.sectionId}
      draft={draft}
      focusBlockId={focusBlockId}
      onFocusHandled={clearFocus}
      goToSection={goToSection}
      goToReview={goToReview}
      goHome={goHome}
    />
  )
}

export function App({ attachmentStore }: { attachmentStore?: AttachmentStore }) {
  const [route, navigate] = useHashRoute()

  const start = useCallback(
    () => navigate({ name: 'section', sectionId: loadDraft()?.lastSection ?? FIRST_SECTION_ID }, 'forward'),
    [navigate],
  )
  const openReview = useCallback(() => navigate({ name: 'review' }, 'forward'), [navigate])

  return (
    <AttachmentsProvider store={attachmentStore}>
      {route.name === 'welcome' ? (
        <WelcomeScreen onStart={start} onImported={openReview} />
      ) : (
        <Workspace route={route} navigate={navigate} />
      )}
    </AttachmentsProvider>
  )
}
