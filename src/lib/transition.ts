import { flushSync } from 'react-dom'

/** Sentido da navegação, usado pelo CSS para deslizar a etapa nova. */
export type NavDirection = 'forward' | 'back' | 'none'

type ViewTransitionStarter = (update: () => void) => { readonly finished: Promise<void> }

/** Tempo para o CSS de fallback terminar a animação de entrada. */
const FALLBACK_MS = 500

export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Aplica uma mudança de tela com transição animada. Usa a View Transitions API
 * quando existe (a etapa antiga sai, a nova entra no sentido da navegação);
 * senão, marca o sentido em <html> para o CSS animar só a entrada.
 */
export function transition(direction: NavDirection, apply: () => void): void {
  const root = document.documentElement
  const start = (document as unknown as { startViewTransition?: ViewTransitionStarter }).startViewTransition
  const clear = () => {
    delete root.dataset.nav
  }

  if (prefersReducedMotion() || direction === 'none') {
    apply()
    return
  }
  root.dataset.nav = direction
  if (typeof start !== 'function') {
    apply()
    window.setTimeout(clear, FALLBACK_MS)
    return
  }
  start.call(document, () => flushSync(apply)).finished.finally(clear)
}
