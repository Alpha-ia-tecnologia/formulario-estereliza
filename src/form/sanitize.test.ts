import { FORM_VERSION, ImportError, parseExport, sanitizeAnswers } from './sanitize'

describe('sanitizeAnswers', () => {
  it('mantém respostas válidas, inclusive por unidade', () => {
    const answers = {
      'ident.nome': 'Ana',
      'ident.unidades': ['sao-luis', 'teresina'],
      '1.1@sao-luis': ['eto', 'vapor'],
      '1.3@teresina': 'turnos',
      '1.4@sao-luis': { recepcao: '3', preparo: '4' },
      '2.6.modelos@teresina': 'Baumer',
      '8.1': ['a', 'b', 'c'],
      modulos: { cadastros: 'alta' },
      '7.1': { clientes: 'comum', usuarios: 'unidade' },
      documentos: { formularios: 'depois' },
      '8.5.decisor': { nome: 'Ana', contato: '(98) 99999-0000' },
      '6.4': '10',
    }
    expect(sanitizeAnswers(answers)).toEqual(answers)
  })

  it('descarta chaves desconhecidas e unidades inexistentes', () => {
    expect(sanitizeAnswers({ hack: 'x', '1.3@recife': 'turnos', '1.3@': 'turnos', 'ident.nome': 'Ana' })).toEqual({ 'ident.nome': 'Ana' })
  })

  it('descarta a chave sem unidade em perguntas por unidade e a chave com unidade nas demais', () => {
    expect(sanitizeAnswers({ '1.3': 'turnos', '2.9@sao-luis': 'nuvem' })).toEqual({})
  })

  it('descarta valores com tipo errado', () => {
    expect(sanitizeAnswers({ '3.2': 'qr', '2.2': ['x'], '1.4@sao-luis': 'x', modulos: ['alta'] })).toEqual({})
  })

  it('descarta opções que não existem no formulário', () => {
    expect(sanitizeAnswers({ '1.1@sao-luis': ['eto', 'plasma'], '2.9': 'marte' })).toEqual({ '1.1@sao-luis': ['eto'] })
  })

  it('descarta itens e níveis inválidos nas matrizes e documentos', () => {
    expect(
      sanitizeAnswers({
        modulos: { cadastros: 'alta', inventado: 'alta', portal: 'comum' },
        '7.1': { clientes: 'alta', kits: 'comum' },
        documentos: { formularios: 'talvez' },
      }),
    ).toEqual({ modulos: { cadastros: 'alta' }, '7.1': { kits: 'comum' } })
  })

  it('aceita "Outra" com texto só em campos que oferecem a opção', () => {
    expect(sanitizeAnswers({ '4.4': ['item', 'outra:pacote mensal'], '4.5.periodicidade': 'outra:por ciclo' })).toEqual({
      '4.4': ['item', 'outra:pacote mensal'],
      '4.5.periodicidade': 'outra:por ciclo',
    })
    expect(sanitizeAnswers({ '2.9': 'outra:marte', '3.1': 'outra:x' })).toEqual({})
  })

  it('mantém só uma resposta "Outra" por campo e corta o texto', () => {
    const result = sanitizeAnswers({ '4.1': ['outra:a', 'clinica', 'outra:b', `outra:${'x'.repeat(6000)}`] })
    expect(result['4.1']).toEqual(['outra:a', 'clinica'])
    expect(sanitizeAnswers({ '4.5.periodicidade': `outra:${'y'.repeat(6000)}` })['4.5.periodicidade']).toHaveLength(5000)
  })

  it('aceita só dígitos nos campos numéricos', () => {
    expect(sanitizeAnswers({ '6.4': '1e9', '1.4@teresina': { recepcao: '-2', preparo: '5' } })).toEqual({ '1.4@teresina': { preparo: '5' } })
  })

  it('corta textos muito longos', () => {
    const result = sanitizeAnswers({ '2.2': 'a'.repeat(20000) })
    expect((result['2.2'] as string).length).toBe(5000)
  })

  it('limita a lista ordenada ao número de posições', () => {
    expect(sanitizeAnswers({ '8.1': ['a', 'b', 'c', 'd'] })).toEqual({ '8.1': ['a', 'b', 'c'] })
  })

  it('aceita apenas datas no formato AAAA-MM-DD', () => {
    expect(sanitizeAnswers({ 'ident.data': '2026-09-28', '8.3.data': '28/09/2026' })).toEqual({ 'ident.data': '2026-09-28' })
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

  it('usa a versão 2 do formato, sem unidade única', () => {
    expect(FORM_VERSION).toBe(2)
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

  it('recusa conteúdo que não é objeto', () => {
    expect(() => parseExport('oi')).toThrow(ImportError)
  })
})
