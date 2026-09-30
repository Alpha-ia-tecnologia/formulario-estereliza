import { formatDateBR, formatFieldValue, parseIsoDate, summarize, toMarkdown } from './format'
import { getField } from './schema'
import type { Field } from './types'

const field = (id: string): Field => {
  const found = getField(id)
  if (!found) throw new Error(id)
  return found
}

const findBlock = (answers: Parameters<typeof summarize>[0], id: string) =>
  summarize(answers).flatMap((section) => section.blocks).find((block) => block.id === id)!

describe('formatação de respostas', () => {
  it('formata datas no padrão brasileiro', () => {
    expect(formatDateBR('2026-09-28')).toBe('28/09/2026')
    expect(formatDateBR('data ruim')).toBe('data ruim')
  })

  it('reconhece só datas que existem no calendário', () => {
    expect(parseIsoDate('2026-02-28')).toEqual(new Date(2026, 1, 28))
    expect(parseIsoDate('2028-02-29')).toEqual(new Date(2028, 1, 29))
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('28/02/2026')).toBeNull()
  })

  it('usa o rótulo das opções', () => {
    expect(formatFieldValue(field('1.3'), '24h')).toBe('24 horas')
    expect(formatFieldValue(field('1.1'), ['eto', 'vapor'])).toBe('Óxido de etileno, Vapor')
    expect(formatFieldValue(field('6.3'), '11-30')).toBe('11 a 30')
    expect(formatFieldValue(field('8.2'), 'teresina')).toBe('Sim: Teresina')
  })

  it('rotula a resposta "Outra" com o texto informado', () => {
    expect(formatFieldValue(field('4.4'), ['item', 'outra:pacote mensal'])).toBe('Item, Outra: pacote mensal')
    expect(formatFieldValue(field('1.3'), 'outra:12 horas')).toBe('Outro: 12 horas')
    expect(formatFieldValue(field('1.3'), 'outra:')).toBe('Outro')
  })

  it('mantém valores de opção desconhecidos em vez de descartá-los', () => {
    expect(formatFieldValue(field('1.3'), 'plantao')).toBe('plantao')
  })

  it('retorna null para respostas em branco', () => {
    expect(formatFieldValue(field('1.6'), '  ')).toBeNull()
    expect(formatFieldValue(field('3.2'), [])).toBeNull()
    expect(formatFieldValue(field('1.4'), {})).toBeNull()
    expect(formatFieldValue(field('1.6'), undefined)).toBeNull()
  })

  it('formata datas e números com sufixo', () => {
    const users: Field = { kind: 'number', id: 'usuarios', suffix: 'usuários' }
    expect(formatFieldValue(field('ident.data'), '2026-01-05')).toBe('05/01/2026')
    expect(formatFieldValue(users, '12')).toBe('12 usuários')
  })

  it('soma a grade numérica quando há total', () => {
    const staff: Field = {
      kind: 'numberGrid',
      id: 'equipe',
      suffix: 'pessoas',
      totalLabel: 'Total',
      items: [
        { key: 'recepcao', label: 'Recepção' },
        { key: 'preparo', label: 'Preparo' },
      ],
    }
    expect(formatFieldValue(staff, { recepcao: '2', preparo: '5' })).toBe('Recepção: 2 · Preparo: 5 · Total: 7 pessoas')
  })

  it('mostra o total de funcionários de uma unidade com o sufixo', () => {
    expect(formatFieldValue(field('1.4'), { total: '12' })).toBe('Funcionários: 12 (pessoas)')
  })

  it('formata a grade de volume com sufixo', () => {
    expect(formatFieldValue(field('1.2'), { itens: '1200', ciclos: '90' })).toBe('Kits e itens: 1200 · Ciclos: 90 (por mês)')
  })

  it('numera a lista ordenada ignorando posições vazias', () => {
    expect(formatFieldValue(field('8.1'), ['rastrear kits', '', 'faturar'])).toBe('1. rastrear kits\n3. faturar')
  })

  it('agrupa a matriz de prioridades por nível', () => {
    expect(formatFieldValue(field('modulos'), { cadastros: 'alta', faturamento: 'alta', portal: 'baixa' })).toBe(
      'Alta: Cadastros, Faturamento\nBaixa: Portal do cliente\nSem resposta: 10 módulos',
    )
  })

  it('agrupa a matriz de itens comuns e por unidade', () => {
    expect(formatFieldValue(field('7.1'), { clientes: 'comum', kits: 'comum', precos: 'x', contratos: 'unidade' })).toBe(
      'Comum a todas: Cadastro de clientes, Catálogo de kits e instrumentais\nCada unidade: Contratos e tabela de preços\nSem resposta: 8 itens',
    )
  })

  it('lista documentos com o status', () => {
    expect(formatFieldValue(field('documentos'), { formularios: 'anexado', faturamento: 'nao-tem' })).toBe(
      'Formulários e planilhas usados hoje: Anexado\nExemplo de relatório de faturamento ou medição: Não temos',
    )
  })

  it('junta nome e contato da pessoa', () => {
    expect(formatFieldValue(field('8.5.decisor'), { nome: 'Ana', contato: 'ana@x.com' })).toBe('Ana — ana@x.com')
    expect(formatFieldValue(field('8.5.decisor'), { nome: 'Ana' })).toBe('Ana')
  })
})

