import { CYCLE_EQUIPMENT, HIGH_PRIORITY_SOFT_LIMIT, SHARED_ITEMS, WORKSTATIONS, isHospitalUnit, selectedUnits } from './options'
import { blockCompletion, missingRequired, visibleBlocks } from './progress'
import { joinPt, nameOf, recordOf, textLines, textOf, unitsWhere } from './read'
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

const alert = (text: string): AttentionPoint => ({ tone: 'alert', text })
const info = (text: string): AttentionPoint => ({ tone: 'info', text })
const names = (units: readonly UnitId[]) => joinPt(units.map(nameOf))

const missingRespondent: Rule = (answers) =>
  missingRequired(answers).length > 0 ? alert('Falta informar quem respondeu — sem isso o pacote não pode ser gerado.') : null

const offline: Rule = (answers) => {
  const units = unitsWhere(answers, '2.7', (values) => values.includes('offline'))
  return units.length > 0
    ? alert(`Sem internet boa parte do tempo em ${names(units)}: a operação offline será a regra, com sincronização ao reconectar.`)
    : null
}

const unstable: Rule = (answers) => {
  const units = unitsWhere(answers, '2.7', (values) => values.includes('instavel'))
  return units.length > 0 ? alert(`Internet instável em ${names(units)}: o sistema deve tolerar quedas sem perder registros.`) : null
}

const longOutages: Rule = (answers) =>
  answers['2.13.tempo'] === 'dias'
    ? alert('Unidades chegam a ficar mais de 1 dia sem internet: o modo offline precisa guardar dias de trabalho antes de sincronizar.')
    : null

/** O que as unidades dentro de hospitais precisam no novo sistema, quando a Steriliza já respondeu. */
const hospitalUnits: Rule = (answers) => {
  const units = selectedUnits(answers).filter(isHospitalUnit)
  if (units.length === 0) return null
  const flow = answers['7.8.fluxo']
  if (flow === 'mesmo-fluxo') return info(`Unidades dentro de hospitais (${names(units)}) seguem o mesmo fluxo das unidades próprias.`)
  if (flow !== 'fluxo-proprio') return null
  const what = textLines(answers, '7.8.fluxo.oque')
  return info(`Unidades dentro de hospitais (${names(units)}) precisam de um fluxo próprio${what ? ` (${what})` : ''}.`)
}

const tooManyHigh: Rule = (answers) => {
  const high = Object.values(recordOf(answers, 'modulos')).filter((level) => level === 'alta').length
  return high > HIGH_PRIORITY_SOFT_LIMIT ? alert(`${high} módulos em prioridade alta — vale escalonar a primeira entrega.`) : null
}

const undecidedSharing: Rule = (answers) => {
  const record = recordOf(answers, '7.1')
  const items = SHARED_ITEMS.filter((item) => record[item.key] === 'nao-sei').map((item) => item.label)
  return items.length > 0 ? alert(`Definir se são comuns ou por unidade: ${joinPt(items)}.`) : null
}

const cycleExport: Rule = (answers) => {
  const record = recordOf(answers, '2.5.registro')
  const onPaper = CYCLE_EQUIPMENT.filter((item) => record[item.key] === 'impressao' || record[item.key] === 'manual').map((item) => item.label)
  return onPaper.length > 0
    ? info(`Registro de ciclo só em papel (${joinPt(onPaper)}): será digitado ou integrado com o fabricante.`)
    : null
}

const paperWorkstations: Rule = (answers) => {
  const record = recordOf(answers, '2.6.postos')
  const onPaper = WORKSTATIONS.filter((item) => record[item.key] === 'papel').map((item) => item.label)
  return onPaper.length > 0 ? info(`Postos que ainda registram só em papel (${joinPt(onPaper)}): prever computador, leitor ou celular.`) : null
}

const availability: Rule = (answers) =>
  answers['2.10'] === 'minutos' ? alert('A operação não pode parar nem por minutos: o sistema precisa de contingência e alta disponibilidade.') : null

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

const blanks: Rule = (answers) => {
  const perSection = SECTIONS.map((section) => ({
    title: section.title,
    blank: visibleBlocks(section, answers).filter((block) => blockCompletion(block, answers) === 0).length,
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
  longOutages,
  hospitalUnits,
  availability,
  tooManyHigh,
  undecidedSharing,
  cycleExport,
  paperWorkstations,
  patientTrace,
  crossUnitMaterial,
  sharedClients,
  billingEntity,
  newUnits,
  blanks,
]

/** Pontos de atenção, com os alertas antes das observações. */
export function attentionPoints(answers: Answers, today: Date): readonly AttentionPoint[] {
  const points = RULES.map((rule) => rule(answers, today)).filter((point): point is AttentionPoint => point !== null)
  return [...points.filter((point) => point.tone === 'alert'), ...points.filter((point) => point.tone === 'info')]
}
