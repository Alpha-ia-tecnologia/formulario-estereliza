import { type AttentionPoint, attentionPoints } from './attention'
import { formatDateBR } from './format'
import { MODULES, PRIORITY_LEVELS, SHARING_LEVELS, SHARED_ITEMS, isUnitId, selectedUnits } from './options'
import { overallProgress, pruneHidden } from './progress'
import {
  choiceText,
  cityOf,
  groupByAnswer,
  joinPt,
  listOf,
  oneLine,
  recordOf,
  sumPerUnit,
  textLines,
  textOf,
  totalsByUnit,
} from './read'
import type { Answers, Item, Option } from './types'

/**
 * Síntese do formulário: abertura, números-chave, pontos de atenção e um
 * resumo por tema. É gerada das respostas, sem serviços externos, e aparece
 * no fim da revisão, do resumo.md e do respostas.json.
 */

export interface SynthesisMetric {
  readonly label: string
  readonly value: string
  readonly detail?: string
}

export interface SynthesisTopic {
  readonly id: string
  readonly title: string
  readonly lines: readonly string[]
}

export interface Synthesis {
  readonly headline: string
  readonly metrics: readonly SynthesisMetric[]
  readonly attention: readonly AttentionPoint[]
  readonly topics: readonly SynthesisTopic[]
}

type Line = string | null

const numberFormat = new Intl.NumberFormat('pt-BR')
const line = (label: string, value: string): Line => (value ? `${label}: ${value}` : null)
const when = (condition: boolean, text: string): Line => (condition ? text : null)

function headline(answers: Answers): string {
  const units = selectedUnits(answers)
  const name = textOf(answers, 'ident.nome')
  const role = textOf(answers, 'ident.cargo')
  const date = textOf(answers, 'ident.data')
  const percent = Math.round(overallProgress(answers).ratio * 100)
  const unitsText = `${units.length} ${units.length === 1 ? 'unidade' : 'unidades'} (${joinPt(units.map(cityOf))})`
  const by = name ? `, respondido por ${name}${role ? ` (${role})` : ''}` : ''
  const on = date ? ` em ${formatDateBR(date)}` : ''
  return `Levantamento de requisitos da Steriliza para ${unitsText}${by}${on}. ${percent}% do formulário preenchido.`
}

function metrics(answers: Answers): readonly SynthesisMetric[] {
  const units = selectedUnits(answers)
  const sums: ReadonlyArray<[string, ReturnType<typeof sumPerUnit>]> = [
    ['Funcionários', sumPerUnit(answers, '1.4')],
    ['Kits e itens por mês', sumPerUnit(answers, '1.2', 'itens')],
    ['Ciclos por mês', sumPerUnit(answers, '1.2', 'ciclos')],
    ['Clientes ativos', sumPerUnit(answers, '1.2', 'clientes')],
  ]
  const fromUnits = sums
    .filter(([, sum]) => sum.reported > 0)
    .map(([label, sum]): SynthesisMetric => {
      const partial = sum.reported < units.length ? `informado em ${sum.reported} de ${units.length} unidades` : undefined
      return partial ? { label, value: numberFormat.format(sum.total), detail: partial } : { label, value: numberFormat.format(sum.total) }
    })
  const priorities = recordOf(answers, 'modulos')
  const high = Object.values(priorities).filter((level) => level === 'alta').length
  const users = answers['6.3'] === 'nao-sei' ? '' : choiceText(answers, '6.3')
  return [
    { label: 'Preenchido', value: `${Math.round(overallProgress(answers).ratio * 100)}%` },
    { label: units.length === 1 ? 'Unidade' : 'Unidades', value: String(units.length) },
    ...fromUnits,
    ...(Object.keys(priorities).length > 0 ? [{ label: 'Módulos em prioridade alta', value: String(high), detail: `de ${MODULES.length}` }] : []),
    ...(users ? [{ label: 'Usuários simultâneos', value: users }] : []),
  ]
}

function strategy(answers: Answers): Line {
  switch (answers['2.3']) {
    case 'todos':
      return 'Estratégia: substituir todos os sistemas atuais'
    case 'alguns': {
      const which = choiceText(answers, '2.3.quais')
      return `Estratégia: substituir alguns sistemas${which ? ` (${which})` : ''}`
    }
    case 'integrar':
      return 'Estratégia: integrar com os sistemas atuais'
    default:
      return null
  }
}

const withDetail = (main: string, detail: string) => (main && detail ? `${main} — ${detail}` : main || detail)

function billing(answers: Answers): Line {
  const period = choiceText(answers, '4.5.periodicidade')
  const docs = choiceText(answers, '4.5.documentos')
  const main = [period, docs ? `com ${docs}` : ''].filter(Boolean).join(', ')
  return line('Faturamento', withDetail(main, textLines(answers, '4.5.obs')))
}

