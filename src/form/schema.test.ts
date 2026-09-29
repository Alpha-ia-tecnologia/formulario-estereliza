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

  it('pergunta unidade por unidade só onde a operação muda entre unidades', () => {
    const perUnit = ALL_FIELDS.filter((field) => field.perUnit).map((field) => field.id)
    expect(perUnit).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '2.1', '2.6', '2.6.modelos', '2.7', '2.8'])
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
