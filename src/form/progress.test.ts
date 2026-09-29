import { MODULES, selectedUnits, unitKey } from './options'
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
  visibleFields,
} from './progress'
import { getField, getSection } from './schema'
import type { Block, Field } from './types'

const field = (id: string): Field => {
  const found = getField(id)
  if (!found) throw new Error(id)
  return found
}

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
    expect(unitKey('1.1', 'teresina')).toBe('1.1@teresina')
  })
})

describe('visibilidade condicional', () => {
  it('mostra "quais substituir" só quando a opção "Substituir alguns" está marcada', () => {
    expect(isVisible(field('2.4.quais'), {})).toBe(false)
    expect(isVisible(field('2.4.quais'), { '2.4': 'alguns' })).toBe(true)
  })

  it('pergunta onde serão as novas unidades só quando há previsão', () => {
    expect(isVisible(field('7.7.onde'), { '7.7': 'nao' })).toBe(false)
    expect(isVisible(field('7.7.onde'), { '7.7': 'sem-data' })).toBe(true)
    expect(isVisible(field('7.7.onde'), {})).toBe(false)
  })

  it('lista apenas os campos visíveis de uma pergunta', () => {
    expect(visibleFields(block('projeto', '8.3'), { '8.3': 'nao' }).map((f) => f.id)).toEqual(['8.3'])
    expect(visibleFields(block('projeto', '8.3'), { '8.3': 'sim' }).map((f) => f.id)).toEqual(['8.3', '8.3.data', '8.3.motivo'])
  })

  it('limita "quais substituir" aos sistemas marcados na 2.1 de qualquer unidade', () => {
    const answers = { '2.1@sao-luis': ['financeiro'], '2.1@teresina': ['odu', 'financeiro'] }
    expect(resolveOptions(field('2.4.quais'), answers).map((option) => option.value)).toEqual(['financeiro', 'odu'])
  })

  it('ignora sistemas de unidades desmarcadas', () => {
    const answers = { 'ident.unidades': ['sao-luis'], '2.1@sao-luis': ['balcao'], '2.1@teresina': ['odu'] }
    expect(resolveOptions(field('2.4.quais'), answers).map((option) => option.value)).toEqual(['balcao'])
  })

  it('mostra todos os sistemas quando a 2.1 está em branco', () => {
    expect(resolveOptions(field('2.4.quais'), {})).toHaveLength(5)
  })
})

describe('pruneHidden', () => {
  it('remove respostas de campos ocultos', () => {
    expect(pruneHidden({ '4.6': 'nao', '4.6.quais': 'modelo', '3.2': ['qr'] })).toEqual({ '4.6': 'nao', '3.2': ['qr'] })
  })

  it('remove respostas de unidades desmarcadas', () => {
    const answers = { 'ident.unidades': ['teresina'], '1.3@teresina': 'turnos', '1.3@sao-luis': '24h' }
    expect(pruneHidden(answers)).toEqual({ 'ident.unidades': ['teresina'], '1.3@teresina': 'turnos' })
  })

  it('não altera o objeto original', () => {
    const answers = { '4.6': 'nao', '4.6.quais': 'modelo X' }
    pruneHidden(answers)
    expect(answers).toEqual({ '4.6': 'nao', '4.6.quais': 'modelo X' })
  })
})

