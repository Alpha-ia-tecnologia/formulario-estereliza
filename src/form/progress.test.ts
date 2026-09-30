import { DOCUMENTS, MODULES, SHARED_ITEMS, selectedUnits, unitKey } from './options'
import {
  answerCompletion,
  blockCompletion,
  fieldCompletion,
  isVisible,
  missingRequired,
  overallProgress,
  pruneHidden,
  resolveOptions,
  sectionCounter,
  sectionProgress,
  visibleBlocks,
  visibleFields,
} from './progress'
import { SECTIONS, getField, getSection } from './schema'
import type { Answers, Block, Field, Section } from './types'

const field = (id: string): Field => {
  const found = getField(id)
  if (!found) throw new Error(id)
  return found
}

/** Tipos de campo que o motor ainda aceita, mas que nenhuma etapa usa hoje. */
const STAFF_GRID: Field = { kind: 'numberGrid', id: 'grade', items: [{ key: 'total', label: 'Funcionários' }] }
const RANKED: Field = { kind: 'ranked', id: 'lista', count: 3 }
const PERSON: Field = { kind: 'person', id: 'pessoa' }
const DOCUMENTS_FIELD: Field = { kind: 'documents', id: 'documentos', items: DOCUMENTS }

const block = (sectionId: string, blockId: string): Block => {
  const found = getSection(sectionId)?.blocks.find((candidate) => candidate.id === blockId)
  if (!found) throw new Error(blockId)
  return found
}

describe('unidades atendidas', () => {
  it('usa todas as unidades quando nenhuma foi marcada', () => {
    expect(selectedUnits({})).toEqual(['sao-luis', 'teresina', 'maracanau', 'ananindeua'])
  })

  it('usa só as unidades marcadas, na ordem padrão e ignorando valores inválidos', () => {
    expect(selectedUnits({ 'ident.unidades': ['maracanau', 'recife', 'sao-luis'] })).toEqual(['sao-luis', 'maracanau'])
  })

  it('monta a chave da resposta de cada unidade', () => {
    expect(unitKey('2.7', 'teresina')).toBe('2.7@teresina')
  })
})

