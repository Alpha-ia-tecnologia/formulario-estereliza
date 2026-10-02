import { MODULES } from './options'
import type { Answers, Block, Field, Option, Section } from './types'

/**
 * Etapa de detalhes: perguntas de aprofundamento de cada módulo, que só aparecem
 * quando ele recebe prioridade Alta na etapa de módulos. Quem não marca um módulo como
 * Alta não vê as perguntas dele.
 */

const NAO_SEI: Option = { value: 'nao-sei', label: 'Não sei' }

const isHighPriority = (moduleKey: string) => (answers: Answers): boolean => {
  const priorities = answers['modulos']
  return typeof priorities === 'object' && priorities !== null && !Array.isArray(priorities)
    && (priorities as Readonly<Record<string, string>>)[moduleKey] === 'alta'
}

const moduleLabel = (moduleKey: string): string => MODULES.find((module) => module.key === moduleKey)?.label ?? moduleKey

/** Pergunta de um módulo: título com o nome do módulo e todos os campos condicionados à prioridade Alta. */
function detail(moduleKey: string, block: Block): Block {
  const isHigh = isHighPriority(moduleKey)
  return {
    ...block,
    title: `${moduleLabel(moduleKey)}: ${block.title}`,
    fields: block.fields.map((field): Field => {
      const own = field.when
      return { ...field, when: own ? (answers: Answers) => isHigh(answers) && own(answers) : isHigh }
    }),
  }
}

