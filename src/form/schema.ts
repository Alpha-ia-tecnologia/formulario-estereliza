import { MODULE_DETAILS_SECTION } from './moduleDetails'
import {
  CURRENT_SYSTEMS,
  CYCLE_EQUIPMENT,
  CYCLE_RECORD_LEVELS,
  HIGH_PRIORITY_SOFT_LIMIT,
  MODULES,
  PRIORITY_LEVELS,
  SHARED_ITEMS,
  SHARING_LEVELS,
  UNIT_OPTIONS,
  UNITS_FIELD_ID,
  WORKSTATIONS,
  WORKSTATION_LEVELS,
  YES_NO,
  hasHospitalUnit,
} from './options'
import type { Answers, Field, Option, Section } from './types'

const selected = (answers: Answers, id: string): readonly string[] => {
  const value = answers[id]
  return Array.isArray(value) ? value : []
}

const equals = (id: string, value: string) => (answers: Answers) => answers[id] === value
const oneOf = (id: string, values: readonly string[]) => (answers: Answers) => values.includes(String(answers[id] ?? ''))

/** O que mais incomoda nos sistemas atuais (2.2). */
const PAIN_POINTS: readonly Option[] = [
  { value: 'lentidao', label: 'Lentidão' },
  { value: 'digitacao', label: 'Digitação repetida entre sistemas' },
  { value: 'rastreabilidade', label: 'Falta de rastreabilidade' },
  { value: 'relatorios', label: 'Relatórios que faltam' },
  { value: 'falhas', label: 'Falhas frequentes' },
  { value: 'telas', label: 'Telas confusas' },
]

/** Etapas que podem precisar continuar funcionando sem internet (2.13). */
const OFFLINE_SCOPES: readonly Option[] = [
  { value: 'recebimento-preparo', label: 'Recebimento, limpeza e preparo' },
  { value: 'esterilizacao', label: 'Esterilização e registro de ciclo' },
  { value: 'liberacao', label: 'Liberação e etiquetas' },
  { value: 'expedicao', label: 'Expedição e conferência de saída' },
  { value: 'coleta', label: 'Coleta e entrega no celular do motorista' },
  { value: 'balcao', label: 'Balcão das unidades dentro de hospitais' },
  { value: 'consulta', label: 'Consulta de rastreabilidade' },
  { value: 'tudo', label: 'Tudo que a operação usa' },
  { value: 'nao-sei', label: 'Não sei' },
]

/** Substituir sistemas implica decidir o que migrar. */
const replacesSystems = oneOf('2.3', ['todos', 'alguns'])

