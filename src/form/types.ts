/**
 * Modelo do formulário. As perguntas são descritas como dados (schema.ts) e a
 * interface, o progresso, a revisão e a exportação são derivados daqui.
 */

export type UnitId = 'sao-luis' | 'teresina' | 'maracanau' | 'ananindeua'

export interface Unit {
  readonly id: UnitId
  readonly city: string
  readonly state: string
}

export interface Option {
  readonly value: string
  readonly label: string
  readonly hint?: string
}

/** Item nomeado usado por grades numéricas, matrizes e documentos. */
export interface Item {
  readonly key: string
  readonly label: string
  readonly description?: string
}

/**
 * Valor guardado para cada campo:
 * - string: texto, número, data, escolha única
 * - string[]: múltipla escolha, lista ordenada
 * - Record: grades numéricas, prioridades, documentos, pessoa
 */
export type AnswerValue = string | readonly string[] | Readonly<Record<string, string>>
export type Answers = Readonly<Record<string, AnswerValue | undefined>>

/**
 * Novo valor de uma resposta, ou uma função que o calcula a partir do valor
 * atual — use a função quando a gravação acontece depois de um await.
 */
export type AnswerUpdate = AnswerValue | undefined | ((current: AnswerValue | undefined) => AnswerValue | undefined)

export type Predicate = (answers: Answers) => boolean

interface FieldBase {
  /** Chave única da resposta. */
  readonly id: string
  /** Rótulo do campo; omitido quando o título da pergunta já basta. */
  readonly label?: string
  /** Mostra o campo só quando a condição é verdadeira. */
  readonly when?: Predicate
  /**
   * Pede uma resposta para cada unidade atendida (ex.: volume, equipe). A resposta
   * de cada unidade fica na chave `${id}@${unidade}`.
   */
  readonly perUnit?: boolean
}

/** Opção "Outra" com campo de texto; o valor fica gravado como "outra:<texto>". */
export interface OtherOption {
  readonly label?: string
  readonly prompt?: string
}

export interface SingleField extends FieldBase {
  readonly kind: 'single'
  readonly options: readonly Option[]
  /** "scale" desenha as opções como uma escala progressiva. */
  readonly layout?: 'chips' | 'scale'
  readonly other?: OtherOption | true
  /** Restringe as opções exibidas com base em outras respostas. */
  readonly filterOptions?: (options: readonly Option[], answers: Answers) => readonly Option[]
}

export interface MultiField extends FieldBase {
  readonly kind: 'multi'
  readonly options: readonly Option[]
  readonly other?: OtherOption | true
  /** Restringe as opções exibidas com base em outras respostas. */
  readonly filterOptions?: (options: readonly Option[], answers: Answers) => readonly Option[]
}

export interface TextField extends FieldBase {
  readonly kind: 'text'
  readonly inputType?: 'text' | 'email' | 'tel' | 'date'
  readonly multiline?: boolean
  readonly placeholder?: string
  readonly autoComplete?: string
  readonly required?: boolean
  /** Respostas comuns, em chips tocáveis, para quem prefere não digitar. */
  readonly suggestions?: readonly string[]
}

export interface NumberField extends FieldBase {
  readonly kind: 'number'
  readonly suffix?: string
  readonly placeholder?: string
}

export interface NumberGridField extends FieldBase {
  readonly kind: 'numberGrid'
  readonly items: readonly Item[]
  readonly suffix?: string
  /** Quando informado, exibe a soma com este rótulo. */
  readonly totalLabel?: string
}

export interface RankedField extends FieldBase {
  readonly kind: 'ranked'
  readonly count: number
  readonly placeholders?: readonly string[]
  /** Chips que preenchem a próxima posição vazia; podem depender de outras respostas. */
  readonly suggestions?: readonly string[] | ((answers: Answers) => readonly string[])
}

export interface MatrixWarning {
  readonly level: string
  readonly max: number
  readonly message: (count: number) => string
}

/** Matriz item × nível com uma escolha por linha (prioridades, comum/por unidade). */
export interface MatrixField extends FieldBase {
  readonly kind: 'matrix'
  readonly items: readonly Item[]
  readonly levels: readonly Option[]
  /** Nome dos itens no contador da trilha (ex.: "módulos"). */
  readonly itemNoun: string
  /** Alerta quando itens demais recebem o mesmo nível. */
  readonly warn?: MatrixWarning
}

export interface DocumentsField extends FieldBase {
  readonly kind: 'documents'
  readonly items: readonly Item[]
}

export interface PersonField extends FieldBase {
  readonly kind: 'person'
  /** Mostra o atalho "Sou eu", que copia os dados de quem responde. */
  readonly canUseRespondent?: boolean
}

export type Field =
  | SingleField
  | MultiField
  | TextField
  | NumberField
  | NumberGridField
  | RankedField
  | MatrixField
  | DocumentsField
  | PersonField

export type FieldKind = Field['kind']

/** Uma pergunta numerada do formulário; pode reunir mais de um campo. */
export interface Block {
  readonly id: string
  readonly number?: string
  readonly title: string
  readonly help?: string
  readonly fields: readonly Field[]
}

export interface Section {
  readonly id: string
  readonly number?: string
  readonly title: string
  readonly intro: string
  readonly blocks: readonly Block[]
}