function publicClients(answers: Answers): Line {
  if (answers['4.6'] === 'nao') return 'Clientes públicos não exigem formato específico'
  if (answers['4.6'] !== 'sim') return null
  return line('Clientes públicos exigem', textLines(answers, '4.6.quais') || 'relatório ou formato específico')
}

const matrixLines = (answers: Answers, id: string, items: readonly Item[], levels: readonly Option[], prefix: (label: string) => string) => {
  const record = recordOf(answers, id)
  return levels.map((level) => line(prefix(level.label), joinPt(items.filter((item) => record[item.key] === level.value).map((item) => item.label))))
}

function person(answers: Answers, id: string): string {
  const record = recordOf(answers, id)
  return [record.nome?.trim(), record.contato?.trim()].filter(Boolean).join(' — ')
}

function ranked(answers: Answers): string {
  return listOf(answers, '8.1')
    .map((item, index) => ({ item: item.trim(), position: index + 1 }))
    .filter(({ item }) => item !== '')
    .map(({ item, position }) => `${position}) ${item}`)
    .join('; ')
}

function crossUnit(answers: Answers, id: string, detailId: string, text: string): Line {
  if (answers[id] !== 'sim') return null
  const detail = textLines(answers, detailId)
  return detail ? `${text}: ${detail}` : text
}

function release(answers: Answers): Line {
  const after = choiceText(answers, '3.4.apos')
  return line('Liberação de lote', [choiceText(answers, '3.4.quem'), after ? `após ${after.toLowerCase()}` : ''].filter(Boolean).join(', '))
}

function pilot(answers: Answers): Line {
  const value = answers['8.2']
  if (value === 'todas') return 'Implantação: todas as unidades juntas'
  if (value === 'a-definir') return 'Implantação: unidade piloto ainda não definida'
  // Uma unidade desmarcada depois de escolhida como piloto não vale mais.
  return isUnitId(value) && selectedUnits(answers).includes(value) ? `Implantação: começa por ${cityOf(value)}` : null
}

const TOPICS: ReadonlyArray<{ id: string; title: string; build: (answers: Answers) => readonly Line[] }> = [
  {
    id: 'operacao',
    title: 'Operação',
    build: (a) => [
      line('Métodos', choiceText(a, '1.1')),
      line('Horário', choiceText(a, '1.3')),
      line('Limpeza feita pela Steriliza', choiceText(a, '1.5')),
      line('Equipe por unidade', totalsByUnit(a, '1.4')),
      line('Diferenças entre unidades', textLines(a, '1.6')),
    ],
  },
  {
    id: 'sistemas',
    title: 'Sistemas e infraestrutura',
    build: (a) => [
      line('Sistemas em uso', choiceText(a, '2.1')),
      line('Funciona bem hoje', choiceText(a, '2.2.bem')),
      line('Mais incomoda hoje', choiceText(a, '2.2.incomoda')),
      line('Digitado em mais de um sistema', choiceText(a, '2.2.digitacao')),
      strategy(a),
      line('Migrar dos sistemas atuais', withDetail(choiceText(a, '2.3.migrar'), choiceText(a, '2.3.historico'))),
      line('Outros sistemas', withDetail(choiceText(a, '2.4'), textOf(a, '2.4.nomes'))),
      line('Exportação de ciclos', choiceText(a, '2.5')),
      line('Equipamentos', choiceText(a, '2.6')),
      line('Internet', groupByAnswer(a, '2.7')),
      line('Hospedagem preferida', choiceText(a, '2.8')),
    ],
  },
  {
    id: 'rastreabilidade',
    title: 'Rastreabilidade e qualidade',
    build: (a) => [
      line('Rastreabilidade até', withDetail(choiceText(a, '3.1'), textLines(a, '3.1.sistemas'))),
      line('Identificação hoje', choiceText(a, '3.2')),
      line('Indicadores', choiceText(a, '3.3')),
      release(a),
      line('Não conformidades e recolhimentos', choiceText(a, '3.5')),
      line('Mais pedidos em auditorias', choiceText(a, '3.6')),
      line('Guarda dos registros', choiceText(a, '3.7')),
    ],
  },
  {
    id: 'clientes',
    title: 'Clientes e faturamento',
    build: (a) => [
      line('Clientes', choiceText(a, '4.1')),
      line('Coleta e entrega', choiceText(a, '4.2')),
      line('Pedido de coleta', withDetail(choiceText(a, '4.3'), textLines(a, '4.3.detalhes'))),
      line('Cobrança por', choiceText(a, '4.4')),
      billing(a),
      publicClients(a),
    ],
  },
  {
    id: 'prioridades',
    title: 'Prioridades',
    build: (a) => [
      ...matrixLines(a, 'modulos', MODULES, PRIORITY_LEVELS, (label) => (label === 'Não precisa' ? 'Não precisa' : `Prioridade ${label.toLowerCase()}`)),
    ],
  },
  {
    id: 'acesso',
    title: 'Acesso e segurança',
    build: (a) => [
      line('Perfis', choiceText(a, '6.1')),
      line('Registro de quem executou', choiceText(a, '6.2')),
      line('Usuários ao mesmo tempo no pico', choiceText(a, '6.3')),
      line('Dados pessoais tratados', choiceText(a, '6.4')),
      line('Responsável pela LGPD', textOf(a, '6.4.responsavel')),
    ],
  },
  {
    id: 'multiunidade',
    title: 'Multiunidade',
    build: (a) => [
      ...matrixLines(a, '7.1', SHARED_ITEMS, SHARING_LEVELS, (label) => label),
      when(a['7.2'] === 'sim', 'Há usuários que atuam em mais de uma unidade'),
      when(a['7.2'] === 'nao', 'Cada usuário atua em uma unidade só'),
      line('Veem todas as unidades', choiceText(a, '7.3')),
      crossUnit(a, '7.4', '7.4.como', 'Clientes atendidos por mais de uma unidade'),
      crossUnit(a, '7.5', '7.5.como', 'Material de uma unidade é processado em outra'),
      line('CNPJ próprio por unidade', choiceText(a, '7.6')),
      line('Novas unidades', withDetail(choiceText(a, '7.7'), textOf(a, '7.7.onde'))),
    ],
  },
  {
    id: 'projeto',
    title: 'Projeto',
    build: (a) => [
      line('Problemas mais urgentes', ranked(a)),
      pilot(a),
      a['8.3'] === 'sim'
        ? line('Prazo', withDetail(textOf(a, '8.3.data') ? formatDateBR(textOf(a, '8.3.data')) : '', textOf(a, '8.3.motivo')) || 'com data a definir')
        : when(a['8.3'] === 'nao', 'Sem prazo definido'),
      // Só uma das faixas está visível, conforme o modelo; a síntese recebe só respostas visíveis.
      line('Modelo de contratação', withDetail(choiceText(a, '8.4'), choiceText(a, '8.4.projeto') || choiceText(a, '8.4.mensal'))),
      line('Quem decide', person(a, '8.5.decisor')),
      line('Ponto focal', person(a, '8.5.focal')),
      line('Sucesso em 6 meses', textLines(a, '8.6')),
    ],
  },
]

