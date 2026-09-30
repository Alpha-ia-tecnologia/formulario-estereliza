import type { Answers, Item, Option, Unit, UnitId } from './types'

export const UNITS: readonly Unit[] = [
  { id: 'sao-luis', city: 'São Luís', state: 'MA' },
  { id: 'teresina', city: 'Teresina', state: 'PI' },
  { id: 'maracanau', city: 'Maracanaú', state: 'CE' },
  { id: 'ananindeua', city: 'Ananindeua', state: 'PA' },
]

export const UNIT_IDS: readonly UnitId[] = UNITS.map((unit) => unit.id)

export const UNIT_OPTIONS: readonly Option[] = UNITS.map((unit) => ({ value: unit.id, label: `${unit.city} — ${unit.state}` }))

export function isUnitId(value: unknown): value is UnitId {
  return typeof value === 'string' && (UNIT_IDS as readonly string[]).includes(value)
}

export function getUnit(id: UnitId): Unit {
  const unit = UNITS.find((candidate) => candidate.id === id)
  if (!unit) throw new Error(`Unidade desconhecida: ${id}`)
  return unit
}

export function unitLabel(id: UnitId): string {
  const { city, state } = getUnit(id)
  return `${city} — ${state}`
}

/** Pergunta da identificação que define quais unidades o sistema vai atender. */
export const UNITS_FIELD_ID = 'ident.unidades'

/** Chave da resposta de uma unidade em perguntas feitas unidade por unidade. */
export const unitKey = (fieldId: string, unit: UnitId): string => `${fieldId}@${unit}`

/** Unidades marcadas na identificação, na ordem padrão; sem marcação, todas. */
export function selectedUnits(answers: Answers): readonly UnitId[] {
  const value = answers[UNITS_FIELD_ID]
  const picked: readonly string[] = Array.isArray(value) ? value : []
  const units = UNIT_IDS.filter((id) => picked.includes(id))
  return units.length > 0 ? units : UNIT_IDS
}

export const YES_NO: readonly Option[] = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
]

export const CURRENT_SYSTEMS: readonly Option[] = [
  { value: 'producao', label: 'Produção' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'balcao', label: 'Balcão' },
  { value: 'odu', label: 'Odu (estoque)' },
]

export const MODULES: readonly Item[] = [
  { key: 'cadastros', label: 'Cadastros', description: 'Clientes, contratos, kits, equipamentos, usuários' },
  { key: 'coleta', label: 'Coleta e entrega', description: 'Pedidos de coleta, rotas, protocolo com assinatura digital' },
  { key: 'recebimento', label: 'Recebimento e triagem', description: 'Conferência, divergências, recusa de itens' },
  { key: 'preparo', label: 'Preparo e embalagem', description: 'Montagem de kits, responsável, validade' },
  { key: 'esterilizacao', label: 'Esterilização', description: 'Montagem de carga, ciclos, parâmetros, aeração do ETO' },
  { key: 'qualidade', label: 'Qualidade e liberação', description: 'Indicadores, liberação de lote, não conformidades, recolhimento' },
  { key: 'etiquetas', label: 'Etiquetas e rastreabilidade', description: 'Código de barras ou QR code, histórico completo do item' },
  { key: 'armazenamento', label: 'Armazenamento e expedição', description: 'Estoque estéril, romaneio, conferência de saída' },
  { key: 'manutencao', label: 'Manutenção e insumos', description: 'Preventivas, calibração, lotes de insumos' },
  { key: 'faturamento', label: 'Faturamento', description: 'Medição automática, contratos, integração com nota fiscal' },
  { key: 'portal', label: 'Portal do cliente', description: 'Status, laudos, rastreabilidade, pedidos de coleta' },
  { key: 'relatorios', label: 'Relatórios e indicadores', description: 'Painel de gestão por unidade e consolidado' },
  { key: 'regulatorio', label: 'Regulatório e pessoas', description: 'Licenças, treinamentos, alertas de vencimento' },
]

export const PRIORITY_LEVELS: readonly Option[] = [
  { value: 'alta', label: 'Alta', hint: 'Precisa estar na primeira entrega' },
  { value: 'media', label: 'Média', hint: 'Importante, pode vir logo depois' },
  { value: 'baixa', label: 'Baixa', hint: 'Desejável, sem urgência' },
  { value: 'nao', label: 'Não precisa', hint: 'Não se aplica à Steriliza' },
]

/** Acima deste número de módulos em alta, a primeira entrega tende a crescer demais. */
export const HIGH_PRIORITY_SOFT_LIMIT = 5

