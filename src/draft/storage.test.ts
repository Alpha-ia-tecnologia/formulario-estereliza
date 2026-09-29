import { DRAFT_KEY, createDraft, loadDraft, removeDraft, saveDraft } from './storage'

const NOW = new Date('2026-09-28T12:00:00')

describe('rascunho no navegador', () => {
  it('cria um rascunho único com a data de hoje e todas as unidades marcadas', () => {
    expect(createDraft(NOW)).toMatchObject({
      version: 2,
      lastSection: 'identificacao',
      answers: { 'ident.data': '2026-09-28', 'ident.unidades': ['sao-luis', 'teresina', 'maracanau', 'ananindeua'] },
    })
  })

  it('salva e carrega o rascunho', () => {
    const draft = { ...createDraft(NOW), answers: { 'ident.nome': 'Ana', '1.1@sao-luis': ['vapor'] } }
    saveDraft(draft)
    expect(loadDraft()).toEqual(draft)
  })

  it('usa uma chave própria da versão 2', () => {
    expect(DRAFT_KEY).toBe('steriliza-requisitos:v2')
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

  it('limpa respostas inválidas ao carregar', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...createDraft(NOW), answers: { '1.3@teresina': 'turnos', hack: '<script>' } }))
    expect(loadDraft()?.answers).toEqual({ '1.3@teresina': 'turnos' })
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