/**
 * Usa só as respostas visíveis: o que ficou em campo oculto (ex.: a faixa de
 * orçamento de outro modelo) não entra. Todo texto sai em linha única — respostas
 * livres, sobretudo de pacotes importados, podem trazer quebras de linha que
 * desmontariam o resumo.md.
 */
export function synthesize(answers: Answers, today: Date = new Date()): Synthesis {
  const visible = pruneHidden(answers)
  return {
    headline: oneLine(headline(visible)),
    metrics: metrics(visible),
    attention: attentionPoints(visible, today).map((point) => ({ ...point, text: oneLine(point.text) })),
    topics: TOPICS.map((topic) => ({
      id: topic.id,
      title: topic.title,
      lines: topic.build(visible).filter((item): item is string => item !== null).map(oneLine),
    })).filter((topic) => topic.lines.length > 0),
  }
}

const metricText = (metric: SynthesisMetric) => `${metric.label}: ${metric.value}${metric.detail ? ` (${metric.detail})` : ''}`

/** Texto simples, para copiar e colar em e-mail ou mensagem. */
export function synthesisToText(synthesis: Synthesis): string {
  const blocks = [
    `SÍNTESE\n\n${synthesis.headline}`,
    `Números\n${synthesis.metrics.map((metric) => `- ${metricText(metric)}`).join('\n')}`,
    synthesis.attention.length > 0 ? `Pontos de atenção\n${synthesis.attention.map((point) => `- ${point.text}`).join('\n')}` : '',
    ...synthesis.topics.map((topic) => `${topic.title}\n${topic.lines.map((item) => `- ${item}`).join('\n')}`),
  ]
  return `${blocks.filter(Boolean).join('\n\n')}\n`
}

/** Seção "## Síntese" para o fim do resumo.md. */
export function synthesisToMarkdown(synthesis: Synthesis): string {
  const blocks = [
    `## Síntese\n\n${synthesis.headline}`,
    `### Números\n\n${synthesis.metrics.map((metric) => `- ${metricText(metric)}`).join('\n')}`,
    synthesis.attention.length > 0
      ? `### Pontos de atenção\n\n${synthesis.attention.map((point) => (point.tone === 'alert' ? `- **Atenção:** ${point.text}` : `- ${point.text}`)).join('\n')}`
      : '',
    ...synthesis.topics.map((topic) => `### ${topic.title}\n\n${topic.lines.map((item) => `- ${item}`).join('\n')}`),
  ]
  return `${blocks.filter(Boolean).join('\n\n')}\n`
}
