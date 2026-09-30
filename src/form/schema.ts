import {
  CURRENT_SYSTEMS,
  DOCUMENTS,
  HIGH_PRIORITY_SOFT_LIMIT,
  MODULES,
  PRIORITY_LEVELS,
  SHARED_ITEMS,
  SHARING_LEVELS,
  UNITS,
  UNIT_OPTIONS,
  UNITS_FIELD_ID,
  YES_NO,
  isUnitId,
  selectedUnits,
} from './options'
import { isOtherValue, otherText } from './other'
import type { Answers, Field, Option, Section } from './types'

const selected = (answers: Answers, id: string): readonly string[] => {
  const value = answers[id]
  return Array.isArray(value) ? value : []
}

const equals = (id: string, value: string) => (answers: Answers) => answers[id] === value
const oneOf = (id: string, values: readonly string[]) => (answers: Answers) => values.includes(String(answers[id] ?? ''))

/** O que mais incomoda nos sistemas atuais (2.2); também alimenta as sugestões da 8.1. */
const PAIN_POINTS: readonly Option[] = [
  { value: 'lentidao', label: 'Lentidão' },
  { value: 'digitacao', label: 'Digitação repetida entre sistemas' },
  { value: 'rastreabilidade', label: 'Falta de rastreabilidade' },
  { value: 'relatorios', label: 'Relatórios que faltam' },
  { value: 'falhas', label: 'Falhas frequentes' },
  { value: 'telas', label: 'Telas confusas' },
]

const URGENT_PROBLEMS: readonly string[] = [
  'Rastreabilidade até o cliente',
  'Digitação repetida entre sistemas',
  'Faturamento manual',
  'Registros de ciclo em papel',
  'Falta de visão consolidada das unidades',
  'Não conformidades sem histórico',
]

/** Sugestões da 8.1: primeiro o que foi marcado como incômodo na 2.2, depois as comuns. */
function urgentProblems(answers: Answers): readonly string[] {
  const fromPains = selected(answers, '2.2.incomoda').map((value) =>
    isOtherValue(value) ? otherText(value) : PAIN_POINTS.find((option) => option.value === value)?.label ?? '',
  )
  return [...new Set([...fromPains.filter((item) => item.trim() !== ''), ...URGENT_PROBLEMS])]
}

/** Substituir sistemas implica decidir o que migrar. */
const replacesSystems = oneOf('2.3', ['todos', 'alguns'])

const BUDGET_OTHER = { label: 'Outra', prompt: 'Qual faixa?' }
const BUDGET_UNDEFINED: Option = { value: 'a-definir', label: 'Ainda não definida' }

