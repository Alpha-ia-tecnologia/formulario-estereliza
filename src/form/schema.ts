import {
  CURRENT_SYSTEMS,
  DOCUMENTS,
  HIGH_PRIORITY_SOFT_LIMIT,
  MODULES,
  PRIORITY_LEVELS,
  SHARED_ITEMS,
  SHARING_LEVELS,
  UNIT_OPTIONS,
  UNITS_FIELD_ID,
  YES_NO,
  selectedUnits,
  unitKey,
} from './options'
import type { Answers, Field, Section } from './types'

const selected = (answers: Answers, id: string): readonly string[] => {
  const value = answers[id]
  return Array.isArray(value) ? value : []
}

const equals = (id: string, value: string) => (answers: Answers) => answers[id] === value

/** Sugere para a 8.2 os módulos marcados como prioridade alta na seção 5. */
function suggestFirstDelivery(answers: Answers) {
  const priorities = answers['modulos']
  if (!priorities || typeof priorities !== 'object' || Array.isArray(priorities)) return null
  const high = MODULES.filter((module) => (priorities as Record<string, string>)[module.key] === 'alta')
  if (high.length === 0) return null
  const names = high.map((module) => module.label).join(', ')
  return { label: `Usar os módulos de prioridade alta: ${names}`, value: names }
}