describe('preenchimento', () => {
  it('considera texto com espaços como vazio', () => {
    expect(fieldCompletion(field('2.2'), '   ')).toBe(0)
    expect(fieldCompletion(field('2.2'), 'retrabalho')).toBe(1)
  })

  it('considera múltipla escolha vazia como não respondida', () => {
    expect(fieldCompletion(field('3.2'), [])).toBe(0)
    expect(fieldCompletion(field('3.2'), ['qr'])).toBe(1)
  })

  it('considera a grade numérica respondida com ao menos um número', () => {
    expect(fieldCompletion(field('1.4'), { recepcao: '' })).toBe(0)
    expect(fieldCompletion(field('1.4'), { recepcao: '3' })).toBe(1)
  })

  it('considera a lista ordenada respondida com ao menos um item', () => {
    expect(fieldCompletion(field('8.1'), ['', ' ', ''])).toBe(0)
    expect(fieldCompletion(field('8.1'), ['', 'etiquetas', ''])).toBe(1)
  })

  it('conta a matriz de prioridades de forma proporcional', () => {
    const half = Object.fromEntries(MODULES.map((m, i) => [m.key, i % 2 === 0 ? 'alta' : '']))
    expect(fieldCompletion(field('modulos'), {})).toBe(0)
    expect(fieldCompletion(field('modulos'), half)).toBeCloseTo(7 / 13)
  })

  it('aceita só os níveis da própria matriz', () => {
    expect(fieldCompletion(field('modulos'), { cadastros: 'comum' })).toBe(0)
    expect(fieldCompletion(field('7.1'), { clientes: 'comum', kits: 'alta' })).toBeCloseTo(1 / 7)
  })

  it('conta documentos de forma proporcional', () => {
    expect(fieldCompletion(field('documentos'), { formularios: 'anexado', equipamentos: 'depois' })).toBeCloseTo(2 / 5)
  })

  it('ignora respostas com tipo errado', () => {
    expect(fieldCompletion(field('3.2'), 'qr')).toBe(0)
    expect(fieldCompletion(field('2.2'), ['x'])).toBe(0)
    expect(fieldCompletion(field('1.4'), 'x')).toBe(0)
    expect(fieldCompletion(field('2.2'), undefined)).toBe(0)
  })

  it('considera pessoa respondida com nome ou contato', () => {
    expect(fieldCompletion(field('8.5.decisor'), { nome: '', contato: '' })).toBe(0)
    expect(fieldCompletion(field('8.5.decisor'), { nome: 'Ana' })).toBe(1)
  })

  it('mede perguntas por unidade pela fração de unidades respondidas', () => {
    expect(answerCompletion(field('1.1'), { '1.1@sao-luis': ['vapor'], '1.1@teresina': ['eto'] })).toBe(0.5)
    expect(answerCompletion(field('1.1'), { 'ident.unidades': ['sao-luis', 'teresina'], '1.1@sao-luis': ['vapor'], '1.1@teresina': ['eto'] })).toBe(1)
  })

  it('ignora a chave sem unidade em perguntas por unidade', () => {
    expect(answerCompletion(field('1.3'), { '1.3': 'turnos' })).toBe(0)
  })

  it('considera a pergunta respondida quando qualquer campo visível foi preenchido', () => {
    expect(blockCompletion(block('sistemas', '2.3'), { '2.3.incomoda': 'lentidão' })).toBe(1)
    expect(blockCompletion(block('sistemas', '2.3'), {})).toBe(0)
  })

  it('ignora campos ocultos no preenchimento da pergunta', () => {
    expect(blockCompletion(block('clientes', '4.6'), { '4.6.quais': 'modelo' })).toBe(0)
  })
})

describe('progresso', () => {
  it('calcula o progresso de uma seção com perguntas por unidade', () => {
    const answers = {
      'ident.unidades': ['sao-luis', 'teresina'],
      '1.1@sao-luis': ['eto'],
      '1.1@teresina': ['vapor'],
      '1.3@sao-luis': 'turnos',
    }
    expect(sectionProgress(getSection('operacao')!, answers)).toEqual({ done: 1.5, total: 5, ratio: 0.3 })
  })

  it('calcula o progresso geral do formulário', () => {
    expect(overallProgress({}).done).toBe(0)
    expect(overallProgress({}).total).toBeGreaterThan(45)
    expect(overallProgress({ 'ident.nome': 'Ana', '3.2': ['qr'] }).done).toBe(2)
  })

  it('conta perguntas respondidas nas seções comuns', () => {
    expect(sectionCounter(getSection('rastreabilidade')!, { '3.2': ['qr'] })).toEqual({ done: 1, total: 6, noun: 'respondidas' })
  })

  it('conta itens um a um nas seções de matriz ou documentos', () => {
    expect(sectionCounter(getSection('modulos')!, { modulos: { cadastros: 'alta', portal: 'nao' } })).toEqual({ done: 2, total: 13, noun: 'módulos' })
    expect(sectionCounter(getSection('documentos')!, {})).toEqual({ done: 0, total: 5, noun: 'documentos' })
  })

  it('aponta o nome de quem responde como obrigatório', () => {
    expect(missingRequired({}).map((f) => f.id)).toEqual(['ident.nome'])
    expect(missingRequired({ 'ident.nome': 'Ana' })).toEqual([])
  })
})