export const SECTIONS: readonly Section[] = [
  {
    id: 'identificacao',
    title: 'Identificação',
    intro: 'Quem responde e quais unidades o novo sistema vai atender. O formulário vale para a Steriliza inteira.',
    blocks: [
      {
        id: 'ident.nome',
        title: 'Respondido por',
        fields: [{ kind: 'text', id: 'ident.nome', placeholder: 'Nome completo', autoComplete: 'name', required: true }],
      },
      {
        id: 'ident.cargo',
        title: 'Cargo',
        fields: [{ kind: 'text', id: 'ident.cargo', placeholder: 'Ex.: Gerente de operações', autoComplete: 'organization-title' }],
      },
      {
        id: 'ident.contato',
        title: 'E-mail e telefone',
        fields: [
          { kind: 'text', id: 'ident.email', label: 'E-mail', inputType: 'email', placeholder: 'nome@steriliza.com.br', autoComplete: 'email' },
          { kind: 'text', id: 'ident.telefone', label: 'Telefone', inputType: 'tel', placeholder: '(98) 99999-9999', autoComplete: 'tel' },
        ],
      },
      {
        id: 'ident.atuacao',
        title: 'Onde você atua',
        fields: [{ kind: 'single', id: 'ident.atuacao', options: [...UNIT_OPTIONS, { value: 'central', label: 'Administração central' }] }],
      },
      {
        id: UNITS_FIELD_ID,
        title: 'Unidades que o novo sistema vai atender',
        help: 'Todas vêm marcadas. Só volume, equipe e internet são perguntados unidade por unidade.',
        fields: [{ kind: 'multi', id: UNITS_FIELD_ID, options: UNIT_OPTIONS }],
      },
      {
        id: 'ident.data',
        title: 'Data',
        fields: [{ kind: 'text', id: 'ident.data', inputType: 'date' }],
      },
    ],
  },
  {
    id: 'operacao',
    number: '1',
    title: 'Operação atual',
    intro: 'Como a Steriliza opera hoje — do mesmo jeito em todas as unidades — e o tamanho de cada uma. Só volume e equipe vão unidade por unidade.',
    blocks: [
      {
        id: '1.1',
        number: '1.1',
        title: 'Métodos de esterilização oferecidos',
        fields: [{
          kind: 'multi', id: '1.1', other: { label: 'Outro', prompt: 'Qual método?' }, options: [
            { value: 'eto', label: 'Óxido de etileno' },
            { value: 'vapor', label: 'Vapor' },
            { value: 'peroxido', label: 'Peróxido de hidrogênio' },
          ],
        }],
      },
      {
        id: '1.2',
        number: '1.2',
        title: 'Volume médio mensal de cada unidade',
        help: 'Números aproximados já ajudam a dimensionar o sistema. Em "Kits e itens", cada kit ou caixa conta como 1, e cada item avulso também.',
        fields: [{
          kind: 'numberGrid', id: '1.2', perUnit: true, suffix: 'por mês', items: [
            { key: 'itens', label: 'Kits e itens' },
            { key: 'ciclos', label: 'Ciclos' },
            { key: 'clientes', label: 'Clientes ativos' },
          ],
        }],
      },
      {
        id: '1.3',
        number: '1.3',
        title: 'Horário de funcionamento',
        fields: [{
          kind: 'single', id: '1.3', other: { label: 'Outro', prompt: 'Qual horário?' }, options: [
            { value: 'comercial', label: 'Comercial' },
            { value: 'turnos', label: 'Turnos' },
            { value: '24h', label: '24 horas' },
          ],
        }],
      },
      {
        id: '1.4',
        number: '1.4',
        title: 'Número de funcionários de cada unidade',
        fields: [{ kind: 'numberGrid', id: '1.4', perUnit: true, suffix: 'pessoas', items: [{ key: 'total', label: 'Funcionários' }] }],
      },
      {
        id: '1.5',
        number: '1.5',
        title: 'A limpeza do material é feita pela Steriliza?',
        fields: [{
          kind: 'single', id: '1.5', options: [
            { value: 'sempre', label: 'Sempre' },
            { value: 'depende', label: 'Depende do cliente' },
            { value: 'nunca', label: 'Nunca' },
          ],
        }],
      },
      {
        id: '1.6',
        number: '1.6',
        title: 'Alguma unidade foge do padrão?',
        help: 'As perguntas desta etapa valem para todas as unidades. Se alguma opera diferente, conte aqui.',
        fields: [{
          kind: 'text', id: '1.6', multiline: true, placeholder: 'Ex.: só uma unidade tem óxido de etileno',
          suggestions: ['Não, todas operam igual', 'Métodos diferentes em uma unidade', 'Horário diferente em uma unidade'],
        }],
      },
    ],
  },
  {
    id: 'sistemas',
    number: '2',
    title: 'Sistemas e infraestrutura',
    intro: 'Quais sistemas a Steriliza usa hoje, o que funciona, o que atrapalha e com que estrutura o novo sistema vai rodar.',
    blocks: [
      {
        id: '2.1',
        number: '2.1',
        title: 'Sistemas usados hoje',
        fields: [{ kind: 'multi', id: '2.1', options: CURRENT_SYSTEMS }],
      },
      {
        id: '2.2',
        number: '2.2',
        title: 'O que os sistemas atuais fazem bem, e o que mais incomoda?',
        fields: [
          {
            kind: 'multi', id: '2.2.bem', label: 'Fazem bem', other: { label: 'Outro', prompt: 'O quê?' }, options: [
              { value: 'relatorios', label: 'Relatórios' },
              { value: 'balcao', label: 'Rapidez no balcão' },
              { value: 'financeiro', label: 'Controle financeiro' },
              { value: 'historico', label: 'Histórico do cliente' },
            ],
          },
          { kind: 'multi', id: '2.2.incomoda', label: 'Mais incomoda', other: { label: 'Outro', prompt: 'O quê?' }, options: PAIN_POINTS },
          {
            kind: 'multi',
            id: '2.2.digitacao',
            label: 'O que é digitado em mais de um sistema?',
            other: { label: 'Outro', prompt: 'O quê?' },
            when: (answers) => selected(answers, '2.2.incomoda').includes('digitacao'),
            options: [
              { value: 'clientes', label: 'Cadastro de clientes' },
              { value: 'kits', label: 'Itens e kits' },
              { value: 'ciclo', label: 'Dados do ciclo' },
              { value: 'medicao', label: 'Medição para faturamento' },
              { value: 'os', label: 'Ordem de serviço' },
            ],
          },
        ],
      },
      {
        id: '2.3',
        number: '2.3',
        title: 'O novo sistema deve',
        fields: [
          {
            kind: 'single', id: '2.3', options: [
              { value: 'todos', label: 'Substituir todos' },
              { value: 'alguns', label: 'Substituir alguns' },
              { value: 'integrar', label: 'Integrar com os atuais' },
            ],
          },
          {
            kind: 'multi',
            id: '2.3.quais',
            label: 'Quais devem ser substituídos?',
            options: CURRENT_SYSTEMS,
            when: equals('2.3', 'alguns'),
            filterOptions: (options, answers) => {
              const used = new Set(selected(answers, '2.1'))
              return used.size > 0 ? options.filter((option) => used.has(option.value)) : options
            },
          },
          {
            kind: 'multi',
            id: '2.3.migrar',
            label: 'O que precisa vir dos sistemas atuais?',
            other: { label: 'Outro', prompt: 'O quê?' },
            when: replacesSystems,
            options: [
              { value: 'clientes', label: 'Cadastro de clientes' },
              { value: 'contratos', label: 'Contratos e tabelas de preço' },
              { value: 'kits', label: 'Catálogo de kits' },
              { value: 'historico', label: 'Histórico de ciclos e rastreabilidade' },
              { value: 'financeiro', label: 'Financeiro em aberto' },
            ],
          },
          {
            kind: 'single',
            id: '2.3.historico',
            label: 'Quanto histórico levar?',
            when: replacesSystems,
            options: [
              { value: 'sem-historico', label: 'Só os cadastros, sem histórico' },
              { value: '1-ano', label: 'Último ano' },
              { value: 'ate-5-anos', label: 'Até 5 anos' },
              { value: 'tudo', label: 'Todo o histórico' },
            ],
          },
        ],
      },
      {
        id: '2.4',
        number: '2.4',
        title: 'Outros sistemas em uso',
        help: 'Além dos da 2.1. O novo sistema pode precisar conversar com eles.',
        fields: [
          {
            kind: 'multi', id: '2.4', options: [
              { value: 'contabil', label: 'Contábil' },
              { value: 'nota-fiscal', label: 'Nota fiscal' },
              { value: 'ponto', label: 'Ponto' },
            ],
          },
          { kind: 'text', id: '2.4.nomes', label: 'Nomes dos sistemas ou fornecedores', placeholder: 'Ex.: Domínio, NFE.io, Secullum' },
        ],
      },
      {
        id: '2.5',
        number: '2.5',
        title: 'Os esterilizadores exportam dados dos ciclos?',
        help: 'Se exportarem arquivo, o sistema pode importar os ciclos sem digitação. Marcas e modelos vão na lista de equipamentos da etapa 9.',
        fields: [{
          kind: 'single', id: '2.5', options: [
            { value: 'arquivo', label: 'Sim, em arquivo' },
            { value: 'impressao', label: 'Só impressão' },
            { value: 'nao', label: 'Não' },
          ],
        }],
      },
      {
        id: '2.6',
        number: '2.6',
        title: 'Equipamentos disponíveis na operação',
        fields: [{
          kind: 'multi', id: '2.6', other: { label: 'Outro', prompt: 'Qual equipamento?' }, options: [
            { value: 'computadores', label: 'Computadores' },
            { value: 'moveis', label: 'Tablets/celulares' },
            { value: 'leitor', label: 'Leitor de código de barras' },
            { value: 'impressora', label: 'Impressora de etiquetas' },
          ],
        }],
      },
      {
        id: '2.7',
        number: '2.7',
        title: 'Internet em cada unidade',
        help: 'Depende do local; é o que decide se o sistema precisa funcionar sem conexão.',
        fields: [{
          kind: 'single', id: '2.7', perUnit: true, options: [
            { value: 'estavel', label: 'Estável' },
            { value: 'instavel', label: 'Instável' },
            { value: 'offline', label: 'Precisa funcionar sem internet' },
          ],
        }],
      },
      {
        id: '2.8',
        number: '2.8',
        title: 'Hospedagem preferida para o novo sistema',
        fields: [{
          kind: 'single', id: '2.8', options: [
            { value: 'nuvem', label: 'Nuvem' },
            { value: 'servidor', label: 'Servidor central próprio' },
            { value: 'indiferente', label: 'Sem preferência' },
          ],
        }],
      },
    ],
  },
  {
    id: 'rastreabilidade',
    number: '3',
    title: 'Rastreabilidade e qualidade',
    intro: 'Até onde cada material precisa ser rastreado, como a qualidade é comprovada hoje e por quanto tempo os registros ficam guardados.',
    blocks: [
      {
        id: '3.1',
        number: '3.1',
        title: 'Até onde a rastreabilidade precisa chegar',
        help: 'Cada nível inclui os anteriores: rastrear o item individual também rastreia o kit e o lote.',
        fields: [
          {
            kind: 'single', id: '3.1', layout: 'scale', options: [
              { value: 'lote', label: 'Lote' },
              { value: 'kit', label: 'Kit/caixa' },
              { value: 'item', label: 'Item individual' },
              { value: 'paciente', label: 'Paciente', hint: 'via cliente' },
            ],
          },
          {
            kind: 'text',
            id: '3.1.sistemas',
            label: 'Com quais sistemas dos hospitais o novo sistema precisa conversar?',
            multiline: true,
            when: equals('3.1', 'paciente'),
            placeholder: 'Ex.: sistema de gestão hospitalar do cliente',
            suggestions: ['MV', 'Tasy', 'Sistema próprio do hospital', 'Ainda não sabemos'],
          },
        ],
      },
      {
        id: '3.2',
        number: '3.2',
        title: 'Identificação usada hoje',
        fields: [{
          kind: 'multi', id: '3.2', other: { label: 'Outra', prompt: 'Qual identificação?' }, options: [
            { value: 'manual', label: 'Etiqueta manual' },
            { value: 'barras', label: 'Código de barras' },
            { value: 'qr', label: 'QR code' },
            { value: 'gravacao', label: 'Gravação no instrumental' },
          ],
        }],
      },
      {
        id: '3.3',
        number: '3.3',
        title: 'Indicadores usados nos ciclos',
        fields: [{
          kind: 'multi', id: '3.3', other: { label: 'Outro', prompt: 'Qual indicador?' }, options: [
            { value: 'quimico', label: 'Químico' },
            { value: 'biologico', label: 'Biológico' },
            { value: 'integrador', label: 'Integrador' },
            { value: 'bowie-dick', label: 'Bowie & Dick' },
          ],
        }],
      },
      {
        id: '3.4',
        number: '3.4',
        title: 'Quem libera o lote, e depois de quais resultados?',
        fields: [
          {
            kind: 'single', id: '3.4.quem', label: 'Quem libera', other: { label: 'Outro', prompt: 'Quem?' }, options: [
              { value: 'rt', label: 'RT da unidade' },
              { value: 'qualidade', label: 'Supervisor da qualidade' },
              { value: 'operador', label: 'Operador' },
            ],
          },
          {
            kind: 'multi', id: '3.4.apos', label: 'Depois de quais resultados', other: { label: 'Outro', prompt: 'Qual resultado?' }, options: [
              { value: 'fim-ciclo', label: 'Fim do ciclo' },
              { value: 'quimico', label: 'Indicador químico' },
              { value: 'integrador', label: 'Integrador' },
              { value: 'biologico', label: 'Indicador biológico' },
            ],
          },
        ],
      },
      {
        id: '3.5',
        number: '3.5',
        title: 'Como são registradas hoje as não conformidades e os recolhimentos de material?',
        fields: [{
          kind: 'multi', id: '3.5', other: { label: 'Outra', prompt: 'Como?' }, options: [
            { value: 'planilha', label: 'Planilha compartilhada' },
            { value: 'livro', label: 'Livro de ocorrências' },
            { value: 'papel', label: 'Formulário em papel' },
            { value: 'email', label: 'E-mail ao cliente' },
            { value: 'sem-registro', label: 'Não há registro formal' },
          ],
        }],
      },
      {
        id: '3.6',
        number: '3.6',
        title: 'Registros mais pedidos em auditorias',
        help: 'ONA, vigilância sanitária ou auditorias de clientes.',
        fields: [{
          kind: 'multi', id: '3.6', other: { label: 'Outro', prompt: 'Qual registro?' }, options: [
            { value: 'ciclo', label: 'Registros de ciclo' },
            { value: 'laudos-biologico', label: 'Laudos de indicador biológico' },
            { value: 'treinamentos', label: 'Treinamentos' },
            { value: 'calibracao', label: 'Calibração dos equipamentos' },
            { value: 'rastreabilidade', label: 'Rastreabilidade por lote' },
            { value: 'pops', label: 'POPs' },
          ],
        }],
      },
      {
        id: '3.7',
        number: '3.7',
        title: 'Por quanto tempo os registros precisam ficar guardados?',
        help: 'Pense em auditorias, contratos com clientes e LGPD.',
        fields: [{
          kind: 'single', id: '3.7', options: [
            { value: '2-anos', label: '2 anos' },
            { value: '5-anos', label: '5 anos' },
            { value: '10-anos', label: '10 anos' },
            { value: 'mais-10', label: 'Mais de 10 anos' },
            { value: 'nao-sei', label: 'Não sei' },
          ],
        }],
      },
    ],
  },
  {
    id: 'clientes',
    number: '4',
    title: 'Clientes, logística e faturamento',
    intro: 'Quem são os clientes, como o material chega e volta, e como a Steriliza cobra.',
    blocks: [
      {
        id: '4.1',
        number: '4.1',
        title: 'Tipos de cliente atendidos',
        fields: [{
          kind: 'multi', id: '4.1', other: { label: 'Outro', prompt: 'Qual tipo de cliente?' }, options: [
            { value: 'hospital-publico', label: 'Hospital público' },
            { value: 'hospital-privado', label: 'Hospital privado' },
            { value: 'clinica', label: 'Clínica' },
            { value: 'consultorio', label: 'Consultório' },
            { value: 'industria', label: 'Indústria/distribuidor' },
          ],
        }],
      },
      {
        id: '4.2',
        number: '4.2',
        title: 'Coleta e entrega',
        fields: [{
          kind: 'multi', id: '4.2', other: { label: 'Outra', prompt: 'Como funciona?' }, options: [
            { value: 'propria', label: 'Frota própria' },
            { value: 'terceirizada', label: 'Terceirizada' },
            { value: 'cliente', label: 'Cliente leva e busca' },
          ],
        }],
      },
      {
        id: '4.3',
        number: '4.3',
        title: 'Como o cliente pede uma coleta hoje?',
        fields: [
          {
            kind: 'multi', id: '4.3', other: { label: 'Outro', prompt: 'Qual canal?' }, options: [
              { value: 'telefone', label: 'Telefone' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'email', label: 'E-mail' },
              { value: 'agenda', label: 'Agenda fixa' },
            ],
          },
          {
            kind: 'text', id: '4.3.detalhes', label: 'Detalhes', multiline: true, placeholder: 'Quem recebe o pedido, com quanta antecedência, como é confirmado',
            suggestions: ['Cliente liga na recepção', 'Agenda fixa semanal', 'Pedido por WhatsApp com foto', 'Confirmação por e-mail'],
          },
        ],
      },
      {
        id: '4.4',
        number: '4.4',
        title: 'Base de cobrança',
        fields: [
          {
            kind: 'multi', id: '4.4', other: { label: 'Outra', prompt: 'Qual base? Ex.: pacote mensal fixo' }, options: [
              { value: 'item', label: 'Item' },
              { value: 'kit', label: 'Kit/caixa' },
              { value: 'volume', label: 'Peso ou volume (kg, m³)' },
              { value: 'ciclo', label: 'Ciclo' },
            ],
          },
        ],
      },
      {
        id: '4.5',
        number: '4.5',
        title: 'Periodicidade do faturamento e documentos que acompanham',
        fields: [
          {
            kind: 'single', id: '4.5.periodicidade', label: 'Periodicidade', other: { label: 'Outra', prompt: 'Qual periodicidade?' }, options: [
              { value: 'semanal', label: 'Semanal' },
              { value: 'quinzenal', label: 'Quinzenal' },
              { value: 'mensal', label: 'Mensal' },
            ],
          },
          {
            kind: 'multi', id: '4.5.documentos', label: 'Documentos que acompanham', other: { label: 'Outro', prompt: 'Qual documento?' }, options: [
              { value: 'medicao', label: 'Medição' },
              { value: 'relatorio', label: 'Relatório' },
              { value: 'nota-fiscal', label: 'Nota fiscal' },
            ],
          },
          {
            kind: 'text', id: '4.5.obs', label: 'Observações', multiline: true, placeholder: 'Ex.: medição fecha dia 25, nota até dia 5',
            suggestions: ['Medição fecha dia 25', 'Nota fiscal até dia 5', 'Cliente confere a medição antes da nota'],
          },
        ],
      },
      {
        id: '4.6',
        number: '4.6',
        title: 'Clientes públicos exigem relatório ou formato específico?',
        fields: [
          { kind: 'single', id: '4.6', options: YES_NO },
          {
            kind: 'text', id: '4.6.quais', label: 'Quais?', multiline: true, when: equals('4.6', 'sim'), placeholder: 'Ex.: relatório mensal por setor no modelo da secretaria',
            suggestions: ['Relatório mensal por setor', 'Planilha de medição própria', 'Modelo da secretaria de saúde'],
          },
        ],
      },
    ],
  },
  {
    id: 'modulos',
    number: '5',
    title: 'Módulos e prioridades',
    intro: 'Escolha a prioridade de cada módulo para a Steriliza. Isso define o que entra na primeira entrega.',
    blocks: [
      {
        id: 'modulos',
        title: 'Prioridade de cada módulo',
        help: 'Toque no nível desejado em cada linha.',
        fields: [{
          kind: 'matrix',
          id: 'modulos',
          items: MODULES,
          levels: PRIORITY_LEVELS,
          itemNoun: 'módulos',
          warn: {
            level: 'alta',
            max: HIGH_PRIORITY_SOFT_LIMIT,
            message: (count) =>
              `${count} módulos em prioridade alta. Com tudo urgente, a primeira entrega fica grande e demora mais — tente manter até ${HIGH_PRIORITY_SOFT_LIMIT}.`,
          },
        }],
      },
    ],
  },
  {
    id: 'acesso',
    number: '6',
    title: 'Acesso e segurança',
    intro: 'Quem vai usar o sistema, como cada etapa é assinada e quais dados pessoais passam por ele.',
    blocks: [
      {
        id: '6.1',
        number: '6.1',
        title: 'Perfis de usuário necessários',
        fields: [{
          kind: 'multi', id: '6.1', other: { label: 'Outro', prompt: 'Qual perfil?' }, options: [
            { value: 'recepcao', label: 'Recepção' },
            { value: 'preparo', label: 'Preparo' },
            { value: 'operador', label: 'Operador' },
            { value: 'qualidade', label: 'Qualidade/RT' },
            { value: 'logistica', label: 'Logística' },
            { value: 'comercial', label: 'Comercial' },
            { value: 'financeiro', label: 'Financeiro' },
            { value: 'diretoria', label: 'Diretoria' },
            { value: 'cliente', label: 'Cliente' },
          ],
        }],
      },
      {
        id: '6.2',
        number: '6.2',
        title: 'Como registrar quem executou cada etapa',
        fields: [{
          kind: 'multi', id: '6.2', other: { label: 'Outra', prompt: 'Qual forma?' }, options: [
            { value: 'senha', label: 'Login e senha' },
            { value: 'assinatura', label: 'Assinatura eletrônica' },
            { value: 'cracha', label: 'Crachá com código de barras' },
          ],
        }],
      },
      {
        id: '6.3',
        number: '6.3',
        title: 'Quantas pessoas usam o sistema ao mesmo tempo, no horário de pico?',
        help: 'Somando todas as unidades. Uma estimativa basta.',
        fields: [{
          kind: 'single', id: '6.3', options: [
            { value: 'ate-10', label: 'Até 10' },
            { value: '11-30', label: '11 a 30' },
            { value: '31-60', label: '31 a 60' },
            { value: 'mais-60', label: 'Mais de 60' },
            { value: 'nao-sei', label: 'Não sei' },
          ],
        }],
      },
      {
        id: '6.4',
        number: '6.4',
        title: 'Quais dados pessoais são tratados, e quem responde pela LGPD?',
        fields: [
          {
            kind: 'multi', id: '6.4', label: 'Dados pessoais tratados', options: [
              { value: 'pacientes', label: 'Pacientes' },
              { value: 'funcionarios', label: 'Funcionários' },
            ],
          },
          { kind: 'text', id: '6.4.responsavel', label: 'Responsável pela LGPD', placeholder: 'Nome e cargo' },
        ],
      },
    ],
  },
  {
    id: 'multiunidade',
    number: '7',
    title: 'Operação multiunidade',
    intro: 'Como as unidades convivem no mesmo sistema: o que é comum a todas, o que é de cada uma e quem enxerga o quê.',
    blocks: [
      {
        id: '7.1',
        number: '7.1',
        title: 'O que é comum a todas as unidades e o que é de cada uma?',
        help: 'Vale para cadastros e configurações. Ex.: se um hospital é cliente de duas unidades, o cadastro pode ser único ou um em cada unidade.',
        fields: [{ kind: 'matrix', id: '7.1', items: SHARED_ITEMS, levels: SHARING_LEVELS, itemNoun: 'itens' }],
      },
      {
        id: '7.2',
        number: '7.2',
        title: 'Há usuários que atuam em mais de uma unidade?',
        help: 'Ex.: RT que cobre duas unidades, motorista compartilhado, equipe administrativa central.',
        fields: [{ kind: 'single', id: '7.2', options: YES_NO }],
      },
      {
        id: '7.3',
        number: '7.3',
        title: 'Quem precisa ver os dados de todas as unidades juntas?',
        help: 'Os demais usuários enxergam só a própria unidade.',
        fields: [{
          kind: 'multi', id: '7.3', other: { label: 'Outro', prompt: 'Quem?' }, options: [
            { value: 'diretoria', label: 'Diretoria' },
            { value: 'qualidade', label: 'Qualidade corporativa' },
            { value: 'financeiro', label: 'Financeiro' },
            { value: 'comercial', label: 'Comercial' },
            { value: 'logistica', label: 'Logística' },
          ],
        }],
      },
      {
        id: '7.4',
        number: '7.4',
        title: 'Um mesmo cliente é atendido por mais de uma unidade?',
        fields: [
          { kind: 'single', id: '7.4', options: YES_NO },
          {
            kind: 'text', id: '7.4.como', label: 'Como funciona hoje?', multiline: true, when: equals('7.4', 'sim'), placeholder: 'Ex.: rede hospitalar com filiais em São Luís e Teresina, contrato único',
            suggestions: ['Contrato único, entrega por unidade', 'Contratos separados por unidade', 'Faturamento centralizado'],
          },
        ],
      },
      {
        id: '7.5',
        number: '7.5',
        title: 'Material de uma unidade é processado em outra?',
        help: 'Ex.: carga enviada a outra unidade por sobrecarga ou manutenção de equipamento.',
        fields: [
          { kind: 'single', id: '7.5', options: YES_NO },
          {
            kind: 'text', id: '7.5.como', label: 'Entre quais unidades e em que situação?', multiline: true, when: equals('7.5', 'sim'),
            suggestions: ['Sobrecarga ou manutenção', 'Urgência do cliente', 'Método disponível só em uma unidade'],
          },
        ],
      },
      {
        id: '7.6',
        number: '7.6',
        title: 'Cada unidade emite nota fiscal com CNPJ próprio?',
        fields: [{
          kind: 'single', id: '7.6', options: [
            { value: 'todas', label: 'Sim, todas' },
            { value: 'unico', label: 'Não, CNPJ único' },
            { value: 'depende', label: 'Depende da unidade' },
          ],
        }],
      },
      {
        id: '7.7',
        number: '7.7',
        title: 'Há previsão de novas unidades?',
        help: 'Ajuda a planejar como uma unidade nova entra no sistema.',
        fields: [
          {
            kind: 'single', id: '7.7', options: [
              { value: 'proximo-ano', label: 'Sim, nos próximos 12 meses' },
              { value: 'sem-data', label: 'Sim, sem data definida' },
              { value: 'nao', label: 'Não' },
            ],
          },
          {
            kind: 'text',
            id: '7.7.onde',
            label: 'Onde?',
            placeholder: 'Cidades ou regiões previstas',
            when: oneOf('7.7', ['proximo-ano', 'sem-data']),
          },
        ],
      },
    ],
  },
  {
    id: 'projeto',
    number: '8',
    title: 'Projeto',
    intro: 'Urgências, prazos, orçamento e quem decide. Isso orienta o plano de entrega.',
    blocks: [
      {
        id: '8.1',
        number: '8.1',
        title: 'Os três problemas mais urgentes que o sistema deve resolver',
        help: 'Em ordem: o primeiro é o mais urgente. As sugestões começam pelo que você marcou como incômodo na 2.2.',
        fields: [{
          kind: 'ranked', id: '8.1', count: 3, placeholders: [
            'Ex.: não conseguimos rastrear um kit até o cliente',
            'Ex.: cada unidade controla tudo em planilhas diferentes',
            'Ex.: faturamento é montado à mão todo mês',
          ],
          suggestions: urgentProblems,
        }],
      },
      {
        id: '8.2',
        number: '8.2',
        title: 'A implantação começa por uma unidade piloto?',
        help: 'Começar por uma unidade reduz o risco; as demais entram depois. O que entra na primeira entrega já vem das prioridades da etapa 5.',
        fields: [{
          kind: 'single',
          id: '8.2',
          options: [
            ...UNITS.map((unit): Option => ({ value: unit.id, label: `Sim: ${unit.city}` })),
            { value: 'todas', label: 'Não, todas juntas' },
            { value: 'a-definir', label: 'Ainda não definido' },
          ],
          // Só as unidades que o sistema vai atender podem ser piloto.
          filterOptions: (options, answers) => {
            const units: readonly string[] = selectedUnits(answers)
            return options.filter((option) => !isUnitId(option.value) || units.includes(option.value))
          },
        }],
      },
      {
        id: '8.3',
        number: '8.3',
        title: 'Há prazo ou data importante?',
        fields: [
          { kind: 'single', id: '8.3', options: YES_NO },
          { kind: 'text', id: '8.3.data', label: 'Data', inputType: 'date', when: equals('8.3', 'sim') },
          {
            kind: 'text', id: '8.3.motivo', label: 'O que acontece nessa data?', when: equals('8.3', 'sim'), placeholder: 'Ex.: auditoria ONA, início de contrato, renovação de licença',
            suggestions: ['Auditoria ONA', 'Início de contrato', 'Renovação de licença', 'Fim do contrato do sistema atual'],
          },
        ],
      },
      {
        id: '8.4',
        number: '8.4',
        title: 'Modelo de contratação e faixa de orçamento',
        fields: [
          {
            kind: 'single', id: '8.4', label: 'Modelo', other: { label: 'Outro', prompt: 'Qual modelo?' }, options: [
              { value: 'fechado', label: 'Projeto fechado' },
              { value: 'mensalidade', label: 'Mensalidade' },
              { value: 'equipe', label: 'Equipe dedicada' },
            ],
          },
          {
            kind: 'single',
            id: '8.4.projeto',
            label: 'Faixa de orçamento do projeto',
            other: BUDGET_OTHER,
            when: (answers) => answers['8.4'] === 'fechado' || isOtherValue(String(answers['8.4'] ?? '')),
            options: [
              { value: 'ate-100k', label: 'Até R$ 100 mil' },
              { value: '100-300k', label: 'R$ 100 a 300 mil' },
              { value: 'acima-300k', label: 'Acima de R$ 300 mil' },
              BUDGET_UNDEFINED,
            ],
          },
          {
            kind: 'single',
            id: '8.4.mensal',
            label: 'Faixa de orçamento por mês',
            other: BUDGET_OTHER,
            when: oneOf('8.4', ['mensalidade', 'equipe']),
            options: [
              { value: 'ate-5k', label: 'Até R$ 5 mil por mês' },
              { value: '5-15k', label: 'R$ 5 a 15 mil por mês' },
              { value: 'acima-15k', label: 'Acima de R$ 15 mil por mês' },
              BUDGET_UNDEFINED,
            ],
          },
        ],
      },
      {
        id: '8.5',
        number: '8.5',
        title: 'Quem decide e quem será o ponto focal',
        fields: [
          { kind: 'person', id: '8.5.decisor', label: 'Quem decide', canUseRespondent: true },
          { kind: 'person', id: '8.5.focal', label: 'Ponto focal', canUseRespondent: true },
        ],
      },
      {
        id: '8.6',
        number: '8.6',
        title: 'Como vão saber, em 6 meses, que o sistema deu certo?',
        fields: [{
          kind: 'text', id: '8.6', multiline: true, placeholder: 'Ex.: faturamento fechado em 2 dias, zero etiqueta manual, painel único das unidades',
          suggestions: ['Faturamento fechado em 2 dias', 'Zero etiqueta manual', 'Auditoria sem pendências', 'Painel único das unidades', 'Qualquer kit rastreado em 1 minuto'],
        }],
      },
    ],
  },
  {
    id: 'documentos',
    number: '9',
    title: 'Documentos para anexar',
    intro: 'Anexe aqui mesmo ou marque o que será enviado depois. Os arquivos vão juntos no pacote final.',
    blocks: [
      {
        id: 'documentos',
        title: 'Documentos das unidades',
        help: 'Se cada unidade tem o seu, anexe todos no mesmo item.',
        fields: [{ kind: 'documents', id: 'documentos', items: DOCUMENTS }],
      },
    ],
  },
]

export const REVIEW_STEP_ID = 'revisao'

export function getSection(id: string): Section | undefined {
  return SECTIONS.find((section) => section.id === id)
}

export function sectionIndex(id: string): number {
  return SECTIONS.findIndex((section) => section.id === id)
}

export const ALL_FIELDS: readonly Field[] = SECTIONS.flatMap((section) => section.blocks.flatMap((block) => block.fields))

const FIELD_BY_ID = new Map(ALL_FIELDS.map((field) => [field.id, field]))

export function getField(id: string): Field | undefined {
  return FIELD_BY_ID.get(id)
}