/** Cadastros e configurações que podem ser comuns a todas as unidades ou separados. */
export const SHARED_ITEMS: readonly Item[] = [
  { key: 'clientes', label: 'Cadastro de clientes', description: 'Hospitais, clínicas e contatos' },
  { key: 'contratos', label: 'Contratos e tabela de preços' },
  { key: 'kits', label: 'Catálogo de kits e instrumentais' },
  { key: 'usuarios', label: 'Usuários e perfis de acesso' },
  { key: 'equipamentos', label: 'Equipamentos', description: 'Autoclaves, câmaras de ETO, seladoras' },
  { key: 'insumos', label: 'Estoque de insumos', description: 'Embalagens, indicadores, gás' },
  { key: 'pops', label: 'Procedimentos da qualidade (POPs)' },
  { key: 'liberacao', label: 'Fluxo de liberação de lote' },
  { key: 'etiqueta', label: 'Modelo de etiqueta' },
  { key: 'relatorios-clientes', label: 'Relatórios para clientes' },
  { key: 'documentos', label: 'Logo e dados nos documentos' },
]

export const SHARING_LEVELS: readonly Option[] = [
  { value: 'comum', label: 'Comum a todas', hint: 'Um cadastro só, usado por todas as unidades' },
  { value: 'unidade', label: 'Cada unidade', hint: 'Cada unidade mantém o seu' },
  { value: 'nao-sei', label: 'Não sei' },
]

export const DOCUMENTS: readonly Item[] = [
  { key: 'formularios', label: 'Formulários e planilhas usados hoje' },
  { key: 'etiqueta-protocolo', label: 'Modelo de etiqueta e de protocolo de coleta' },
  { key: 'equipamentos', label: 'Lista de equipamentos por unidade (fabricante, modelo, capacidade)' },
  { key: 'registro-ciclo', label: 'Exemplo de registro de ciclo de cada equipamento' },
  { key: 'faturamento', label: 'Exemplo de relatório de faturamento ou medição' },
  { key: 'kits', label: 'Lista de kits com a composição de cada um' },
  { key: 'precos', label: 'Tabela de preços atual ou contrato-padrão' },
  { key: 'indicadores', label: 'Relatório de indicadores ou de gestão usado hoje' },
  { key: 'pops', label: 'POPs principais (recebimento, limpeza, preparo, esterilização e liberação)' },
]

/** Tipos de equipamento cujo registro de ciclo o sistema pode importar ou precisa digitar (2.5). */
export const CYCLE_EQUIPMENT: readonly Item[] = [
  { key: 'vapor', label: 'Autoclaves a vapor' },
  { key: 'eto', label: 'Óxido de etileno' },
  { key: 'peroxido', label: 'Peróxido de hidrogênio' },
  { key: 'lavadoras', label: 'Termodesinfectoras ou lavadoras' },
  { key: 'seladoras', label: 'Seladoras' },
]

export const CYCLE_RECORD_LEVELS: readonly Option[] = [
  { value: 'arquivo', label: 'Arquivo', hint: 'Pen drive ou cartão de memória' },
  { value: 'rede', label: 'Cabo ou rede', hint: 'Até um computador ou programa do fabricante' },
  { value: 'impressao', label: 'Só impressão' },
  { value: 'manual', label: 'Anotado à mão' },
  { value: 'nao-tem', label: 'Não temos' },
  { value: 'nao-sei', label: 'Não sei' },
]

/** Postos de trabalho da operação (2.6). */
export const WORKSTATIONS: readonly Item[] = [
  { key: 'recebimento', label: 'Recebimento e triagem' },
  { key: 'limpeza', label: 'Limpeza (área suja)' },
  { key: 'preparo', label: 'Preparo e embalagem' },
  { key: 'carga', label: 'Montagem e retirada da carga' },
  { key: 'liberacao', label: 'Liberação e qualidade' },
  { key: 'expedicao', label: 'Guarda estéril e expedição' },
  { key: 'motorista', label: 'Coleta e entrega (motorista)' },
  { key: 'escritorio', label: 'Faturamento e escritório' },
]

export const WORKSTATION_LEVELS: readonly Option[] = [
  { value: 'leitor', label: 'Computador com leitor', hint: 'Leitor de código de barras' },
  { value: 'computador', label: 'Computador sem leitor' },
  { value: 'movel', label: 'Tablet ou celular' },
  { value: 'papel', label: 'Só papel' },
  { value: 'nao-existe', label: 'Não existe' },
]

export type DocumentStatus = 'anexado' | 'depois' | 'nao-tem'

export const DOCUMENT_STATUSES: readonly (Option & { value: DocumentStatus })[] = [
  { value: 'anexado', label: 'Anexado' },
  { value: 'depois', label: 'Envio depois' },
  { value: 'nao-tem', label: 'Não temos' },
]
