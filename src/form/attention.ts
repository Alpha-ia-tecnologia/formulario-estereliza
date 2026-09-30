import { formatDateBR, parseIsoDate } from './format'
import { DOCUMENTS, HIGH_PRIORITY_SOFT_LIMIT, SHARED_ITEMS } from './options'
import { blockCompletion, missingRequired } from './progress'
import { cityOf, joinPt, listOf, recordOf, textLines, textOf, unitsWhere } from './read'
import { SECTIONS } from './schema'
import type { Answers, UnitId } from './types'

/**
 * Pontos de atenção da síntese: riscos e decisões em aberto ("alert") e
 * implicações para o projeto ("info"), deduzidos só das respostas.
 */
export type AttentionTone = 'alert' | 'info'

export interface AttentionPoint {
  readonly tone: AttentionTone
  readonly text: string
}

type Rule = (answers: Answers, today: Date) => AttentionPoint | null

/** Prazos até este número de dias entram como alerta. */
export const DEADLINE_WARNING_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

const alert = (text: string): AttentionPoint => ({ tone: 'alert', text })
const info = (text: string): AttentionPoint => ({ tone: 'info', text })
const cities = (units: readonly UnitId[]) => joinPt(units.map(cityOf))

const missingRespondent: Rule = (answers) =>
  missingRequired(answers).length > 0 ? alert('Falta informar quem respondeu — sem isso o pacote não pode ser gerado.') : null

const offline: Rule = (answers) => {
  const units = unitsWhere(answers, '2.7', (values) => values.includes('offline'))
  return units.length > 0 ? alert(`Precisa funcionar sem internet em ${cities(units)}: prever operação offline com sincronização.`) : null
}

const unstable: Rule = (answers) => {
  const units = unitsWhere(answers, '2.7', (values) => values.includes('instavel'))
  return units.length > 0 ? alert(`Internet instável em ${cities(units)}: o sistema deve tolerar quedas sem perder registros.`) : null
}

const tooManyHigh: Rule = (answers) => {
  const high = Object.values(recordOf(answers, 'modulos')).filter((level) => level === 'alta').length
  return high > HIGH_PRIORITY_SOFT_LIMIT ? alert(`${high} módulos em prioridade alta — vale escalonar a primeira entrega.`) : null
}

const deadline: Rule = (answers, today) => {
  if (answers['8.3'] !== 'sim') return null
  const date = textOf(answers, '8.3.data')
  const target = parseIsoDate(date)
  if (!target) return alert('Há prazo, mas falta a data — complete a pergunta 8.3.')
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((target.getTime() - start.getTime()) / DAY_MS)
  if (days < 0) return alert(`A data informada (${formatDateBR(date)}) já passou — confirme o prazo.`)
  if (days > DEADLINE_WARNING_DAYS) return null
  const reason = textOf(answers, '8.3.motivo')
  return alert(`Prazo em ${days} ${days === 1 ? 'dia' : 'dias'}, em ${formatDateBR(date)}${reason ? ` (${reason})` : ''}.`)
}

const undecidedSharing: Rule = (answers) => {
  const record = recordOf(answers, '7.1')
  const items = SHARED_ITEMS.filter((item) => record[item.key] === 'nao-sei').map((item) => item.label)
  return items.length > 0 ? alert(`Definir se são comuns ou por unidade: ${joinPt(items)}.`) : null
}

const cycleExport: Rule = (answers) =>
  answers['2.5'] === 'impressao' || answers['2.5'] === 'nao'
    ? info('Os esterilizadores não exportam dados dos ciclos: registro digitado ou integração com o fabricante.')
    : null

/** Equipamentos que a rastreabilidade por etiqueta pressupõe. */
const TRACEABILITY_EQUIPMENT = [
  { value: 'leitor', label: 'leitor de código de barras' },
  { value: 'impressora', label: 'impressora de etiquetas' },
] as const

const equipment: Rule = (answers) => {
  const available = listOf(answers, '2.6')
  if (available.length === 0) return null
  const missing = TRACEABILITY_EQUIPMENT.filter(({ value }) => !available.includes(value)).map(({ label }) => label)
  return missing.length > 0 ? info(`Equipamentos a providenciar: ${joinPt(missing)}.`) : null
}

const patientTrace: Rule = (answers) => {
  if (answers['3.1'] !== 'paciente') return null
  const systems = textLines(answers, '3.1.sistemas')
  return info(`Rastreabilidade até o paciente depende de integração com os sistemas dos clientes${systems ? ` (${systems})` : ''}.`)
}

const crossUnitMaterial: Rule = (answers) =>
  answers['7.5'] === 'sim' ? info('Há material processado em outra unidade: o sistema precisa registrar transferências entre unidades.') : null

const sharedClients: Rule = (answers) =>
  answers['7.4'] === 'sim' ? info('Clientes atendidos por mais de uma unidade: o cadastro de clientes deve ser compartilhado.') : null

const billingEntity: Rule = (answers) => {
  if (answers['7.6'] === 'todas') return info('Cada unidade emite nota com CNPJ próprio: faturamento e medição separados por unidade.')
  if (answers['7.6'] === 'depende') return info('O CNPJ de faturamento varia por unidade: o sistema precisa aceitar os dois modelos.')
  return null
}

const newUnits: Rule = (answers) => {
  const plan = answers['7.7']
  if (plan !== 'proximo-ano' && plan !== 'sem-data') return null
  const where = textOf(answers, '7.7.onde')
  return info(`Novas unidades previstas${where ? ` (${where})` : ''}: incluir uma unidade nova no sistema deve ser simples.`)
}

const documentsLater: Rule = (answers) => {
  const record = recordOf(answers, 'documentos')
  const later = DOCUMENTS.filter((doc) => record[doc.key] === 'depois').map((doc) => doc.label)
  return later.length > 0 ? info(`Documentos a enviar depois: ${joinPt(later)}.`) : null
}

const blanks: Rule = (answers) => {
  const perSection = SECTIONS.map((section) => ({
    title: section.title,
    blank: section.blocks.filter((block) => blockCompletion(block, answers) === 0).length,
  }))
  const total = perSection.reduce((sum, section) => sum + section.blank, 0)
  if (total === 0) return null
  const worst = perSection.reduce((most, section) => (section.blank > most.blank ? section : most))
  const noun = total === 1 ? 'pergunta' : 'perguntas'
  return info(`${total} ${noun} em branco; a etapa com mais lacunas é "${worst.title}".`)
}

const RULES: readonly Rule[] = [
  missingRespondent,
  offline,
  unstable,
  tooManyHigh,
  deadline,
  undecidedSharing,
  cycleExport,
  equipment,
  patientTrace,
  crossUnitMaterial,
  sharedClients,
  billingEntity,
  newUnits,
  documentsLater,
  blanks,
]

/** Pontos de atenção, com os alertas antes das observações. */
export function attentionPoints(answers: Answers, today: Date): readonly AttentionPoint[] {
  const points = RULES.map((rule) => rule(answers, today)).filter((point): point is AttentionPoint => point !== null)
  return [...points.filter((point) => point.tone === 'alert'), ...points.filter((point) => point.tone === 'info')]
}
