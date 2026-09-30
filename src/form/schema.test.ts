import { ALL_FIELDS, SECTIONS, getField, getSection, sectionIndex } from './schema'

describe('schema do formulário', () => {
  it('tem a identificação e 9 seções numeradas, na ordem', () => {
    expect(SECTIONS.map((section) => section.number ?? '-')).toEqual(['-', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('usa ids de campo e de pergunta únicos', () => {
    const fieldIds = ALL_FIELDS.map((field) => field.id)
    const blockIds = SECTIONS.flatMap((section) => section.blocks.map((block) => block.id))
    expect(new Set(fieldIds).size).toBe(fieldIds.length)
    expect(new Set(blockIds).size).toBe(blockIds.length)
  })

  it('não usa "@" nos ids, reservado às respostas por unidade', () => {
    expect(ALL_FIELDS.some((field) => field.id.includes('@'))).toBe(false)
  })

  it('numera as perguntas de acordo com a seção', () => {
    for (const section of SECTIONS) {
      for (const block of section.blocks) {
        if (block.number) expect(block.number.startsWith(`${section.number}.`)).toBe(true)
      }
    }
  })

  it('pergunta unidade por unidade só volume, equipe e internet', () => {
    const perUnit = ALL_FIELDS.filter((field) => field.perUnit).map((field) => field.id)
    expect(perUnit).toEqual(['1.2', '1.4', '2.7'])
  })

  it('pergunta a equipe de cada unidade num total único de funcionários', () => {
    const staff = getField('1.4')
    expect(staff?.kind === 'numberGrid' && staff.items).toEqual([{ key: 'total', label: 'Funcionários' }])
  })

  it('oferece como piloto cada unidade, todas juntas ou ainda a definir', () => {
    const pilot = getField('8.2')
    expect(pilot?.kind === 'single' && pilot.options.map((option) => option.label)).toEqual([
      'Sim: São Luís',
      'Sim: Teresina',
      'Sim: Maracanaú',
      'Sim: Ananindeua',
      'Não, todas juntas',
      'Ainda não definido',
    ])
  })

  it('sugere na 8.1 primeiro o que incomoda na 2.2, sem repetir itens', () => {
    const ranked = getField('8.1')
    if (ranked?.kind !== 'ranked' || typeof ranked.suggestions !== 'function') throw new Error('8.1 sem sugestões dinâmicas')
    const suggestions = ranked.suggestions({ '2.2.incomoda': ['digitacao', 'lentidao', 'outra:Etiquetas ilegíveis'] })

    expect(suggestions.slice(0, 4)).toEqual([
      'Digitação repetida entre sistemas',
      'Lentidão',
      'Etiquetas ilegíveis',
      'Rastreabilidade até o cliente',
    ])
    expect(suggestions.filter((item) => item === 'Digitação repetida entre sistemas')).toHaveLength(1)
    expect(ranked.suggestions({ '2.2.incomoda': ['outra:  '] })[0]).toBe('Rastreabilidade até o cliente')
    expect(ranked.suggestions({})[0]).toBe('Rastreabilidade até o cliente')
  })

  it('tem a seção multiunidade entre acesso e projeto', () => {
    expect(SECTIONS.map((section) => section.id).slice(6, 9)).toEqual(['acesso', 'multiunidade', 'projeto'])
    expect(getSection('multiunidade')?.blocks).toHaveLength(7)
  })

  it('tem opções com valores únicos em cada campo de escolha', () => {
    for (const field of ALL_FIELDS) {
      if (field.kind === 'single' || field.kind === 'multi') {
        const values = field.options.map((option) => option.value)
        expect(new Set(values).size).toBe(values.length)
      }
    }
  })

  it('encontra seções e campos por id', () => {
    expect(getSection('sistemas')?.title).toBe('Sistemas e infraestrutura')
    expect(getSection('inexistente')).toBeUndefined()
    expect(sectionIndex('operacao')).toBe(1)
    expect(getField('7.1')?.kind).toBe('matrix')
    expect(getField('nada')).toBeUndefined()
  })
})
