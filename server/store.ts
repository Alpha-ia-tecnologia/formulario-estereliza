/**
 * Respostas recebidas, numa tabela do PostgreSQL. Cada envio vira uma linha com
 * os campos de listagem, o respostas.json (jsonb, consultável por SQL), o
 * resumo.md e o pacote .zip pronto para reimportar no formulário.
 */

export interface ResponseSummary {
  readonly id: number
  /** ISO 8601, hora do servidor. */
  readonly recebidoEm: string
  readonly respondente: string
  readonly cargo: string
  readonly unidades: readonly string[]
  /** Percentual do formulário preenchido. */
  readonly preenchido: number
  readonly anexos: number
  /** Abertura da síntese. */
  readonly sintese: string
}

export interface SavedResponse extends ResponseSummary {
  /** respostas.json em texto. */
  readonly dados: string
  readonly resumo: string
  readonly pacote: Uint8Array
}

export type NewResponse = Omit<SavedResponse, 'id'>

export interface Receipt {
  readonly id: number
  readonly recebidoEm: string
}

/** O mínimo de um cliente Postgres que o store usa: atende o pg.Pool e o PGlite dos testes. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ readonly rows: readonly unknown[] }>
}

export interface Store {
  save(input: NewResponse): Promise<Receipt>
  list(): Promise<readonly ResponseSummary[]>
  get(id: number): Promise<SavedResponse | null>
  /** Tamanho da tabela em bytes, para a cota de espaço. */
  sizeBytes(): Promise<number>
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS respostas (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recebido_em timestamptz NOT NULL,
    respondente text NOT NULL,
    cargo text NOT NULL,
    unidades jsonb NOT NULL,
    preenchido smallint NOT NULL,
    anexos integer NOT NULL,
    sintese text NOT NULL,
    dados jsonb NOT NULL,
    resumo text NOT NULL,
    pacote bytea NOT NULL
  )
`

const SUMMARY_COLUMNS = 'id, recebido_em AS "recebidoEm", respondente, cargo, unidades, preenchido, anexos, sintese'
/** Maior valor de uma coluna integer: ids acima disso não existem. */
const MAX_ID = 2_147_483_647

type Row = Readonly<Record<string, unknown>>

const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null
const text = (row: Row, key: string): string => (typeof row[key] === 'string' ? row[key] : '')
const integer = (row: Row, key: string): number => Number(row[key] ?? 0)
const isoOf = (value: unknown): string => (value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : '')

/** jsonb chega como objeto (pg, PGlite) — ou como texto, se algum cliente não o converter. */
const parsedJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// O PostgreSQL não aceita o caractere nulo em text nem em jsonb; um pacote adulterado poderia trazê-lo.
const withoutNul = (value: string): string => value.replaceAll('\u0000', '')
const jsonWithoutNul = (json: string): string =>
  JSON.stringify(JSON.parse(json), (_key, value: unknown) => (typeof value === 'string' ? withoutNul(value) : value))

function unitsOf(row: Row): readonly string[] {
  const parsed = parsedJson(row.unidades)
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

const toSummary = (row: Row): ResponseSummary => ({
  id: integer(row, 'id'),
  recebidoEm: isoOf(row.recebidoEm),
  respondente: text(row, 'respondente'),
  cargo: text(row, 'cargo'),
  unidades: unitsOf(row),
  preenchido: integer(row, 'preenchido'),
  anexos: integer(row, 'anexos'),
  sintese: text(row, 'sintese'),
})

function toSaved(row: Row): SavedResponse {
  if (!(row.pacote instanceof Uint8Array)) throw new Error(`Pacote da resposta ${integer(row, 'id')} está corrompido no banco.`)
  return {
    ...toSummary(row),
    dados: JSON.stringify(parsedJson(row.dados), null, 2),
    resumo: text(row, 'resumo'),
    pacote: row.pacote,
  }
}

/** Cria a tabela se ainda não existe e devolve as operações sobre ela. */
export async function openStore(db: Queryable): Promise<Store> {
  await db.query(SCHEMA)
  const rows = async (sql: string, params?: unknown[]): Promise<readonly Row[]> => (await db.query(sql, params)).rows.filter(isRow)

  return {
    async save(input) {
      const [row] = await rows(
        `INSERT INTO respostas (recebido_em, respondente, cargo, unidades, preenchido, anexos, sintese, dados, resumo, pacote)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9, $10)
         RETURNING id, recebido_em AS "recebidoEm"`,
        [
          input.recebidoEm,
          withoutNul(input.respondente),
          withoutNul(input.cargo),
          JSON.stringify(input.unidades.map(withoutNul)),
          input.preenchido,
          input.anexos,
          withoutNul(input.sintese),
          jsonWithoutNul(input.dados),
          withoutNul(input.resumo),
          Buffer.from(input.pacote),
        ],
      )
      if (!row) throw new Error('O banco não devolveu o número da resposta gravada.')
      return { id: integer(row, 'id'), recebidoEm: isoOf(row.recebidoEm) }
    },
    list: async () => (await rows(`SELECT ${SUMMARY_COLUMNS} FROM respostas ORDER BY id DESC`)).map(toSummary),
    async get(id) {
      if (!Number.isSafeInteger(id) || id < 1 || id > MAX_ID) return null
      const [row] = await rows(`SELECT ${SUMMARY_COLUMNS}, dados, resumo, pacote FROM respostas WHERE id = $1`, [id])
      return row ? toSaved(row) : null
    },
    async sizeBytes() {
      const [row] = await rows(`SELECT pg_total_relation_size('respostas')::float8 AS bytes`)
      return row ? integer(row, 'bytes') : 0
    },
  }
}