describe('visibilidade condicional', () => {
  it('mostra "quais substituir" só quando a opção "Substituir alguns" está marcada', () => {
    expect(isVisible(field('2.3.quais'), {})).toBe(false)
    expect(isVisible(field('2.3.quais'), { '2.3': 'todos' })).toBe(false)
    expect(isVisible(field('2.3.quais'), { '2.3': 'alguns' })).toBe(true)
  })

  it('pergunta o que migrar e quanto histórico só quando o novo sistema substitui algum atual', () => {
    for (const id of ['2.3.migrar', '2.3.historico']) {
      expect(isVisible(field(id), {})).toBe(false)
      expect(isVisible(field(id), { '2.3': 'integrar' })).toBe(false)
      expect(isVisible(field(id), { '2.3': 'todos' })).toBe(true)
      expect(isVisible(field(id), { '2.3': 'alguns' })).toBe(true)
    }
  })

  it('pergunta o que é digitado em mais de um sistema só quando a digitação repetida incomoda', () => {
    expect(isVisible(field('2.2.digitacao'), {})).toBe(false)
    expect(isVisible(field('2.2.digitacao'), { '2.2.incomoda': ['lentidao'] })).toBe(false)
    expect(isVisible(field('2.2.digitacao'), { '2.2.incomoda': ['lentidao', 'digitacao'] })).toBe(true)
  })

  it('pergunta os sistemas dos hospitais só quando a rastreabilidade vai até o paciente', () => {
    expect(isVisible(field('3.1.sistemas'), { '3.1': 'item' })).toBe(false)
    expect(isVisible(field('3.1.sistemas'), { '3.1': 'paciente' })).toBe(true)
  })

  it('pergunta quem pode completar as respostas só quando alguém além de quem responde ajuda', () => {
    expect(isVisible(field('ident.apoio.quem'), {})).toBe(false)
    expect(isVisible(field('ident.apoio.quem'), { 'ident.apoio': ['nenhum'] })).toBe(false)
    expect(isVisible(field('ident.apoio.quem'), { 'ident.apoio': ['qualidade'] })).toBe(true)
    expect(isVisible(field('ident.apoio.quem'), { 'ident.apoio': ['nenhum', 'informatica'] })).toBe(true)
  })

  it('mostra os detalhes de um módulo só quando ele está em prioridade alta', () => {
    expect(isVisible(field('m.coleta.1'), {})).toBe(false)
    expect(isVisible(field('m.coleta.1'), { modulos: { coleta: 'media' } })).toBe(false)
    expect(isVisible(field('m.coleta.1'), { modulos: { faturamento: 'alta' } })).toBe(false)
    expect(isVisible(field('m.coleta.1'), { modulos: ['coleta'] })).toBe(false)
    expect(isVisible(field('m.coleta.1'), { modulos: { coleta: 'alta' } })).toBe(true)
  })

  it('pergunta onde serão as novas unidades só quando há previsão', () => {
    expect(isVisible(field('7.7.onde'), { '7.7': 'nao' })).toBe(false)
    expect(isVisible(field('7.7.onde'), { '7.7': 'sem-data' })).toBe(true)
    expect(isVisible(field('7.7.onde'), {})).toBe(false)
  })

  it('lista apenas os campos visíveis de uma pergunta', () => {
    expect(visibleFields(block('clientes', '4.6'), { '4.6': 'nao' }).map((f) => f.id)).toEqual(['4.6'])
    expect(visibleFields(block('clientes', '4.6'), { '4.6': 'sim' }).map((f) => f.id)).toEqual(['4.6', '4.6.quais'])
  })

  it('limita "quais substituir" aos sistemas marcados na 2.1', () => {
    const answers = { '2.1': ['odu', 'financeiro'] }
    expect(resolveOptions(field('2.3.quais'), answers).map((option) => option.value)).toEqual(['financeiro', 'odu'])
  })

  it('mostra todos os sistemas quando a 2.1 está em branco', () => {
    expect(resolveOptions(field('2.3.quais'), {})).toHaveLength(5)
    expect(resolveOptions(field('2.3.quais'), { '2.1': [] })).toHaveLength(5)
  })

  it('não oferece opções para campos que não são de escolha', () => {
    expect(resolveOptions(field('modulos'), {})).toEqual([])
  })
})

describe('perguntas visíveis', () => {
  it('lista todas as perguntas das etapas comuns, mesmo em branco', () => {
    expect(visibleBlocks(getSection('rastreabilidade')!, {})).toHaveLength(9)
  })

  it('esconde as perguntas de detalhe dos módulos que não estão em prioridade alta', () => {
    const details = getSection('detalhes')!
    expect(visibleBlocks(details, {})).toEqual([])
    expect(visibleBlocks(details, { modulos: { coleta: 'alta', cadastros: 'baixa' } }).map((b) => b.id)).toEqual(['m.coleta.1', 'm.coleta.2'])
  })

  it('mostra os detalhes de todos os módulos em prioridade alta, na ordem da etapa', () => {
    const answers = { modulos: { faturamento: 'alta', coleta: 'alta' } }
    expect(visibleBlocks(getSection('detalhes')!, answers).map((b) => b.id)).toEqual([
      'm.coleta.1',
      'm.coleta.2',
      'm.faturamento.1',
      'm.faturamento.2',
      'm.faturamento.3',
    ])
  })
})

