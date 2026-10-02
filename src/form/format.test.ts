import { DOCUMENTS } from './options'
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
    expect(formatFieldValue(field('2.10'), '1h')).toBe('Até 1 hora')
    expect(formatFieldValue(field('3.3'), ['biologico', 'quimico'])).toBe('Biológico, Químico')
    expect(formatFieldValue(field('6.3'), '11-30')).toBe('11 a 30')
    expect(formatFieldValue(field('2.9'), ['bancos', 'whatsapp'])).toBe('Bancos (boleto, Pix, extrato), WhatsApp')
  })

  it('rotula a resposta "Outra" com o texto informado', () => {
    expect(formatFieldValue(field('4.4'), ['item', 'outra:pacote mensal'])).toBe('Item, Outra: pacote mensal')
    expect(formatFieldValue(field('3.4.quem'), 'outra:Diretoria')).toBe('Outro: Diretoria')
    expect(formatFieldValue(field('3.4.quem'), 'outra:')).toBe('Outro')
    expect(formatFieldValue(field('2.4'), ['contabil', 'outra:Folha'])).toBe('Contábil, Outro: Folha')
  })

  it('mantém valores de opção desconhecidos em vez de descartá-los', () => {
    expect(formatFieldValue(field('2.10'), 'plantao')).toBe('plantao')
  })

  it('retorna null para respostas em branco', () => {
    expect(formatFieldValue(field('6.4.responsavel'), '  ')).toBeNull()
    expect(formatFieldValue(field('3.2'), [])).toBeNull()
    expect(formatFieldValue(field('7.1'), {})).toBeNull()
    expect(formatFieldValue(field('6.4.responsavel'), undefined)).toBeNull()
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

  it('formata a grade numérica sem total com o sufixo entre parênteses', () => {
    const volume: Field = {
      kind: 'numberGrid',
      id: 'volume',
      suffix: 'por mês',
      items: [
        { key: 'itens', label: 'Kits e itens' },
        { key: 'ciclos', label: 'Ciclos' },
      ],
    }
    expect(formatFieldValue(volume, { itens: '1200', ciclos: '90' })).toBe('Kits e itens: 1200 · Ciclos: 90 (por mês)')
  })

  it('numera a lista ordenada ignorando posições vazias', () => {
    const ranked: Field = { kind: 'ranked', id: 'problemas', count: 3 }
    expect(formatFieldValue(ranked, ['rastrear kits', '', 'faturar'])).toBe('1. rastrear kits\n3. faturar')
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

  it('agrupa a matriz do registro de ciclo por forma de registro', () => {
    expect(formatFieldValue(field('2.5.registro'), { vapor: 'impressao', eto: 'impressao', seladoras: 'manual' })).toBe(
      'Só impressão: Autoclaves a vapor, Óxido de etileno\nAnotado à mão: Seladoras\nSem resposta: 2 equipamentos',
    )
  })

  it('lista documentos com o status', () => {
    const documents: Field = { kind: 'documents', id: 'documentos', items: DOCUMENTS }
    expect(formatFieldValue(documents, { formularios: 'anexado', faturamento: 'nao-tem' })).toBe(
      'Formulários e planilhas usados hoje: Anexado\nExemplo de relatório de faturamento ou medição: Não temos',
    )
  })

  it('junta nome e contato da pessoa', () => {
    const person: Field = { kind: 'person', id: 'decisor' }
    expect(formatFieldValue(person, { nome: 'Ana', contato: 'ana@x.com' })).toBe('Ana — ana@x.com')
    expect(formatFieldValue(person, { nome: 'Ana' })).toBe('Ana')
  })
})

describe('resumo', () => {
  it('mostra perguntas por unidade com uma linha para cada unidade atendida', () => {
    const block = findBlock({ 'ident.unidades': ['sao-luis', 'teresina'], '2.7@sao-luis': 'offline' }, '2.7')
    expect(block.answered).toBe(true)
    expect(block.number).toBe('1.7')
    expect(block.entries).toEqual([
      { label: 'São Luís', text: 'Sem internet boa parte do tempo' },
      { label: 'Teresina', text: null },
    ])
  })

  it('mostra perguntas da empresa numa linha só, sem unidade', () => {
    const block = findBlock({ 'ident.unidades': ['sao-luis', 'teresina'], '2.1': ['producao'] }, '2.1')
    expect(block.entries).toEqual([{ label: undefined, text: 'Produção' }])
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
  })

  it('nomeia as unidades dentro de hospitais pelo hospital nas perguntas por unidade', () => {
    const block = findBlock({ 'ident.unidades': ['teresina', 'unimed-teresina'], '2.7@unimed-teresina': 'instavel' }, '2.7')
    expect(block.entries).toEqual([
      { label: 'Teresina', text: null },
      { label: 'Unimed Teresina', text: 'Instável' },
    ])
  })

  it('omite a pergunta das unidades dentro de hospitais quando nenhuma delas é atendida', () => {
    expect(findBlock({ 'ident.unidades': ['sao-luis'], '7.8': ['producao'] }, '7.8')).toBeUndefined()
    expect(findBlock({ 'ident.unidades': ['domu-sao-luis'], '7.8': ['producao'] }, '7.8').entries[0]?.text).toBe('Registra a produção')
  })

  it('deixa de fora a etapa de detalhes quando nenhum módulo está em prioridade alta', () => {
    const sections = summarize({ modulos: { coleta: 'media' }, 'm.coleta.1': ['fixa'] })
    expect(sections.map((section) => section.id)).toEqual([
      'identificacao',
      'sistemas',
      'rastreabilidade',
      'clientes',
      'modulos',
      'acesso',
      'multiunidade',
    ])
  })

  it('inclui só as perguntas de detalhe dos módulos em prioridade alta', () => {
    const details = summarize({ modulos: { coleta: 'alta', faturamento: 'baixa' }, 'm.coleta.1': ['fixa'] }).find((section) => section.id === 'detalhes')!
    expect(details.number).toBeUndefined()
    expect(details.blocks.map((block) => block.id)).toEqual(['m.coleta.1', 'm.coleta.2'])
    expect(details.blocks[0]).toEqual({
      id: 'm.coleta.1',
      number: undefined,
      title: 'Coleta e entrega: Como as coletas e rotas são programadas?',
      answered: true,
      entries: [{ label: undefined, text: 'Rota fixa: mesmos clientes nos mesmos dias' }],
    })
  })

  it('usa a numeração derivada da posição nas etapas e perguntas', () => {
    const sections = summarize({})
    expect(sections.map((section) => section.number ?? '-')).toEqual(['-', '1', '2', '3', '4', '5', '6'])
    expect(sections.find((section) => section.id === 'multiunidade')!.blocks.map((block) => block.number)).toEqual([
      '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8',
    ])
    // Sem unidade dentro de hospital, a última pergunta some sem abrir buraco na numeração.
    const own = summarize({ 'ident.unidades': ['sao-luis'] })
    expect(own.find((section) => section.id === 'multiunidade')!.blocks.map((block) => block.number)).toEqual([
      '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7',
    ])
  })

  it('marca como em branco a pergunta sem resposta', () => {
    expect(findBlock({}, '3.2').answered).toBe(false)
  })

  it('gera markdown legível com as unidades e as respostas', () => {
    const markdown = toMarkdown({
      exportedAt: '2026-09-28T10:00:00.000Z',
      answers: { 'ident.nome': 'Ana', 'ident.unidades': ['sao-luis', 'teresina', 'unimed-teresina'], '2.2.bem': ['relatorios'], '2.7@teresina': 'instavel' },
    })
    expect(markdown).toContain('# Formulário de requisitos — Sistema Steriliza')
    expect(markdown).toContain('**Unidades atendidas:** São Luís — MA, Teresina — PI, Unimed Teresina — PI')
    expect(markdown).toContain('**Exportado em:** 28/09/2026')
    expect(markdown).toContain('## Identificação')
    expect(markdown).toContain('## 6. Operação multiunidade')
    expect(markdown).toContain('**1.7 Internet em cada unidade**')
    expect(markdown).toContain('- Fazem bem: Relatórios')
    expect(markdown).toContain('- Mais incomoda: —')
    expect(markdown).toContain('- Teresina: Instável')
    expect(markdown).toContain('_Em branco_')
    expect(markdown).not.toContain('Detalhes dos módulos prioritários')
  })

  it('inclui no markdown os detalhes dos módulos em prioridade alta', () => {
    const markdown = toMarkdown({ exportedAt: '2026-09-28T10:00:00.000Z', answers: { modulos: { portal: 'alta' } } })
    expect(markdown).toContain('## Detalhes dos módulos prioritários')
    expect(markdown).toContain('**Portal do cliente: No portal, o que o cliente deve poder ver e fazer?**')
  })
})
