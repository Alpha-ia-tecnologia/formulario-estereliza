import { DRAFT_KEY, createDraft, loadDraft, removeDraft, saveDraft } from './storage'

const NOW = new Date('2026-09-28T12:00:00')

describe('rascunho no navegador', () => {
  it('cria um rascunho único com a data de hoje e todas as unidades marcadas, inclusive as dentro de hospitais', () => {
    expect(createDraft(NOW)).toMatchObject({
      version: 4,
      lastSection: 'identificacao',
      answers: {
        'ident.data': '2026-09-28',
        'ident.unidades': ['sao-luis', 'teresina', 'maracanau', 'ananindeua', 'unimed-teresina', 'domu-sao-luis'],
      },
    })
  })

  it('salva e carrega o rascunho', () => {
    const draft = { ...createDraft(NOW), answers: { 'ident.nome': 'Ana', '2.1': ['producao'], '2.7@teresina': 'offline' } }
    saveDraft(draft)
    expect(loadDraft()).toEqual(draft)
  })

  it('usa uma chave própria da versão 4', () => {
    expect(DRAFT_KEY).toBe('steriliza-requisitos:v4')
  })

  it('retorna null quando não há rascunho', () => {
    expect(loadDraft()).toBeNull()
  })

  it('ignora dados corrompidos ou de outra versão', () => {
    localStorage.setItem(DRAFT_KEY, '{nao é json')
    expect(loadDraft()).toBeNull()
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, unit: 'sao-luis', answers: {} }))
    expect(loadDraft()).toBeNull()
  })

  it('ignora rascunhos das versões 2 e 3, cujos ids têm outro significado', () => {
    const v2 = { ...createDraft(NOW), version: 2, answers: { 'ident.nome': 'Ana', '2.8@teresina': 'offline' } }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v2))
    localStorage.setItem('steriliza-requisitos:v2', JSON.stringify(v2))
    expect(loadDraft()).toBeNull()

    const v3 = { ...createDraft(NOW), version: 3, answers: { 'ident.nome': 'Ana', '2.8': 'nuvem' } }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v3))
    localStorage.setItem('steriliza-requisitos:v3', JSON.stringify(v3))
    expect(loadDraft()).toBeNull()
  })

  it('limpa respostas inválidas ao carregar', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...createDraft(NOW), answers: { '2.7@teresina': 'instavel', '2.8@teresina': 'nuvem', '1.1': ['vapor'], hack: '<script>' } }),
    )
    expect(loadDraft()?.answers).toEqual({ '2.7@teresina': 'instavel' })
  })

  it('completa datas e etapa ausentes ao carregar', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 4, answers: {}, createdAt: '2026-09-01T10:00:00.000Z' }))
    expect(loadDraft()).toEqual({
      version: 4,
      answers: {},
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      lastSection: 'identificacao',
    })
  })

  it('remove o rascunho', () => {
    saveDraft(createDraft(NOW))
    removeDraft()
    expect(loadDraft()).toBeNull()
  })

  it('propaga erro quando o navegador não consegue salvar', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded') }, removeItem: () => undefined }
    expect(() => saveDraft(createDraft(NOW), full)).toThrow('QuotaExceeded')
  })

  it('retorna null quando o armazenamento está bloqueado', () => {
    const blocked = { getItem: () => { throw new Error('SecurityError') }, setItem: () => undefined, removeItem: () => undefined }
    expect(loadDraft(blocked)).toBeNull()
  })
})