describe('pruneHidden', () => {
  it('remove respostas de campos ocultos', () => {
    expect(pruneHidden({ '4.6': 'nao', '4.6.quais': 'modelo', '3.2': ['qr'] })).toEqual({ '4.6': 'nao', '3.2': ['qr'] })
  })

  it('remove os detalhes do módulo que deixou de estar em prioridade alta', () => {
    const answers = { modulos: { coleta: 'media', portal: 'alta' }, 'm.coleta.1': ['fixa'], 'm.portal.1': ['laudos'] }
    expect(pruneHidden(answers)).toEqual({ modulos: { coleta: 'media', portal: 'alta' }, 'm.portal.1': ['laudos'] })
  })

  it('remove respostas de unidades desmarcadas', () => {
    const answers = { 'ident.unidades': ['teresina'], '2.7@teresina': 'estavel', '2.7@sao-luis': 'offline' }
    expect(pruneHidden(answers)).toEqual({ 'ident.unidades': ['teresina'], '2.7@teresina': 'estavel' })
  })

  it('mantém respostas de chaves que o formulário não conhece', () => {
    expect(pruneHidden({ legado: 'x' })).toEqual({ legado: 'x' })
  })

  it('não altera o objeto original', () => {
    const answers = { '4.6': 'nao', '4.6.quais': 'modelo X' }
    pruneHidden(answers)
    expect(answers).toEqual({ '4.6': 'nao', '4.6.quais': 'modelo X' })
  })
})

describe('preenchimento', () => {
  it('considera texto com espaços como vazio', () => {
    expect(fieldCompletion(field('6.4.responsavel'), '   ')).toBe(0)
    expect(fieldCompletion(field('6.4.responsavel'), 'Ana, qualidade')).toBe(1)
  })

  it('considera múltipla escolha vazia como não respondida', () => {
    expect(fieldCompletion(field('3.2'), [])).toBe(0)
    expect(fieldCompletion(field('3.2'), ['qr'])).toBe(1)
  })

  it('considera a grade numérica respondida com ao menos um número', () => {
    expect(fieldCompletion(STAFF_GRID, { total: '' })).toBe(0)
    expect(fieldCompletion(STAFF_GRID, { total: '3' })).toBe(1)
  })

  it('considera a lista ordenada respondida com ao menos um item', () => {
    expect(fieldCompletion(RANKED, ['', ' ', ''])).toBe(0)
    expect(fieldCompletion(RANKED, ['', 'etiquetas', ''])).toBe(1)
  })

  it('conta a matriz de prioridades de forma proporcional', () => {
    const half = Object.fromEntries(MODULES.map((m, i) => [m.key, i % 2 === 0 ? 'alta' : '']))
    expect(fieldCompletion(field('modulos'), {})).toBe(0)
    expect(fieldCompletion(field('modulos'), half)).toBeCloseTo(7 / 13)
  })

  it('aceita só os níveis da própria matriz', () => {
    expect(fieldCompletion(field('modulos'), { cadastros: 'comum' })).toBe(0)
    expect(SHARED_ITEMS).toHaveLength(11)
    expect(fieldCompletion(field('7.1'), { clientes: 'comum', kits: 'alta' })).toBeCloseTo(1 / 11)
  })

  it('conta a matriz do registro de ciclo de forma proporcional', () => {
    expect(fieldCompletion(field('2.5.registro'), { vapor: 'arquivo', eto: 'manual', seladoras: 'papel' })).toBeCloseTo(2 / 5)
  })

  it('conta documentos de forma proporcional', () => {
    expect(DOCUMENTS).toHaveLength(9)
    expect(fieldCompletion(DOCUMENTS_FIELD, { formularios: 'anexado', equipamentos: 'depois', kits: 'talvez' })).toBeCloseTo(2 / 9)
  })

  it('ignora respostas com tipo errado', () => {
    expect(fieldCompletion(field('3.2'), 'qr')).toBe(0)
    expect(fieldCompletion(field('6.4.responsavel'), ['x'])).toBe(0)
    expect(fieldCompletion(STAFF_GRID, 'x')).toBe(0)
    expect(fieldCompletion(field('6.4.responsavel'), undefined)).toBe(0)
  })

  it('considera pessoa respondida com nome ou contato', () => {
    expect(fieldCompletion(PERSON, { nome: '', contato: '' })).toBe(0)
    expect(fieldCompletion(PERSON, { nome: 'Ana' })).toBe(1)
  })

  it('mede perguntas por unidade pela fração de unidades respondidas', () => {
    const answers = { '2.7@sao-luis': 'estavel', '2.7@teresina': 'offline' }
    expect(answerCompletion(field('2.7'), answers)).toBe(0.5)
    expect(answerCompletion(field('2.7'), { ...answers, 'ident.unidades': ['sao-luis', 'teresina'] })).toBe(1)
  })

  it('ignora a chave sem unidade em perguntas por unidade', () => {
    expect(answerCompletion(field('2.7'), { '2.7': 'estavel' })).toBe(0)
  })

  it('considera a pergunta respondida quando qualquer campo visível foi preenchido', () => {
    expect(blockCompletion(block('sistemas', '2.2'), { '2.2.incomoda': ['lentidao'] })).toBe(1)
    expect(blockCompletion(block('sistemas', '2.2'), {})).toBe(0)
  })

  it('ignora campos ocultos no preenchimento da pergunta', () => {
    expect(blockCompletion(block('clientes', '4.6'), { '4.6.quais': 'modelo' })).toBe(0)
    expect(blockCompletion(block('sistemas', '2.2'), { '2.2.digitacao': ['clientes'] })).toBe(0)
  })
})