describe('resumo', () => {
  it('mostra perguntas por unidade com uma linha para cada unidade atendida', () => {
    const block = findBlock({ 'ident.unidades': ['sao-luis', 'teresina'], '2.7@sao-luis': 'offline' }, '2.7')
    expect(block.answered).toBe(true)
    expect(block.entries).toEqual([
      { label: 'São Luís', text: 'Precisa funcionar sem internet' },
      { label: 'Teresina', text: null },
    ])
  })

  it('mostra perguntas da empresa numa linha só, sem unidade', () => {
    const block = findBlock({ 'ident.unidades': ['sao-luis', 'teresina'], '1.1': ['vapor'] }, '1.1')
    expect(block.entries).toEqual([{ label: undefined, text: 'Vapor' }])
  })

  it('usa o rótulo de cada campo quando a pergunta tem vários campos', () => {
    const block = findBlock({ '2.2.bem': ['relatorios'], '2.2.incomoda': ['digitacao'], '2.2.digitacao': ['clientes', 'os'] }, '2.2')
    expect(block.entries).toEqual([
      { label: 'Fazem bem', text: 'Relatórios' },
      { label: 'Mais incomoda', text: 'Digitação repetida entre sistemas' },
      { label: 'O que é digitado em mais de um sistema?', text: 'Cadastro de clientes, Ordem de serviço' },
    ])
  })

  it('omite campos ocultos do resumo', () => {
    expect(findBlock({ '4.6': 'nao', '4.6.quais': 'modelo antigo' }, '4.6').entries).toEqual([{ label: undefined, text: 'Não' }])
    expect(findBlock({ '8.4': 'mensalidade', '8.4.projeto': 'ate-100k', '8.4.mensal': 'ate-5k' }, '8.4').entries).toEqual([
      { label: 'Modelo', text: 'Mensalidade' },
      { label: 'Faixa de orçamento por mês', text: 'Até R$ 5 mil por mês' },
    ])
  })

  it('marca como em branco a pergunta sem resposta', () => {
    expect(findBlock({}, '3.2').answered).toBe(false)
  })

  it('gera markdown legível com as unidades e as respostas', () => {
    const markdown = toMarkdown({
      exportedAt: '2026-09-28T10:00:00.000Z',
      answers: { 'ident.nome': 'Ana', 'ident.unidades': ['sao-luis', 'teresina'], '2.2.bem': ['relatorios'], '2.7@teresina': 'instavel' },
    })
    expect(markdown).toContain('# Formulário de requisitos — Sistema Steriliza')
    expect(markdown).toContain('**Unidades atendidas:** São Luís — MA, Teresina — PI')
    expect(markdown).toContain('## 7. Operação multiunidade')
    expect(markdown).toContain('- Fazem bem: Relatórios')
    expect(markdown).toContain('- Mais incomoda: —')
    expect(markdown).toContain('- Teresina: Instável')
    expect(markdown).toContain('_Em branco_')
  })
})
