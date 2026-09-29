import { REVIEW_STEP_ID, SECTIONS, getSection } from '../form/schema'

/**
 * Rotas em hash (#/etapa/<id>, #/revisao) para funcionar também quando o
 * arquivo é aberto direto do disco, sem servidor.
 */
export type Route =
  | { readonly name: 'welcome' }
  | { readonly name: 'section'; readonly sectionId: string }
  | { readonly name: 'review' }

const SECTION_PREFIX = 'etapa'
export const FIRST_SECTION_ID = SECTIONS[0]?.id ?? ''

export function parseRoute(hash: string): Route {
  const [prefix, step] = hash.replace(/^#\/?/, '').split('/')
  if (prefix === REVIEW_STEP_ID) return { name: 'review' }
  if (prefix !== SECTION_PREFIX) return { name: 'welcome' }
  return { name: 'section', sectionId: step && getSection(step) ? step : FIRST_SECTION_ID }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'welcome':
      return '#/'
    case 'section':
      return `#/${SECTION_PREFIX}/${route.sectionId}`
    case 'review':
      return `#/${REVIEW_STEP_ID}`
  }
}
