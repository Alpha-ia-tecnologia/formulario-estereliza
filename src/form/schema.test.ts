import { MODULES } from './options'
import { ALL_FIELDS, SECTIONS, getField, getSection, sectionIndex } from './schema'

describe('schema do formulário', () => {
  it('tem a identificação, 6 etapas numeradas e os detalhes dos módulos sem número, na ordem', () => {
    expect(SECTIONS.map((section) => section.id)).toEqual([
      'identificacao',
      'sistemas',
      'rastreabilidade',
      'clientes',
      'modulos',
      'detalhes',
      'acesso',
      'multiunidade',
    ])
    expect(SECTIONS.map((section) => section.number ?? '-')).toEqual(['-', '1', '2', '3', '4', '-', '5', '6'])
  })

  it('não tem mais as etapas de operação atual, projeto e documentos', () => {
    for (const id of ['operacao', 'projeto', 'documentos']) expect(getSection(id)).toBeUndefined()
    expect(ALL_FIELDS.some((field) => field.kind === 'documents')).toBe(false)
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

  it('numera as perguntas pela posição dentro da etapa', () => {
    for (const section of SECTIONS) {
      const numbered = section.blocks.filter((block) => block.number !== undefined)
      expect(numbered.map((block) => block.number)).toEqual(numbered.map((_, index) => `${section.number}.${index + 1}`))
    }
  })

  it('mantém os ids das respostas quando a numeração exibida muda', () => {
    const numberOf = (sectionId: string, blockId: string) =>
      getSection(sectionId)?.blocks.find((block) => block.id === blockId)?.number
    expect(numberOf('sistemas', '2.7')).toBe('1.7')
    expect(numberOf('sistemas', '2.10')).toBe('1.10')
    expect(numberOf('rastreabilidade', '3.9')).toBe('2.9')
    expect(numberOf('acesso', '6.5')).toBe('5.5')
    expect(numberOf('multiunidade', '7.3')).toBe('6.3')
  })

  it('pergunta unidade por unidade só a internet', () => {
    const perUnit = ALL_FIELDS.filter((field) => field.perUnit).map((field) => field.id)
    expect(perUnit).toEqual(['2.7'])
  })

  it('pergunta o registro de ciclo e os postos de trabalho em matrizes', () => {
    expect(getField('2.5.registro')?.kind).toBe('matrix')
    expect(getField('2.6.postos')?.kind).toBe('matrix')
    expect(getField('2.4.nomes')).toBeUndefined()
    const other = getField('2.4')
    expect(other?.kind === 'multi' && other.other).toBeTruthy()
  })

  it('tem a seção multiunidade depois de acesso, fechando o formulário', () => {
    expect(SECTIONS.map((section) => section.id).slice(-2)).toEqual(['acesso', 'multiunidade'])
    expect(getSection('multiunidade')?.blocks).toHaveLength(7)
  })

  it('tem 25 perguntas de detalhe sem número, todas condicionadas à prioridade do módulo', () => {
    const details = getSection('detalhes')!
    expect(details.title).toBe('Detalhes dos módulos prioritários')
    expect(details.blocks).toHaveLength(25)
    expect(details.blocks.every((block) => block.number === undefined)).toBe(true)
    expect(details.blocks.every((block) => block.fields.every((field) => field.when !== undefined))).toBe(true)
    const moduleKeys = new Set(details.blocks.map((block) => block.id.split('.')[1]))
    expect([...moduleKeys].sort()).toEqual(MODULES.map((module) => module.key).sort())
  })

  it('prefixa o título das perguntas de detalhe com o nome do módulo', () => {
    const coleta = getSection('detalhes')!.blocks.find((block) => block.id === 'm.coleta.1')
    expect(coleta?.title).toBe('Coleta e entrega: Como as coletas e rotas são programadas?')
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
    expect(sectionIndex('sistemas')).toBe(1)
    expect(sectionIndex('detalhes')).toBe(5)
    expect(getField('7.1')?.kind).toBe('matrix')
    expect(getField('nada')).toBeUndefined()
  })
})