const BLOCKS: readonly Block[] = [
  detail('cadastros', {
    id: 'm.cadastros.1',
    title: 'Como está definida hoje a composição de cada kit?',
    fields: [{
      kind: 'multi', id: 'm.cadastros.1', options: [
        { value: 'planilha', label: 'Lista de peças em planilha' },
        { value: 'sistema', label: 'Lista no sistema atual' },
        { value: 'foto', label: 'Foto padrão do kit montado' },
        { value: 'padrao', label: 'Kits padronizados pela Steriliza' },
        { value: 'proprios', label: 'Cada cliente tem kits próprios' },
        { value: 'muda', label: 'A composição muda com frequência' },
        { value: 'sem-lista', label: 'Não há lista formal' },
        NAO_SEI,
      ],
    }],
  }),
  detail('coleta', {
    id: 'm.coleta.1',
    title: 'Como as coletas e rotas são programadas?',
    fields: [{
      kind: 'multi', id: 'm.coleta.1', options: [
        { value: 'fixa', label: 'Rota fixa: mesmos clientes nos mesmos dias' },
        { value: 'demanda', label: 'Sob demanda: o cliente pede' },
        { value: 'misto', label: 'Parte fixa, parte sob demanda' },
        { value: 'mesma-visita', label: 'Coleta e entrega na mesma visita' },
        { value: 'emergencia', label: 'Coleta extra de emergência' },
        NAO_SEI,
      ],
    }],
  }),
  detail('coleta', {
    id: 'm.coleta.2',
    title: 'O que o protocolo de coleta e entrega precisa registrar?',
    fields: [{
      kind: 'multi', id: 'm.coleta.2', options: [
        { value: 'volumes', label: 'Número de caixas ou volumes' },
        { value: 'kits', label: 'Lista dos kits' },
        { value: 'item-a-item', label: 'Conferência item a item na hora' },
        { value: 'assinatura', label: 'Nome e assinatura de quem entrega e de quem recebe' },
        { value: 'assinatura-tela', label: 'Assinatura na tela do celular' },
        { value: 'foto', label: 'Foto do material ou das caixas' },
        { value: 'lacre', label: 'Lacre numerado' },
        { value: 'gps', label: 'Localização (GPS)' },
        { value: 'sem-protocolo', label: 'Não há protocolo formal' },
      ],
    }],
  }),
  detail('frota', {
    id: 'm.frota.1',
    title: 'Quem acompanha os veículos, e o que o sistema deve avisar?',
    fields: [
      {
        kind: 'multi', id: 'm.frota.1', label: 'Quem acompanha', options: [
          { value: 'logistica', label: 'Logística, na tela do sistema' },
          { value: 'cliente', label: 'O cliente, no portal' },
          { value: 'gestor', label: 'Gestores, no painel de indicadores' },
          { value: 'motorista', label: 'O motorista, no celular' },
          NAO_SEI,
        ],
      },
      {
        kind: 'multi', id: 'm.frota.1.avisos', label: 'Avisar quando', options: [
          { value: 'atraso', label: 'A coleta ou a entrega atrasar' },
          { value: 'chegada', label: 'O veículo chegar ao cliente' },
          { value: 'parada', label: 'O veículo parar fora da rota' },
          { value: 'fim-rota', label: 'A rota do dia terminar' },
          { value: 'nao', label: 'Não precisa de avisos' },
        ],
      },
    ],
  }),
  detail('recebimento-preparo', {
    id: 'm.recebimento-preparo.1',
    title: 'Como o material é conferido quando chega?',
    fields: [{
      kind: 'multi', id: 'm.recebimento-preparo.1', options: [
        { value: 'caixas', label: 'Conta as caixas contra o protocolo' },
        { value: 'kit', label: 'Confere kit por kit' },
        { value: 'peca', label: 'Confere peça por peça com a lista do kit' },
        { value: 'amostragem', label: 'Por amostragem' },
        { value: 'presenca', label: 'Na frente do motorista ou do cliente' },
        { value: 'fotos', label: 'Tira fotos' },
        { value: 'sem-conferencia', label: 'Não há conferência formal' },
        NAO_SEI,
      ],
    }],
  }),
  detail('recebimento-preparo', {
    id: 'm.recebimento-preparo.2',
    title: 'O que a Steriliza faz em cada situação encontrada na chegada?',
    fields: [{
      kind: 'matrix',
      id: 'm.recebimento-preparo.2',
      itemNoun: 'situações',
      items: [
        { key: 'falta-peca', label: 'Falta peça no kit' },
        { key: 'peca-a-mais', label: 'Peça a mais ou de outro cliente' },
        { key: 'quebrado', label: 'Item quebrado ou com defeito' },
        { key: 'sujeira', label: 'Sujeira ressecada ou mal acondicionado' },
        { key: 'uso-unico', label: 'Item de uso único' },
        { key: 'sem-identificacao', label: 'Sem identificação do cliente' },
        { key: 'metodo', label: 'Não suporta o método pedido' },
      ],
      levels: [
        { value: 'processa', label: 'Processa e registra' },
        { value: 'avisa', label: 'Avisa e aguarda' },
        { value: 'devolve', label: 'Devolve sem processar' },
        { value: 'nao-sei', label: 'Não acontece / não sei' },
      ],
    }],
  }),
  detail('recebimento-preparo', {
    id: 'm.recebimento-preparo.3',
    title: 'Na montagem do kit, o que é conferido e registrado?',
    fields: [
      {
        kind: 'multi', id: 'm.recebimento-preparo.3', options: [
          { value: 'checklist', label: 'Check-list das peças' },
          { value: 'quem-montou', label: 'Quem montou' },
          { value: 'dupla', label: 'Uma segunda pessoa confere' },
          { value: 'foto', label: 'Foto do kit montado' },
          { value: 'teste', label: 'Teste de funcionamento de pinças e tesouras' },
          { value: 'lubrificacao', label: 'Lubrificação' },
          { value: 'indicador', label: 'Indicador químico dentro do pacote' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.recebimento-preparo.3.incompleto', label: 'Quando o kit está incompleto', options: [
          { value: 'completa', label: 'Completa com item da Steriliza' },
          { value: 'segue', label: 'Segue incompleto e avisa o cliente' },
          { value: 'retem', label: 'Fica retido até o cliente decidir' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('recebimento-preparo', {
    id: 'm.recebimento-preparo.4',
    title: 'Como é definido o prazo de validade do material esterilizado?',
    fields: [
      {
        kind: 'single', id: 'm.recebimento-preparo.4', options: [
          { value: 'unico', label: 'Prazo único para tudo' },
          { value: 'embalagem', label: 'Depende da embalagem' },
          { value: 'embalagem-metodo', label: 'Depende da embalagem e do método' },
          { value: 'cliente', label: 'Definido pelo cliente ou contrato' },
          { value: 'integridade', label: 'Vale enquanto a embalagem estiver íntegra' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.recebimento-preparo.4.vencido', label: 'Material vencido é reprocessado sem custo?', options: [
          { value: 'sim', label: 'Sim' },
          { value: 'cobrado', label: 'Não, é cobrado' },
          { value: 'contrato', label: 'Depende do contrato' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('esterilizacao', {
    id: 'm.esterilizacao.1',
    title: 'Quais dados de cada ciclo precisam ficar registrados?',
    fields: [
      {
        kind: 'multi', id: 'm.esterilizacao.1', options: [
          { value: 'equipamento', label: 'Equipamento e número do ciclo' },
          { value: 'programa', label: 'Programa usado' },
          { value: 'temperatura', label: 'Temperatura e pressão' },
          { value: 'tempo', label: 'Tempo de exposição' },
          { value: 'concentracao', label: 'Concentração do agente' },
          { value: 'inicio-fim', label: 'Início e fim' },
          { value: 'operador', label: 'Operador' },
          { value: 'conteudo', label: 'Conteúdo da carga' },
          { value: 'arquivo', label: 'Arquivo do equipamento anexado' },
          { value: 'interrompidos', label: 'Ciclos interrompidos e o motivo' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.esterilizacao.1.faixa', label: 'O sistema deve conferir sozinho se os parâmetros ficaram na faixa?', options: [
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não, uma pessoa confere' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('esterilizacao', {
    id: 'm.esterilizacao.2',
    title: 'Quando um ciclo falha, o que acontece?',
    fields: [{
      kind: 'multi', id: 'm.esterilizacao.2', options: [
        { value: 'reesteriliza', label: 'A carga volta para reembalar e reesterilizar' },
        { value: 'parado', label: 'O equipamento fica parado até novo teste' },
        { value: 'manutencao', label: 'Chama a manutenção' },
        { value: 'nc', label: 'Abre não conformidade' },
        { value: 'motivo', label: 'Registra o motivo' },
        NAO_SEI,
      ],
    }],
  }),
  detail('esterilizacao', {
    id: 'm.esterilizacao.3',
    title: 'Como funciona o óxido de etileno?',
    fields: [{
      kind: 'multi', id: 'm.esterilizacao.3', options: [
        { value: 'nao-usa', label: 'Não usamos óxido de etileno' },
        { value: 'camara', label: 'Aeração na própria câmara' },
        { value: 'aerador', label: 'Aerador ou sala separada' },
        { value: 'tempo-fixo', label: 'Tempo de aeração fixo' },
        { value: 'tempo-varia', label: 'O tempo varia por material' },
        { value: 'so-apos-aeracao', label: 'O material só sai depois do tempo registrado' },
        { value: 'lote-gas', label: 'Lote do cartucho ou cilindro registrado' },
        { value: 'monitoramento', label: 'Monitoramento do gás no ambiente' },
        NAO_SEI,
      ],
    }],
  }),
  detail('qualidade', {
    id: 'm.qualidade.1',
    title: 'Indicador biológico: com que frequência, e como é lido?',
    fields: [
      {
        kind: 'matrix',
        id: 'm.qualidade.1',
        itemNoun: 'métodos',
        items: [
          { key: 'vapor', label: 'Vapor' },
          { key: 'eto', label: 'Óxido de etileno' },
          { key: 'peroxido', label: 'Peróxido de hidrogênio' },
        ],
        levels: [
          { value: 'toda-carga', label: 'Toda carga' },
          { value: 'diario', label: 'Diário' },
          { value: 'semanal', label: 'Semanal' },
          { value: 'implante', label: 'Só com implante' },
          { value: 'nao-usa', label: 'Não usamos' },
        ],
      },
      {
        kind: 'single', id: 'm.qualidade.1.incubacao', label: 'Quem incuba', options: [
          { value: 'propria', label: 'Incubadora própria' },
          { value: 'laboratorio', label: 'Laboratório externo' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.qualidade.1.tempo', label: 'Em quanto tempo sai o resultado', options: [
          { value: '1h', label: 'Até 1 hora' },
          { value: '24h', label: 'Até 24 horas' },
          { value: '48h', label: '24 a 48 horas' },
          { value: 'mais', label: 'Mais de 48 horas' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('qualidade', {
    id: 'm.qualidade.2',
    title: 'O que uma não conformidade precisa ter até ser encerrada?',
    fields: [
      {
        kind: 'multi', id: 'm.qualidade.2', options: [
          { value: 'tipo', label: 'Tipo e gravidade' },
          { value: 'afetados', label: 'Etapa, cliente e lote afetados' },
          { value: 'fotos', label: 'Fotos' },
          { value: 'causa', label: 'Análise de causa' },
          { value: 'corretiva', label: 'Ação corretiva com responsável e prazo' },
          { value: 'eficacia', label: 'Verificação se funcionou' },
          { value: 'comunicacao', label: 'Comunicação ao cliente' },
          { value: 'sem-fluxo', label: 'Não há fluxo definido' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.qualidade.2.aprova', label: 'Quem aprova o encerramento', options: [
          { value: 'rt', label: 'RT da unidade' },
          { value: 'corporativa', label: 'Qualidade corporativa' },
          { value: 'gestor', label: 'Gestor' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('etiquetas', {
    id: 'm.etiquetas.1',
    title: 'O que a etiqueta do material precisa trazer?',
    fields: [{
      kind: 'multi', id: 'm.etiquetas.1', options: [
        { value: 'kit', label: 'Nome do kit ou item' },
        { value: 'cliente', label: 'Cliente e setor' },
        { value: 'data', label: 'Data da esterilização' },
        { value: 'validade', label: 'Data de validade' },
        { value: 'lote', label: 'Lote ou carga' },
        { value: 'ciclo', label: 'Equipamento e número do ciclo' },
        { value: 'metodo', label: 'Método' },
        { value: 'responsaveis', label: 'Quem preparou e quem conferiu' },
        { value: 'codigo', label: 'Código de barras ou QR code' },
        { value: 'prontuario', label: 'Via destacável para o prontuário' },
      ],
    }],
  }),
  detail('etiquetas', {
    id: 'm.etiquetas.2',
    title: 'Quando a etiqueta é colocada, e como o código é gerado?',
    fields: [
      {
        kind: 'single', id: 'm.etiquetas.2', label: 'Quando é colocada', options: [
          { value: 'preparo', label: 'No preparo, antes de esterilizar' },
          { value: 'liberacao', label: 'Depois da esterilização, na liberação' },
          { value: 'parte', label: 'Parte no preparo, parte depois' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.etiquetas.2.codigo', label: 'Como o número do código é gerado', options: [
          { value: 'sequencia', label: 'Sequência própria da Steriliza' },
          { value: 'cliente', label: 'Seguimos o código do cliente' },
          { value: 'gs1', label: 'Padrão GS1' },
          { value: 'sem-codigo', label: 'Ainda não usamos código' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('armazenamento', {
    id: 'm.armazenamento.1',
    title: 'Como o material estéril fica guardado até sair?',
    fields: [{
      kind: 'multi', id: 'm.armazenamento.1', options: [
        { value: 'mesmo-dia', label: 'Sai no mesmo dia, sem estoque' },
        { value: 'por-cliente', label: 'Separado por cliente' },
        { value: 'estoque-proprio', label: 'Estoque de kits da Steriliza para troca ou aluguel' },
        { value: 'posicoes', label: 'Posições identificadas nas prateleiras' },
        { value: 'dias', label: 'Material do cliente fica guardado por dias' },
        { value: 'ambiente', label: 'Temperatura e umidade registradas' },
        { value: 'inventario', label: 'Inventário periódico' },
        NAO_SEI,
      ],
    }],
  }),
  detail('armazenamento', {
    id: 'm.armazenamento.2',
    title: 'Como é feita a conferência de saída?',
    fields: [{
      kind: 'multi', id: 'm.armazenamento.2', options: [
        { value: 'romaneio', label: 'Romaneio em papel' },
        { value: 'leitura', label: 'Leitura do código de cada pacote' },
        { value: 'volumes', label: 'Contagem de volumes' },
        { value: 'motorista', label: 'Conferência com o motorista' },
        { value: 'lacre', label: 'Caixa lacrada' },
        { value: 'parcial', label: 'Entrega parcial, com pendência' },
        { value: 'vencidos', label: 'Recolhe vencidos ou violados na entrega' },
        { value: 'sem-conferencia', label: 'Não há conferência formal' },
        NAO_SEI,
      ],
    }],
  }),
  detail('manutencao', {
    id: 'm.manutencao.1',
    title: 'O que precisa ser controlado em cada equipamento?',
    fields: [
      {
        kind: 'multi', id: 'm.manutencao.1', options: [
          { value: 'preventivas', label: 'Preventivas com calendário' },
          { value: 'corretivas', label: 'Corretivas e tempo parado' },
          { value: 'calibracao', label: 'Calibração com certificado' },
          { value: 'qualificacao', label: 'Qualificação ou validação periódica' },
          { value: 'chamados', label: 'Chamados ao fabricante ou à terceirizada' },
          { value: 'custos', label: 'Peças e custos' },
          NAO_SEI,
        ],
      },
      {
        kind: 'multi', id: 'm.manutencao.1.qualificacao', label: 'Quem faz a qualificação', options: [
          { value: 'fabricante', label: 'Fabricante' },
          { value: 'contratada', label: 'Empresa contratada' },
          { value: 'propria', label: 'Equipe própria' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('manutencao', {
    id: 'm.manutencao.2',
    title: 'Como cada insumo precisa ser controlado?',
    fields: [{
      kind: 'matrix',
      id: 'm.manutencao.2',
      itemNoun: 'insumos',
      items: [
        { key: 'detergentes', label: 'Detergentes' },
        { key: 'embalagens', label: 'Embalagens' },
        { key: 'indicadores', label: 'Indicadores químicos e biológicos' },
        { key: 'agentes', label: 'Gás de óxido de etileno e cassete de peróxido' },
        { key: 'etiquetas', label: 'Etiquetas e ribbon' },
      ],
      levels: [
        { value: 'lote-ciclo', label: 'Lote ligado ao ciclo' },
        { value: 'lote-validade', label: 'Lote e validade' },
        { value: 'quantidade', label: 'Só quantidade' },
        { value: 'nao', label: 'Não controla' },
      ],
    }],
  }),
  detail('faturamento', {
    id: 'm.faturamento.1',
    title: 'Como o preço é formado?',
    fields: [
      {
        kind: 'multi', id: 'm.faturamento.1', label: 'Tabela de preços', options: [
          { value: 'padrao', label: 'Tabela padrão igual para todos' },
          { value: 'por-cliente', label: 'Tabela própria por cliente ou contrato' },
          { value: 'metodo', label: 'Preço diferente por método' },
          { value: 'kit', label: 'Preço por kit' },
          { value: 'avulso', label: 'Preço por item avulso' },
          { value: 'peso', label: 'Preço por peso ou volume' },
          { value: 'faixas', label: 'Faixas de quantidade' },
          NAO_SEI,
        ],
      },
      {
        kind: 'multi', id: 'm.faturamento.1.extras', label: 'Além de preço × quantidade', options: [
          { value: 'franquia', label: 'Valor mínimo mensal (franquia)' },
          { value: 'pacote', label: 'Pacote fixo com excedente' },
          { value: 'desconto', label: 'Desconto por volume' },
          { value: 'urgencia', label: 'Acréscimo por urgência' },
          { value: 'frete', label: 'Frete ou taxa por coleta' },
          { value: 'reprocessamento', label: 'Reprocessamento por falha do cliente' },
          { value: 'aluguel', label: 'Aluguel de instrumental da Steriliza' },
          { value: 'nada', label: 'Nada disso' },
        ],
      },
    ],
  }),
  detail('faturamento', {
    id: 'm.faturamento.2',
    title: 'Como a medição do mês é montada e conferida?',
    fields: [
      {
        kind: 'multi', id: 'm.faturamento.2', options: [
          { value: 'protocolos', label: 'Contagem manual a partir dos protocolos' },
          { value: 'producao', label: 'Relatório do sistema de Produção' },
          { value: 'planilha', label: 'Planilha por cliente' },
          { value: 'cliente-aprova', label: 'O cliente confere e aprova antes da nota' },
          { value: 'fiscal', label: 'Fiscal do contrato atesta' },
          { value: 'direto', label: 'Vai direto para a nota' },
          NAO_SEI,
        ],
      },
      {
        kind: 'multi', id: 'm.faturamento.2.contestacao', label: 'Motivos mais comuns de contestação ou glosa', options: [
          { value: 'nao-recebido', label: 'Item não recebido ou não devolvido' },
          { value: 'quantidade', label: 'Quantidade diferente do protocolo' },
          { value: 'preco', label: 'Preço diferente do contrato' },
          { value: 'multa', label: 'Multa por atraso' },
          { value: 'setor', label: 'Setor errado' },
          { value: 'nao-contestam', label: 'Os clientes não contestam' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('faturamento', {
    id: 'm.faturamento.3',
    title: 'Como são emitidas a nota e a cobrança?',
    fields: [
      {
        kind: 'multi', id: 'm.faturamento.3', label: 'Nota fiscal de serviço', options: [
          { value: 'prefeitura', label: 'No site da prefeitura de cada cidade' },
          { value: 'emissor', label: 'Por um emissor de notas contratado' },
          { value: 'financeiro', label: 'Pelo sistema Financeiro atual' },
          { value: 'contabilidade', label: 'Pela contabilidade' },
          { value: 'por-fechamento', label: 'Uma nota por cliente no fechamento' },
          { value: 'por-entrega', label: 'Uma nota por entrega' },
          NAO_SEI,
        ],
      },
      {
        kind: 'multi', id: 'm.faturamento.3.atraso', label: 'Quando o cliente atrasa o pagamento', options: [
          { value: 'lembretes', label: 'Lembretes antes e depois do vencimento' },
          { value: 'juros', label: 'Juros e multa na próxima cobrança' },
          { value: 'suspende', label: 'Coletas suspensas depois de alguns dias' },
          { value: 'protesto', label: 'Protesto ou cobrança externa' },
          { value: 'nada', label: 'Nada formal' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('portal', {
    id: 'm.portal.1',
    title: 'No portal, o que o cliente deve poder ver e fazer?',
    fields: [{
      kind: 'multi', id: 'm.portal.1', options: [
        { value: 'pedir-coleta', label: 'Pedir coleta' },
        { value: 'acompanhar', label: 'Ver onde está o material e a previsão' },
        { value: 'laudos', label: 'Baixar registros de ciclo e laudos' },
        { value: 'rastreabilidade', label: 'Consultar a rastreabilidade de um kit' },
        { value: 'medicao', label: 'Conferir e aprovar a medição' },
        { value: 'nota-boleto', label: 'Baixar nota e boleto' },
        { value: 'reclamacao', label: 'Abrir reclamação' },
        { value: 'validade', label: 'Ver a validade do material que está com ele' },
        NAO_SEI,
      ],
    }],
  }),
  detail('relatorios', {
    id: 'm.relatorios.1',
    title: 'Quais indicadores vocês acompanham hoje, e quais querem acompanhar?',
    fields: [{
      kind: 'matrix',
      id: 'm.relatorios.1',
      itemNoun: 'indicadores',
      items: [
        { key: 'volume', label: 'Volume por cliente e unidade' },
        { key: 'produtividade', label: 'Produtividade da equipe' },
        { key: 'prazo', label: 'Tempo de devolução e cumprimento do prazo' },
        { key: 'reprocessamento', label: 'Reprocessamento' },
        { key: 'falhas', label: 'Não conformidades e falhas de ciclo' },
        { key: 'ocupacao', label: 'Ocupação dos equipamentos' },
        { key: 'custo', label: 'Custo por item, kit ou ciclo' },
        { key: 'faturamento', label: 'Faturamento por cliente e unidade' },
      ],
      levels: [
        { value: 'ja', label: 'Já acompanha' },
        { value: 'quer', label: 'Quer acompanhar' },
        { value: 'nao', label: 'Não precisa' },
      ],
    }],
  }),
  detail('regulatorio', {
    id: 'm.regulatorio.1',
    title: 'Quais licenças e documentos com vencimento precisam ser controlados?',
    fields: [
      {
        kind: 'multi', id: 'm.regulatorio.1', options: [
          { value: 'sanitaria', label: 'Licença sanitária' },
          { value: 'alvara', label: 'Alvará de funcionamento' },
          { value: 'ambiental', label: 'Licença ambiental' },
          { value: 'bombeiros', label: 'Corpo de Bombeiros' },
          { value: 'eto', label: 'Autorizações para óxido de etileno' },
          { value: 'rt', label: 'Registro do RT no conselho' },
          { value: 'residuos', label: 'Contrato de coleta de resíduos' },
          { value: 'certificados', label: 'Certificados de acreditação ou ISO' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.regulatorio.1.aviso', label: 'Avisar com antecedência de', options: [
          { value: '30', label: '30 dias' },
          { value: '60', label: '60 dias' },
          { value: '90', label: '90 dias' },
          NAO_SEI,
        ],
      },
    ],
  }),
  detail('regulatorio', {
    id: 'm.regulatorio.2',
    title: 'O que precisa ser controlado nos treinamentos?',
    fields: [
      {
        kind: 'multi', id: 'm.regulatorio.2', options: [
          { value: 'integracao', label: 'Integração por função' },
          { value: 'reciclagem', label: 'Reciclagem com vencimento' },
          { value: 'pops', label: 'Treinamento em cada POP' },
          { value: 'presenca', label: 'Lista de presença' },
          { value: 'habilitacao', label: 'Habilitação por equipamento ou método' },
          { value: 'saude', label: 'Vacinação e exames ocupacionais' },
          NAO_SEI,
        ],
      },
      {
        kind: 'single', id: 'm.regulatorio.2.bloqueio', label: 'Sem treinamento válido, a pessoa pode executar a etapa?', options: [
          { value: 'bloquear', label: 'Não, o sistema bloqueia' },
          { value: 'aviso', label: 'Pode, com aviso' },
          NAO_SEI,
        ],
      },
    ],
  }),
]

export const MODULE_DETAILS_SECTION: Section = {
  id: 'detalhes',
  title: 'Detalhes dos módulos prioritários',
  intro: 'Aqui aparecem só as perguntas dos módulos que você marcou como prioridade Alta na etapa anterior. Se nenhum estiver em Alta, pode seguir.',
  blocks: BLOCKS,
}