const RAW_SECTIONS: readonly Section[] = [
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
        help: 'Todas vêm marcadas. A Unimed (Teresina) e o DOMU (São Luís) funcionam dentro dos hospitais e operam como uma unidade cada. Só a internet é perguntada unidade por unidade.',
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
        help: 'Além dos sistemas da primeira pergunta desta etapa. O novo sistema pode precisar conversar com eles.',
        fields: [
          {
            kind: 'multi', id: '2.4', other: { label: 'Outro', prompt: 'Qual sistema?' }, options: [
              { value: 'contabil', label: 'Contábil' },
              { value: 'nota-fiscal', label: 'Nota fiscal' },
              { value: 'ponto', label: 'Ponto' },
            ],
          },
        ],
      },
      {
        id: '2.5',
        number: '2.5',
        title: 'Como sai hoje o registro de ciclo de cada tipo de equipamento?',
        help: 'Define se o sistema importa os ciclos sozinho ou se alguém digita.',
        fields: [{ kind: 'matrix', id: '2.5.registro', items: CYCLE_EQUIPMENT, levels: CYCLE_RECORD_LEVELS, itemNoun: 'equipamentos' }],
      },
      {
        id: '2.6',
        number: '2.6',
        title: 'Hoje, com o que cada posto de trabalho registra o que faz?',
        help: 'Mostra onde faltam computador, leitor ou celular e que tipo de tela cada posto precisa.',
        fields: [{ kind: 'matrix', id: '2.6.postos', items: WORKSTATIONS, levels: WORKSTATION_LEVELS, itemNoun: 'postos' }],
      },
      {
        id: '2.7',
        number: '2.7',
        title: 'Internet em cada unidade',
        help: 'O sistema vai funcionar sem internet em todas as unidades; aqui queremos saber com que frequência isso vai acontecer.',
        fields: [{
          kind: 'single', id: '2.7', perUnit: true, options: [
            { value: 'estavel', label: 'Estável' },
            { value: 'instavel', label: 'Instável' },
            { value: 'offline', label: 'Sem internet boa parte do tempo' },
          ],
        }],
      },
      {
        id: '2.13',
        number: '2.13',
        title: 'O que precisa continuar funcionando sem internet?',
        help: 'O sistema vai rodar na nuvem e continuar operando quando a internet cair; ao voltar a conexão, os dados são sincronizados e a base fica sempre atualizada. Marque o que não pode esperar a internet voltar.',
        fields: [
          {
            kind: 'multi',
            id: '2.13',
            other: { label: 'Outro', prompt: 'O quê?' },
            options: OFFLINE_SCOPES,
            filterOptions: (options, answers) => (hasHospitalUnit(answers) ? options : options.filter((option) => option.value !== 'balcao')),
          },
          {
            kind: 'single', id: '2.13.tempo', label: 'Por quanto tempo, no máximo, uma unidade costuma ficar sem internet?', options: [
              { value: 'minutos', label: 'Minutos' },
              { value: 'horas', label: 'Algumas horas' },
              { value: '1dia', label: 'Até 1 dia' },
              { value: 'dias', label: 'Mais de 1 dia' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
        ],
      },
      {
        id: '2.9',
        number: '2.9',
        title: 'Com o que o novo sistema precisa trocar informações sem digitação?',
        fields: [{
          kind: 'multi', id: '2.9', other: { label: 'Outro', prompt: 'Com o quê?' }, options: [
            { value: 'contabilidade', label: 'Contabilidade' },
            { value: 'nota-fiscal', label: 'Emissão de nota fiscal' },
            { value: 'bancos', label: 'Bancos (boleto, Pix, extrato)' },
            { value: 'hospitais', label: 'Sistemas dos hospitais clientes' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'E-mail' },
            { value: 'ponto', label: 'Ponto e folha de pagamento' },
            { value: 'rastreador', label: 'Rastreador dos veículos (Cobli)' },
            { value: 'nao-sei', label: 'Não sei' },
          ],
        }],
      },
      {
        id: '2.12',
        number: '2.12',
        title: 'Integração com a Cobli, o rastreador dos veículos',
        help: 'A Cobli tem API: o módulo de rastreamento do novo sistema pode buscar os dados dela sem digitação.',
        fields: [
          {
            kind: 'multi', id: '2.12', label: 'O que o sistema deve buscar na Cobli?', other: { label: 'Outro', prompt: 'O quê?' }, options: [
              { value: 'posicao', label: 'Posição dos veículos em tempo real' },
              { value: 'rotas', label: 'Rotas e paradas de cada dia' },
              { value: 'chegada', label: 'Hora de chegada e de saída em cada cliente' },
              { value: 'previsao', label: 'Previsão de chegada para avisar o cliente' },
              { value: 'km', label: 'Quilometragem e consumo' },
              { value: 'motorista', label: 'Motorista de cada veículo' },
              { value: 'alertas', label: 'Alertas de desvio ou parada longa' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
          {
            kind: 'single', id: '2.12.frota', label: 'Quais veículos têm rastreador da Cobli?', options: [
              { value: 'todos', label: 'Todos' },
              { value: 'parte', label: 'Só parte da frota' },
              { value: 'nenhum', label: 'Nenhum ainda' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
        ],
      },
      {
        id: '2.10',
        number: '2.10',
        title: 'Se o sistema parar, por quanto tempo a operação aguenta sem ele?',
        fields: [
          {
            kind: 'single', id: '2.10', options: [
              { value: 'minutos', label: 'Não pode parar nem por minutos' },
              { value: '1h', label: 'Até 1 hora' },
              { value: '4h', label: 'Até 4 horas' },
              { value: '1dia', label: 'Até 1 dia' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
          {
            kind: 'single', id: '2.10.perda', label: 'Numa falha grave, quanto trabalho seria aceitável registrar de novo?', options: [
              { value: 'nenhum', label: 'Nenhum registro pode se perder' },
              { value: '1h', label: 'Até 1 hora de trabalho' },
              { value: '1dia', label: 'Até 1 dia de trabalho' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
        ],
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
      {
        id: '3.8',
        number: '3.8',
        title: 'A que licenças, normas e acreditações a Steriliza responde hoje?',
        fields: [{
          kind: 'multi', id: '3.8', other: { label: 'Outra', prompt: 'Qual?' }, options: [
            { value: 'licenca', label: 'Licença da vigilância sanitária' },
            { value: 'anvisa', label: 'Regras da ANVISA para processamento de produtos para saúde' },
            { value: 'ona', label: 'Acreditação ONA' },
            { value: 'iso-9001', label: 'ISO 9001' },
            { value: 'iso-13485', label: 'ISO 13485' },
            { value: 'em-preparacao', label: 'Em preparação para acreditação ou certificação' },
            { value: 'nao-sei', label: 'Não sei' },
          ],
        }],
      },
      {
        id: '3.9',
        number: '3.9',
        title: 'Quando um indicador biológico dá positivo ou um teste falha, o que acontece?',
        fields: [
          {
            kind: 'single', id: '3.9', label: 'O que é recolhido', options: [
              { value: 'carga', label: 'Só a carga testada' },
              { value: 'desde-ultimo', label: 'Todas as cargas do equipamento desde o último resultado aprovado' },
              { value: 'rt-decide', label: 'O RT decide caso a caso' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
          {
            kind: 'multi', id: '3.9.acoes', label: 'O que precisa ser feito', options: [
              { value: 'listar', label: 'Listar clientes, setores e kits afetados' },
              { value: 'bloquear', label: 'Bloquear no estoque o que ainda não saiu' },
              { value: 'avisar', label: 'Avisar os clientes' },
              { value: 'ciencia', label: 'Registrar a ciência e a devolução de cada cliente' },
              { value: 'relatorio', label: 'Gerar relatório do recolhimento' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
        ],
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
  MODULE_DETAILS_SECTION,
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
      {
        id: '6.5',
        number: '6.5',
        title: 'Quando alguém corrigir um registro já salvo, o que o sistema deve fazer?',
        fields: [{
          kind: 'single', id: '6.5', options: [
            { value: 'historico', label: 'Permitir, guardando o valor antigo, quem, quando e o motivo' },
            { value: 'qualidade', label: 'Só a qualidade ou o RT corrige, com motivo' },
            { value: 'supervisor', label: 'Só com aprovação do supervisor' },
            { value: 'anular', label: 'Não permitir: um novo registro anula o anterior' },
            { value: 'nao-sei', label: 'Não sei' },
          ],
        }],
      },
    ],
  },
  {
    id: 'multiunidade',
    number: '7',
    title: 'Operação multiunidade',
    intro: 'Como as unidades convivem no mesmo sistema: o que é comum a todas, o que é de cada uma, quem enxerga o quê e como entram as unidades dentro de hospitais.',
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
      {
        // Última pergunta da última etapa: quando fica oculta, não abre buraco na numeração.
        id: '7.8',
        number: '7.8',
        title: 'Unidades dentro de hospitais',
        help: 'A Unimed (Teresina) e o DOMU (São Luís) funcionam dentro dos hospitais, e cada uma opera como uma unidade. Hoje, nelas, a produção e o financeiro rodam no mesmo sistema do balcão.',
        fields: [
          {
            kind: 'multi',
            id: '7.8',
            label: 'O que o balcão faz hoje nessas unidades?',
            other: { label: 'Outro', prompt: 'O quê?' },
            when: hasHospitalUnit,
            options: [
              { value: 'recebe-devolve', label: 'Recebe e devolve o material' },
              { value: 'producao', label: 'Registra a produção' },
              { value: 'ciclos', label: 'Registra os ciclos' },
              { value: 'etiquetas', label: 'Imprime etiquetas' },
              { value: 'financeiro', label: 'Lança o financeiro' },
              { value: 'fatura', label: 'Fatura ao hospital' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
          {
            kind: 'single',
            id: '7.8.fluxo',
            label: 'No novo sistema, essas unidades precisam de',
            when: hasHospitalUnit,
            options: [
              { value: 'mesmo-fluxo', label: 'O mesmo fluxo das unidades próprias' },
              { value: 'fluxo-proprio', label: 'Um fluxo próprio' },
              { value: 'nao-sei', label: 'Não sei' },
            ],
          },
          {
            kind: 'text',
            id: '7.8.fluxo.oque',
            label: 'O que muda nessas unidades?',
            multiline: true,
            when: (answers) => hasHospitalUnit(answers) && answers['7.8.fluxo'] === 'fluxo-proprio',
            placeholder: 'Ex.: o balcão recebe, processa e devolve na hora, sem coleta',
            suggestions: ['Recebe e devolve na hora, sem coleta', 'Só o hospital como cliente', 'Faturamento direto ao hospital', 'Balcão, produção e financeiro numa tela só'],
          },
        ],
      },
    ],
  },
]

/**
 * A numeração exibida vem da posição: etapas e perguntas marcadas como numeradas
 * recebem números em sequência. Os ids das respostas são estáveis — tirar ou
 * incluir uma etapa não muda o significado do que já foi respondido.
 */
function numberSections(sections: readonly Section[]): readonly Section[] {
  let sectionCount = 0
  return sections.map((section) => {
    if (section.number === undefined) return section
    sectionCount += 1
    const number = String(sectionCount)
    let blockCount = 0
    return {
      ...section,
      number,
      blocks: section.blocks.map((block) => {
        if (block.number === undefined) return block
        blockCount += 1
        return { ...block, number: `${number}.${blockCount}` }
      }),
    }
  })
}

export const SECTIONS: readonly Section[] = numberSections(RAW_SECTIONS)

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
