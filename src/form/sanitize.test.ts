import { FORM_VERSION, ImportError, parseExport, sanitizeAnswers } from './sanitize'

describe('sanitizeAnswers', () => {
  it('mantém respostas válidas, inclusive por unidade', () => {
    const answers = {
      'ident.nome': 'Ana',
      'ident.unidades': ['sao-luis', 'teresina'],
      'ident.apoio': ['qualidade', 'informatica'],
      'ident.apoio.quem': 'Ana, qualidade',
      '2.2.incomoda': ['digitacao', 'outra:Etiquetas'],
      '2.4': ['contabil', 'outra:Folha'],
      '2.5.registro': { vapor: 'arquivo', eto: 'impressao' },
      '2.6.postos': { preparo: 'leitor', motorista: 'papel' },
      '2.7@teresina': 'instavel',
      '2.9': ['bancos', 'whatsapp'],
      '2.10': 'minutos',
      '2.10.perda': 'nenhum',
      '3.4.quem': 'outra:Enfermeira',
      '3.8': ['ona', 'iso-9001'],
      '3.9': 'desde-ultimo',
      '3.9.acoes': ['listar', 'avisar'],
      modulos: { cadastros: 'alta', coleta: 'alta' },
      'm.coleta.1': ['fixa', 'emergencia'],
      '7.1': { clientes: 'comum', usuarios: 'unidade' },
      '6.3': '11-30',
      '6.5': 'historico',
    }
    expect(sanitizeAnswers(answers)).toEqual(answers)
  })

  it('descarta respostas das etapas que saíram do formulário', () => {
    expect(
      sanitizeAnswers({
        'ident.nome': 'Ana',
        '1.1': ['eto'],
        '1.2@teresina': { itens: '800' },
        '1.4@sao-luis': { total: '12' },
        '8.1': ['a'],
        '8.3.data': '2026-12-01',
        '8.5.decisor': { nome: 'Ana' },
        documentos: { formularios: 'depois' },
        '2.4.nomes': 'Contábil X',
        '4.3.detalhes': 'x',
        '4.5.obs': 'x',
      }),
    ).toEqual({ 'ident.nome': 'Ana' })
  })

  it('descarta chaves desconhecidas e unidades inexistentes', () => {
    expect(sanitizeAnswers({ hack: 'x', '2.7@recife': 'estavel', '2.7@': 'estavel', 'ident.nome': 'Ana' })).toEqual({ 'ident.nome': 'Ana' })
  })

  it('descarta a chave sem unidade em perguntas por unidade e a chave com unidade nas demais', () => {
    expect(sanitizeAnswers({ '2.7': 'estavel', '2.10@sao-luis': 'minutos', '2.8@sao-luis': 'nuvem' })).toEqual({})
  })

  it('descarta valores com tipo errado', () => {
    expect(
      sanitizeAnswers({ '3.2': 'qr', '6.4.responsavel': ['x'], '2.7@sao-luis': ['estavel'], '6.3': ['ate-10'], modulos: ['alta'], '2.5.registro': 'arquivo' }),
    ).toEqual({})
  })

  it('descarta opções que não existem no formulário', () => {
    expect(sanitizeAnswers({ '2.9': ['bancos', 'fax'], '2.8': 'marte', '2.7@teresina': 'satelite', '6.3': '40' })).toEqual({ '2.9': ['bancos'] })
  })

  it('descarta opções repetidas na múltipla escolha', () => {
    expect(sanitizeAnswers({ '3.3': ['quimico', 'quimico', 7, 'biologico'] })).toEqual({ '3.3': ['quimico', 'biologico'] })
  })

  it('descarta itens e níveis inválidos nas matrizes', () => {
    expect(
      sanitizeAnswers({
        modulos: { cadastros: 'alta', inventado: 'alta', portal: 'comum' },
        '7.1': { clientes: 'alta', kits: 'comum' },
        '2.5.registro': { vapor: 'papel', eto: 'manual' },
        '2.6.postos': { preparo: 'impressao' },
      }),
    ).toEqual({ modulos: { cadastros: 'alta' }, '7.1': { kits: 'comum' }, '2.5.registro': { eto: 'manual' } })
  })

  it('aceita "Outra" com texto só em campos que oferecem a opção', () => {
    expect(sanitizeAnswers({ '4.4': ['item', 'outra:pacote mensal'], '4.5.periodicidade': 'outra:por ciclo' })).toEqual({
      '4.4': ['item', 'outra:pacote mensal'],
      '4.5.periodicidade': 'outra:por ciclo',
    })
    expect(sanitizeAnswers({ '2.8': 'outra:marte', '3.1': 'outra:x', '2.10': 'outra:x' })).toEqual({})
  })

  it('mantém só uma resposta "Outra" por campo e corta o texto', () => {
    const result = sanitizeAnswers({ '4.1': ['outra:a', 'clinica', 'outra:b', `outra:${'x'.repeat(6000)}`] })
    expect(result['4.1']).toEqual(['outra:a', 'clinica'])
    expect(sanitizeAnswers({ '4.5.periodicidade': `outra:${'y'.repeat(6000)}` })['4.5.periodicidade']).toHaveLength(5000)
  })

  it('corta textos muito longos', () => {
    const result = sanitizeAnswers({ '6.4.responsavel': 'a'.repeat(20000) })
    expect((result['6.4.responsavel'] as string).length).toBe(5000)
  })

  it('aceita apenas datas no formato AAAA-MM-DD', () => {
    expect(sanitizeAnswers({ 'ident.data': '2026-09-28' })).toEqual({ 'ident.data': '2026-09-28' })
    expect(sanitizeAnswers({ 'ident.data': '28/09/2026' })).toEqual({})
    expect(sanitizeAnswers({ 'ident.data': '2026-02-30' })).toEqual({})
  })

  it('retorna vazio para entradas que não são objetos', () => {
    expect(sanitizeAnswers(null)).toEqual({})
    expect(sanitizeAnswers('texto')).toEqual({})
    expect(sanitizeAnswers([1, 2])).toEqual({})
  })
})


describe('parseExport', () => {
  const valid = {
    formulario: 'steriliza-requisitos',
    versao: FORM_VERSION,
    exportadoEm: '2026-09-28T10:00:00.000Z',
    respostas: { 'ident.nome': 'Ana', hack: 1 },
  }

  it('usa a versão 3 do formato, com as perguntas renumeradas', () => {
    expect(FORM_VERSION).toBe(3)
  })

  it('lê um arquivo exportado válido', () => {
    expect(parseExport(valid)).toEqual({ answers: { 'ident.nome': 'Ana' } })
  })

  it('recusa arquivos de outro formulário', () => {
    expect(() => parseExport({ ...valid, formulario: 'outro' })).toThrow(ImportError)
  })

  it('recusa arquivos da versão por unidade', () => {
    expect(() => parseExport({ ...valid, versao: 1, unidade: 'teresina' })).toThrow(/versão/)
  })

  it('recusa arquivos da versão 2, cujos ids têm outro significado', () => {
    expect(() => parseExport({ ...valid, versao: 2 })).toThrow(
      new ImportError('Este arquivo é de uma versão anterior do formulário e não pode ser importado.'),
    )
  })

  it('recusa conteúdo que não é objeto', () => {
    expect(() => parseExport('oi')).toThrow(ImportError)
  })
})