/** Sistemas marcados na 2.1 em qualquer unidade atendida. */
function systemsInUse(answers: Answers): ReadonlySet<string> {
  return new Set(selectedUnits(answers).flatMap((unit) => selected(answers, unitKey('2.1', unit))))
}

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
        help: 'Todas vêm marcadas. Onde a operação muda de uma unidade para outra, o formulário pergunta unidade por unidade.',
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
    intro: 'Um retrato de cada unidade hoje: métodos, volume, horários e equipe. Responda linha a linha, por unidade.',
    blocks: [
      {
        id: '1.1',
        number: '1.1',
        title: 'Métodos oferecidos em cada unidade',
        fields: [{
          kind: 'multi', id: '1.1', perUnit: true, other: { label: 'Outro', prompt: 'Qual método?' }, options: [
            { value: 'eto', label: 'Óxido de etileno' },
            { value: 'vapor', label: 'Vapor' },
            { value: 'peroxido', label: 'Peróxido de hidrogênio' },
          ],
        }],
      },
      {
        id: '1.2',
        number: '1.2',
        title: 'Volume médio mensal',
        help: 'Números aproximados já ajudam a dimensionar o sistema.',
        fields: [{
          kind: 'numberGrid', id: '1.2', perUnit: true, suffix: 'por mês', items: [
            { key: 'itens', label: 'Itens ou kits' },
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
          kind: 'single', id: '1.3', perUnit: true, other: { label: 'Outro', prompt: 'Qual horário?' }, options: [
            { value: 'comercial', label: 'Comercial' },
            { value: 'turnos', label: 'Turnos' },
            { value: '24h', label: '24 horas' },
          ],
        }],
      },
      {
        id: '1.4',
        number: '1.4',
        title: 'Funcionários por área',
        fields: [{
          kind: 'numberGrid', id: '1.4', perUnit: true, totalLabel: 'Total', suffix: 'pessoas', items: [
            { key: 'recepcao', label: 'Recepção' },
            { key: 'preparo', label: 'Preparo' },
            { key: 'esterilizacao', label: 'Esterilização' },
            { key: 'qualidade', label: 'Qualidade' },
            { key: 'logistica', label: 'Logística' },
            { key: 'administrativo', label: 'Administrativo' },
          ],
        }],
      },
      {
        id: '1.5',
        number: '1.5',
        title: 'A limpeza do material é feita pela Steriliza?',
        fields: [{
          kind: 'single', id: '1.5', perUnit: true, options: [
            { value: 'sempre', label: 'Sempre' },
            { value: 'depende', label: 'Depende do cliente' },
            { value: 'nunca', label: 'Nunca' },
          ],
        }],
      },
    ],
  },
  {
    id: 'sistemas',
    number: '2',
    title: 'Sistemas e infraestrutura',
    intro: 'Quais sistemas as unidades usam hoje, o que funciona, o que atrapalha e com que estrutura o novo sistema vai rodar.',
    blocks: [
      {
        id: '2.1',
        number: '2.1',
        title: 'Sistemas usados em cada unidade',
        fields: [{ kind: 'multi', id: '2.1', perUnit: true, options: CURRENT_SYSTEMS }],
      },
      {
        id: '2.2',
        number: '2.2',
        title: 'Quais informações precisam ser digitadas em mais de um sistema?',
        help: 'Retrabalho de digitação é um dos primeiros ganhos do sistema novo.',
        fields: [{
          kind: 'text', id: '2.2', multiline: true, placeholder: 'Ex.: o cadastro do cliente é feito no Balcão e de novo no Financeiro',
          suggestions: ['Cadastro de clientes', 'Itens e kits', 'Dados do ciclo', 'Medição para faturamento', 'Ordem de serviço'],
        }],
      },
      {
        id: '2.3',
        number: '2.3',
        title: 'O que os sistemas atuais fazem bem, e o que mais incomoda?',
        fields: [
          {
            kind: 'text', id: '2.3.bem', label: 'Fazem bem', multiline: true, placeholder: 'O que não pode se perder na troca',
            suggestions: ['Relatórios', 'Rapidez no balcão', 'Controle financeiro', 'Histórico do cliente'],
          },
          {
            kind: 'text', id: '2.3.incomoda', label: 'Mais incomoda', multiline: true, placeholder: 'Lentidão, falhas, telas confusas, relatórios que faltam…',
            suggestions: ['Lentidão', 'Digitação repetida', 'Sem rastreabilidade', 'Relatórios que faltam', 'Falhas frequentes', 'Telas confusas'],
          },
        ],
      },
      {
        id: '2.4',
        number: '2.4',
        title: 'O novo sistema deve',
        fields: [
          {
            kind: 'single', id: '2.4', options: [
              { value: 'todos', label: 'Substituir todos' },
              { value: 'alguns', label: 'Substituir alguns' },
              { value: 'integrar', label: 'Integrar com os atuais' },
            ],
          },
          {
            kind: 'multi',
            id: '2.4.quais',
            label: 'Quais devem ser substituídos?',
            options: CURRENT_SYSTEMS,
            when: equals('2.4', 'alguns'),
            filterOptions: (options, answers) => {
              const used = systemsInUse(answers)
              return used.size > 0 ? options.filter((option) => used.has(option.value)) : options
            },
          },
        ],
      },
      {
        id: '2.5',
        number: '2.5',
        title: 'Outros sistemas usados além desses cinco',
        fields: [
          {
            kind: 'multi', id: '2.5', options: [
              { value: 'contabil', label: 'Contábil' },
              { value: 'nota-fiscal', label: 'Nota fiscal' },
              { value: 'ponto', label: 'Ponto' },
            ],
          },
          { kind: 'text', id: '2.5.nomes', label: 'Nomes dos sistemas ou fornecedores', placeholder: 'Ex.: Domínio, NFE.io, Secullum' },
        ],
      },
      {
        id: '2.6',
        number: '2.6',
        title: 'Os esterilizadores exportam dados dos ciclos?',
        help: 'Se exportarem arquivo, o sistema pode importar os ciclos sem digitação.',
        fields: [
          {
            kind: 'single', id: '2.6', label: 'Exportação de dados', perUnit: true, options: [
              { value: 'arquivo', label: 'Sim, em arquivo' },
              { value: 'impressao', label: 'Só impressão' },
              { value: 'nao', label: 'Não' },
            ],
          },
          { kind: 'text', id: '2.6.modelos', label: 'Marcas e modelos', perUnit: true, placeholder: 'Ex.: Baumer HI VAC II 450 L; Cisa ETO 3000' },
        ],
      },
      {
        id: '2.7',
        number: '2.7',
        title: 'Equipamentos disponíveis na operação',
        fields: [{
          kind: 'multi', id: '2.7', perUnit: true, other: { label: 'Outro', prompt: 'Qual equipamento?' }, options: [
            { value: 'computadores', label: 'Computadores' },
            { value: 'moveis', label: 'Tablets/celulares' },
            { value: 'leitor', label: 'Leitor de código de barras' },
            { value: 'impressora', label: 'Impressora de etiquetas' },
          ],
        }],
      },
      {
        id: '2.8',
        number: '2.8',
        title: 'Internet em cada unidade',
        fields: [{
          kind: 'single', id: '2.8', perUnit: true, options: [
            { value: 'estavel', label: 'Estável' },
            { value: 'instavel', label: 'Instável' },
            { value: 'offline', label: 'Precisa funcionar sem internet' },
          ],
        }],
      },
      {
        id: '2.9',
        number: '2.9',
        title: 'Hospedagem preferida para o novo sistema',
        fields: [{
          kind: 'single', id: '2.9', options: [
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
    intro: 'Até onde cada material precisa ser rastreado e como a qualidade é comprovada hoje.',
    blocks: [
      {
        id: '3.1',
        number: '3.1',
        title: 'Até onde a rastreabilidade precisa chegar',
        help: 'Cada nível inclui os anteriores: rastrear o item individual também rastreia o kit e o lote.',
        fields: [{
          kind: 'single', id: '3.1', layout: 'scale', options: [
            { value: 'lote', label: 'Lote' },
            { value: 'kit', label: 'Kit/caixa' },
            { value: 'item', label: 'Item individual' },
            { value: 'paciente', label: 'Paciente', hint: 'via cliente' },
          ],
        }],
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
        fields: [{
          kind: 'text', id: '3.4', multiline: true, placeholder: 'Ex.: a RT de cada unidade libera após a leitura do indicador biológico',
          suggestions: ['RT libera após o indicador biológico', 'Supervisor da qualidade libera', 'Operador libera ao fim do ciclo', 'Depende do integrador químico'],
        }],
      },
      {
        id: '3.5',
        number: '3.5',
        title: 'Como são registradas hoje as não conformidades e os recolhimentos de material?',
        fields: [{
          kind: 'text', id: '3.5', multiline: true, placeholder: 'Ex.: planilha compartilhada, livro de ocorrências, e-mail ao cliente',
          suggestions: ['Planilha compartilhada', 'Livro de ocorrências', 'Formulário em papel', 'E-mail ao cliente', 'Não há registro formal'],
        }],
      },
      {
        id: '3.6',
        number: '3.6',
        title: 'Registros mais pedidos em auditorias',
        help: 'ONA, vigilância sanitária ou auditorias de clientes.',
        fields: [{
          kind: 'text', id: '3.6', multiline: true, placeholder: 'Ex.: registros de ciclo, laudos de indicador biológico, treinamentos',
          suggestions: ['Registros de ciclo', 'Laudos de indicador biológico', 'Treinamentos', 'Calibração dos equipamentos', 'Rastreabilidade por lote', 'POPs'],
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
              { value: 'volume', label: 'Volume' },
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
        title: 'Há usuários que atuam em mais de uma unidade?',
        help: 'Ex.: RT que cobre duas unidades, motorista compartilhado, equipe administrativa central.',
        fields: [{ kind: 'single', id: '6.2', options: YES_NO }],
      },
      {
        id: '6.3',
        number: '6.3',
        title: 'Como registrar quem executou cada etapa',
        fields: [{
          kind: 'multi', id: '6.3', other: { label: 'Outra', prompt: 'Qual forma?' }, options: [
            { value: 'senha', label: 'Login e senha' },
            { value: 'assinatura', label: 'Assinatura eletrônica' },
            { value: 'cracha', label: 'Crachá com código de barras' },
          ],
        }],
      },
      {
        id: '6.4',
        number: '6.4',
        title: 'Número aproximado de usuários ao mesmo tempo, somando todas as unidades',
        fields: [{ kind: 'number', id: '6.4', suffix: 'usuários', placeholder: '0' }],
      },
      {
        id: '6.5',
        number: '6.5',
        title: 'Quais dados pessoais são tratados, e quem responde pela LGPD?',
        fields: [
          {
            kind: 'multi', id: '6.5', label: 'Dados pessoais tratados', options: [
              { value: 'pacientes', label: 'Pacientes' },
              { value: 'funcionarios', label: 'Funcionários' },
            ],
          },
          { kind: 'text', id: '6.5.responsavel', label: 'Responsável pela LGPD', placeholder: 'Nome e cargo' },
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
        title: 'O que é comum a todas as unidades e o que é separado por unidade?',
        help: 'Ex.: se um hospital é cliente de duas unidades, o cadastro pode ser único ou um em cada unidade.',
        fields: [{ kind: 'matrix', id: '7.1', items: SHARED_ITEMS, levels: SHARING_LEVELS, itemNoun: 'itens' }],
      },
      {
        id: '7.2',
        number: '7.2',
        title: 'Quem precisa ver os dados de todas as unidades juntas?',
        help: 'Os demais usuários enxergam só a própria unidade.',
        fields: [{
          kind: 'multi', id: '7.2', other: { label: 'Outro', prompt: 'Quem?' }, options: [
            { value: 'diretoria', label: 'Diretoria' },
            { value: 'qualidade', label: 'Qualidade corporativa' },
            { value: 'financeiro', label: 'Financeiro' },
            { value: 'comercial', label: 'Comercial' },
            { value: 'logistica', label: 'Logística' },
          ],
        }],
      },
      {
        id: '7.3',
        number: '7.3',
        title: 'Um mesmo cliente é atendido por mais de uma unidade?',
        fields: [
          { kind: 'single', id: '7.3', options: YES_NO },
          {
            kind: 'text', id: '7.3.como', label: 'Como funciona hoje?', multiline: true, when: equals('7.3', 'sim'), placeholder: 'Ex.: rede hospitalar com filiais em São Luís e Teresina, contrato único',
            suggestions: ['Contrato único, entrega por unidade', 'Contratos separados por unidade', 'Faturamento centralizado'],
          },
        ],
      },
      {
        id: '7.4',
        number: '7.4',
        title: 'Material de uma unidade é processado em outra?',
        help: 'Ex.: carga enviada para a unidade que tem óxido de etileno.',
        fields: [
          { kind: 'single', id: '7.4', options: YES_NO },
          {
            kind: 'text', id: '7.4.como', label: 'Entre quais unidades e em que situação?', multiline: true, when: equals('7.4', 'sim'),
            suggestions: ['Óxido de etileno só existe em uma unidade', 'Sobrecarga ou manutenção', 'Urgência do cliente'],
          },
        ],
      },
      {
        id: '7.5',
        number: '7.5',
        title: 'Cada unidade emite nota fiscal com CNPJ próprio?',
        fields: [{
          kind: 'single', id: '7.5', options: [
            { value: 'todas', label: 'Sim, todas' },
            { value: 'unico', label: 'Não, CNPJ único' },
            { value: 'depende', label: 'Depende da unidade' },
          ],
        }],
      },
      {
        id: '7.6',
        number: '7.6',
        title: 'O que pode mudar de uma unidade para outra na configuração?',
        fields: [{
          kind: 'multi', id: '7.6', other: { label: 'Outro', prompt: 'O quê?' }, options: [
            { value: 'horarios', label: 'Horários e turnos' },
            { value: 'precos', label: 'Preços' },
            { value: 'etiqueta', label: 'Modelo de etiqueta' },
            { value: 'relatorios', label: 'Relatórios para clientes' },
            { value: 'liberacao', label: 'Fluxo de liberação de lote' },
            { value: 'documentos', label: 'Logo e dados nos documentos' },
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
            when: (answers) => typeof answers['7.7'] === 'string' && answers['7.7'] !== 'nao',
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
        help: 'Em ordem: o primeiro é o mais urgente.',
        fields: [{
          kind: 'ranked', id: '8.1', count: 3, placeholders: [
            'Ex.: não conseguimos rastrear um kit até o cliente',
            'Ex.: cada unidade controla tudo em planilhas diferentes',
            'Ex.: faturamento é montado à mão todo mês',
          ],
          suggestions: [
            'Rastreabilidade até o cliente',
            'Digitação repetida entre sistemas',
            'Faturamento manual',
            'Registros de ciclo em papel',
            'Falta de visão consolidada das unidades',
            'Não conformidades sem histórico',
          ],
        }],
      },
      {
        id: '8.2',
        number: '8.2',
        title: 'O que precisa estar na primeira entrega?',
        help: 'Vale dizer também se a primeira entrega começa por uma unidade piloto.',
        fields: [{ kind: 'text', id: '8.2', multiline: true, placeholder: 'Módulos ou funções sem os quais não dá para começar', suggest: suggestFirstDelivery }],
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
        title: 'Faixa de orçamento e modelo preferido',
        fields: [
          {
            kind: 'single', id: '8.4', label: 'Modelo', other: { label: 'Outro', prompt: 'Qual modelo?' }, options: [
              { value: 'fechado', label: 'Projeto fechado' },
              { value: 'mensalidade', label: 'Mensalidade' },
              { value: 'equipe', label: 'Equipe dedicada' },
            ],
          },
          {
            kind: 'text', id: '8.4.faixa', label: 'Faixa de orçamento', placeholder: 'Ex.: até R$ 200 mil, ou R$ 10 mil por mês',
            suggestions: ['Até R$ 100 mil', 'R$ 100 a 300 mil', 'Acima de R$ 300 mil', 'R$ 5 a 15 mil por mês'],
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