describe('progresso', () => {
  it('calcula o progresso de uma seção com perguntas por unidade', () => {
    const answers = {
      'ident.unidades': ['sao-luis', 'teresina'],
      '2.1': ['producao'],
      '2.7@sao-luis': 'estavel',
    }
    expect(sectionProgress(getSection('sistemas')!, answers)).toEqual({ done: 1.5, total: 10, ratio: 0.15 })
  })

  it('não conta as perguntas de detalhe ocultas no progresso da etapa', () => {
    const details = getSection('detalhes')!
    expect(sectionProgress(details, {})).toEqual({ done: 0, total: 0, ratio: 0 })
    expect(sectionProgress(details, { modulos: { coleta: 'alta' }, 'm.coleta.1': ['fixa'] })).toEqual({ done: 1, total: 2, ratio: 0.5 })
    expect(sectionProgress(details, { modulos: { coleta: 'baixa' }, 'm.coleta.1': ['fixa'] })).toEqual({ done: 0, total: 0, ratio: 0 })
  })

  it('calcula o progresso geral do formulário só com as perguntas visíveis', () => {
    const visibleTotal = (answers: Answers) => SECTIONS.reduce((sum, section) => sum + visibleBlocks(section, answers).length, 0)
    expect(overallProgress({}).done).toBe(0)
    expect(overallProgress({}).total).toBe(45)
    expect(overallProgress({}).total).toBe(visibleTotal({}))
    expect(overallProgress({ modulos: { coleta: 'alta' } }).total).toBe(47)
    expect(overallProgress({ 'ident.nome': 'Ana', '3.2': ['qr'] }).done).toBe(2)
  })

  it('conta perguntas respondidas nas seções comuns', () => {
    expect(sectionCounter(getSection('rastreabilidade')!, { '3.2': ['qr'] })).toEqual({ done: 1, total: 9, noun: 'respondidas' })
  })

  it('conta só as perguntas de detalhe visíveis na trilha', () => {
    expect(sectionCounter(getSection('detalhes')!, {})).toEqual({ done: 0, total: 0, noun: 'respondidas' })
    expect(sectionCounter(getSection('detalhes')!, { modulos: { portal: 'alta' } })).toEqual({ done: 0, total: 1, noun: 'respondidas' })
  })

  it('conta itens um a um nas seções de matriz ou documentos', () => {
    const documentsSection: Section = {
      id: 'docs',
      title: 'Documentos',
      intro: '',
      blocks: [{ id: 'docs', title: 'Documentos', fields: [DOCUMENTS_FIELD] }],
    }
    expect(sectionCounter(getSection('modulos')!, { modulos: { cadastros: 'alta', portal: 'nao' } })).toEqual({ done: 2, total: 13, noun: 'módulos' })
    expect(sectionCounter(documentsSection, { documentos: { kits: 'depois' } })).toEqual({ done: 1, total: 9, noun: 'documentos' })
  })

  it('aponta o nome de quem responde como obrigatório', () => {
    expect(missingRequired({}).map((f) => f.id)).toEqual(['ident.nome'])
    expect(missingRequired({ 'ident.nome': 'Ana' })).toEqual([])
  })
})
