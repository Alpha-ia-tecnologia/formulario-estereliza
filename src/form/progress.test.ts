import { MODULES, SHARED_ITEMS, selectedUnits, unitKey } from './options'
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

  it('mostra a faixa de orçamento que combina com o modelo de contratação', () => {
    const visibleBudget = (model?: string) => visibleFields(block('projeto', '8.4'), model ? { '8.4': model } : {}).map((f) => f.id)
    expect(visibleBudget()).toEqual(['8.4'])
    expect(visibleBudget('fechado')).toEqual(['8.4', '8.4.projeto'])
    expect(visibleBudget('outra:Por entrega')).toEqual(['8.4', '8.4.projeto'])
    expect(visibleBudget('mensalidade')).toEqual(['8.4', '8.4.mensal'])
    expect(visibleBudget('equipe')).toEqual(['8.4', '8.4.mensal'])
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

  it('limita "quais substituir" aos sistemas marcados na 2.1', () => {
    const answers = { '2.1': ['odu', 'financeiro'] }
    expect(resolveOptions(field('2.3.quais'), answers).map((option) => option.value)).toEqual(['financeiro', 'odu'])
  })

  it('mostra todos os sistemas quando a 2.1 está em branco', () => {
    expect(resolveOptions(field('2.3.quais'), {})).toHaveLength(5)
    expect(resolveOptions(field('2.3.quais'), { '2.1': [] })).toHaveLength(5)
  })

  it('oferece como piloto só as unidades que o sistema vai atender', () => {
    const labels = resolveOptions(field('8.2'), { 'ident.unidades': ['teresina', 'maracanau'] }).map((option) => option.label)
    expect(labels).toEqual(['Sim: Teresina', 'Sim: Maracanaú', 'Não, todas juntas', 'Ainda não definido'])
  })
})

describe('pruneHidden', () => {
  it('remove respostas de campos ocultos', () => {
    expect(pruneHidden({ '4.6': 'nao', '4.6.quais': 'modelo', '3.2': ['qr'] })).toEqual({ '4.6': 'nao', '3.2': ['qr'] })
  })

  it('remove a faixa de orçamento do modelo que deixou de ser escolhido', () => {
    expect(pruneHidden({ '8.4': 'mensalidade', '8.4.projeto': 'ate-100k', '8.4.mensal': '5-15k' })).toEqual({
      '8.4': 'mensalidade',
      '8.4.mensal': '5-15k',
    })
  })

  it('remove respostas de unidades desmarcadas', () => {
    const answers = { 'ident.unidades': ['teresina'], '2.7@teresina': 'estavel', '2.7@sao-luis': 'offline' }
    expect(pruneHidden(answers)).toEqual({ 'ident.unidades': ['teresina'], '2.7@teresina': 'estavel' })
  })

  it('não altera o objeto original', () => {
    const answers = { '4.6': 'nao', '4.6.quais': 'modelo X' }
    pruneHidden(answers)
    expect(answers).toEqual({ '4.6': 'nao', '4.6.quais': 'modelo X' })
  })
})

describe('preenchimento', () => {
  it('considera texto com espaços como vazio', () => {
    expect(fieldCompletion(field('1.6'), '   ')).toBe(0)
    expect(fieldCompletion(field('1.6'), 'Teresina não tem ETO')).toBe(1)
  })

  it('considera múltipla escolha vazia como não respondida', () => {
    expect(fieldCompletion(field('3.2'), [])).toBe(0)
    expect(fieldCompletion(field('3.2'), ['qr'])).toBe(1)
  })

  it('considera a grade numérica respondida com ao menos um número', () => {
    expect(fieldCompletion(field('1.4'), { total: '' })).toBe(0)
    expect(fieldCompletion(field('1.4'), { total: '3' })).toBe(1)
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
    expect(SHARED_ITEMS).toHaveLength(11)
    expect(fieldCompletion(field('7.1'), { clientes: 'comum', kits: 'alta' })).toBeCloseTo(1 / 11)
  })

  it('conta documentos de forma proporcional', () => {
    expect(fieldCompletion(field('documentos'), { formularios: 'anexado', equipamentos: 'depois' })).toBeCloseTo(2 / 5)
  })

  it('ignora respostas com tipo errado', () => {
    expect(fieldCompletion(field('3.2'), 'qr')).toBe(0)
    expect(fieldCompletion(field('1.6'), ['x'])).toBe(0)
    expect(fieldCompletion(field('1.4'), 'x')).toBe(0)
    expect(fieldCompletion(field('1.6'), undefined)).toBe(0)
  })

  it('considera pessoa respondida com nome ou contato', () => {
    expect(fieldCompletion(field('8.5.decisor'), { nome: '', contato: '' })).toBe(0)
    expect(fieldCompletion(field('8.5.decisor'), { nome: 'Ana' })).toBe(1)
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
      '1.1': ['eto'],
      '1.4@sao-luis': { total: '10' },
    }
    expect(sectionProgress(getSection('operacao')!, answers)).toEqual({ done: 1.5, total: 6, ratio: 0.25 })
  })

  it('calcula o progresso geral do formulário', () => {
    expect(overallProgress({}).done).toBe(0)
    expect(overallProgress({}).total).toBeGreaterThan(45)
    expect(overallProgress({ 'ident.nome': 'Ana', '3.2': ['qr'] }).done).toBe(2)
  })

  it('conta perguntas respondidas nas seções comuns', () => {
    expect(sectionCounter(getSection('rastreabilidade')!, { '3.2': ['qr'] })).toEqual({ done: 1, total: 7, noun: 'respondidas' })
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
