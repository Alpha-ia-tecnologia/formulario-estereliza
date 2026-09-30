import { synthesisToMarkdown, synthesisToText, synthesize } from './synthesis'
import type { Answers } from './types'

const TODAY = new Date('2026-09-29T12:00:00')

const FULL: Answers = {
  'ident.nome': 'Mariana Costa',
  'ident.cargo': 'Gerente de operações',
  'ident.data': '2026-09-28',
  'ident.unidades': ['sao-luis', 'teresina'],
  '1.1': ['eto', 'vapor'],
  '1.2@sao-luis': { itens: '1200', ciclos: '90', clientes: '30' },
  '1.2@teresina': { itens: '800' },
  '1.3': 'outra:12 x 36',
  '1.4@sao-luis': { total: '11' },
  '1.4@teresina': { total: '5' },
  '1.5': 'depende',
  '1.6': 'Só São Luís tem óxido de etileno',
  '2.1': ['producao', 'financeiro'],
  '2.2.bem': ['relatorios'],
  '2.2.incomoda': ['lentidao', 'digitacao'],
  '2.2.digitacao': ['clientes', 'ciclo'],
  '2.3': 'alguns',
  '2.3.quais': ['financeiro'],
  '2.3.migrar': ['clientes', 'historico'],
  '2.3.historico': 'ate-5-anos',
  '2.5': 'impressao',
  '2.6': ['computadores', 'leitor'],
  '2.7@sao-luis': 'estavel',
  '2.7@teresina': 'offline',
  '3.1': 'paciente',
  '3.1.sistemas': 'MV\nTasy',
  '3.4.quem': 'rt',
  '3.4.apos': ['integrador', 'biologico'],
  '3.7': '5-anos',
  '4.4': ['item', 'outra:pacote mensal'],
  modulos: { cadastros: 'alta', esterilizacao: 'alta', qualidade: 'alta', etiquetas: 'alta', faturamento: 'alta', portal: 'alta', relatorios: 'media' },
  '6.3': '11-30',
  '7.1': { clientes: 'comum', kits: 'comum', insumos: 'unidade', pops: 'nao-sei' },
  '7.2': 'sim',
  '7.5': 'sim',
  '8.1': ['Faturamento manual', '', 'Registros em papel'],
  '8.2': 'teresina',
  '8.3': 'sim',
  '8.3.data': '2026-11-28',
  '8.3.motivo': 'Auditoria ONA',
  '8.4': 'fechado',
  '8.4.projeto': '100-300k',
  documentos: { formularios: 'depois', faturamento: 'anexado' },
}

const topic = (answers: Answers, id: string) => synthesize(answers, TODAY).topics.find((item) => item.id === id)?.lines ?? []
const metric = (label: string, answers: Answers = FULL) => synthesize(answers, TODAY).metrics.find((item) => item.label === label)
const attentionTexts = (answers: Answers) => synthesize(answers, TODAY).attention.map((point) => point.text)

describe('síntese — abertura e números', () => {
  it('abre com quem respondeu, as unidades, a data e o percentual preenchido', () => {
    const { headline } = synthesize(FULL, TODAY)
    expect(headline).toMatch(/^Levantamento de requisitos da Steriliza para 2 unidades \(São Luís e Teresina\)/)
    expect(headline).toContain('respondido por Mariana Costa (Gerente de operações) em 28/09/2026')
    expect(headline).toMatch(/\d+% do formulário preenchido\.$/)
  })

  it('soma os números das unidades e avisa quando só parte delas informou', () => {
    expect(metric('Unidades')?.value).toBe('2')
    expect(metric('Funcionários')).toEqual({ label: 'Funcionários', value: '16' })
    expect(metric('Kits e itens por mês')?.value).toBe('2.000')
    expect(metric('Ciclos por mês')).toEqual({ label: 'Ciclos por mês', value: '90', detail: 'informado em 1 de 2 unidades' })
    expect(metric('Módulos em prioridade alta')).toEqual({ label: 'Módulos em prioridade alta', value: '6', detail: 'de 13' })
  })

  it('mostra a faixa de usuários simultâneos, exceto quando não se sabe', () => {
    expect(metric('Usuários simultâneos')).toEqual({ label: 'Usuários simultâneos', value: '11 a 30' })
    expect(metric('Usuários simultâneos', { '6.3': 'nao-sei' })).toBeUndefined()
  })

  it('mostra só os números que foram informados', () => {
    const labels = synthesize({}, TODAY).metrics.map((item) => item.label)
    expect(labels).toEqual(['Preenchido', 'Unidades'])
  })
})

describe('síntese — temas', () => {
  it('resume a operação comum à empresa, a equipe por unidade e as diferenças', () => {
    expect(topic(FULL, 'operacao')).toEqual([
      'Métodos: Óxido de etileno e Vapor',
      'Horário: Outro: 12 x 36',
      'Limpeza feita pela Steriliza: Depende do cliente',
      'Equipe por unidade: São Luís 11, Teresina 5',
      'Diferenças entre unidades: Só São Luís tem óxido de etileno',
    ])
  })

  it('agrupa a internet por unidade e resume "em todas as unidades"', () => {
    expect(topic(FULL, 'sistemas')).toContain('Internet: Estável em São Luís; Precisa funcionar sem internet em Teresina')
    const same = { 'ident.unidades': ['sao-luis', 'teresina'], '2.7@sao-luis': 'offline', '2.7@teresina': 'offline' }
    expect(topic(same, 'sistemas')).toContain('Internet: Precisa funcionar sem internet em todas as unidades')
  })

  it('resume o que os sistemas atuais fazem bem, o que incomoda e o que é digitado duas vezes', () => {
    expect(topic(FULL, 'sistemas')).toEqual(
      expect.arrayContaining([
        'Sistemas em uso: Produção e Financeiro',
        'Funciona bem hoje: Relatórios',
        'Mais incomoda hoje: Lentidão e Digitação repetida entre sistemas',
        'Digitado em mais de um sistema: Cadastro de clientes e Dados do ciclo',
        'Exportação de ciclos: Só impressão',
        'Equipamentos: Computadores e Leitor de código de barras',
      ]),
    )
  })

  it('descreve a estratégia de troca dos sistemas e o que migrar', () => {
    expect(topic(FULL, 'sistemas')).toEqual(
      expect.arrayContaining([
        'Estratégia: substituir alguns sistemas (Financeiro)',
        'Migrar dos sistemas atuais: Cadastro de clientes e Histórico de ciclos e rastreabilidade — Até 5 anos',
      ]),
    )
    expect(topic({ '2.3': 'todos' }, 'sistemas')).toContain('Estratégia: substituir todos os sistemas atuais')
    expect(topic({ '2.3': 'integrar' }, 'sistemas')).toContain('Estratégia: integrar com os sistemas atuais')
  })

  it('ignora respostas de campos que ficaram ocultos', () => {
    const answers = { '2.3': 'integrar', '2.3.quais': ['financeiro'], '2.3.migrar': ['clientes'], '3.1': 'item', '3.1.sistemas': 'MV' }
    expect(topic(answers, 'sistemas')).toEqual(['Estratégia: integrar com os sistemas atuais'])
    expect(topic(answers, 'rastreabilidade')).toEqual(['Rastreabilidade até: Item individual'])
  })

  it('resume rastreabilidade, liberação de lote e guarda dos registros', () => {
    expect(topic(FULL, 'rastreabilidade')).toEqual([
      'Rastreabilidade até: Paciente — MV; Tasy',
      'Liberação de lote: RT da unidade, após integrador e indicador biológico',
      'Guarda dos registros: 5 anos',
    ])
  })

  it('descreve a liberação de lote só com quem libera ou só com os resultados', () => {
    expect(topic({ '3.4.quem': 'outra:Enfermeira' }, 'rastreabilidade')).toEqual(['Liberação de lote: Outro: Enfermeira'])
    expect(topic({ '3.4.apos': ['fim-ciclo'] }, 'rastreabilidade')).toEqual(['Liberação de lote: após fim do ciclo'])
  })

  it('inclui a resposta "Outra" com o texto informado', () => {
    expect(topic(FULL, 'clientes')).toContain('Cobrança por: Item e Outra: pacote mensal')
  })

  it('mostra os usuários ao mesmo tempo no pico em acesso e segurança', () => {
    expect(topic(FULL, 'acesso')).toEqual(['Usuários ao mesmo tempo no pico: 11 a 30'])
  })

  it('resume o que é comum e o que é de cada unidade', () => {
    const lines = topic(FULL, 'multiunidade')
    expect(lines).toContain('Comum a todas: Cadastro de clientes e Catálogo de kits e instrumentais')
    expect(lines).toContain('Cada unidade: Estoque de insumos')
    expect(lines).toContain('Material de uma unidade é processado em outra')
  })

  it('diz se há usuários que atuam em mais de uma unidade', () => {
    expect(topic(FULL, 'multiunidade')).toContain('Há usuários que atuam em mais de uma unidade')
    expect(topic({ '7.2': 'nao' }, 'multiunidade')).toEqual(['Cada usuário atua em uma unidade só'])
  })

  it('resume prioridades, problemas e prazo do projeto', () => {
    expect(topic(FULL, 'prioridades')[0]).toMatch(/^Prioridade alta: Cadastros, Esterilização/)
    expect(topic(FULL, 'projeto')).toEqual(
      expect.arrayContaining(['Problemas mais urgentes: 1) Faturamento manual; 3) Registros em papel', 'Prazo: 28/11/2026 — Auditoria ONA']),
    )
  })

  it('diz por onde começa a implantação', () => {
    expect(topic(FULL, 'projeto')).toContain('Implantação: começa por Teresina')
    expect(topic({ '8.2': 'sao-luis' }, 'projeto')).toEqual(['Implantação: começa por São Luís'])
    expect(topic({ '8.2': 'todas' }, 'projeto')).toEqual(['Implantação: todas as unidades juntas'])
    expect(topic({ '8.2': 'a-definir' }, 'projeto')).toEqual(['Implantação: unidade piloto ainda não definida'])
    // Piloto escolhido e depois desmarcado na identificação: não vale mais.
    expect(topic({ 'ident.unidades': ['teresina'], '8.2': 'sao-luis' }, 'projeto')).toEqual([])
  })

  it('junta o modelo de contratação com a faixa de orçamento visível', () => {
    expect(topic(FULL, 'projeto')).toContain('Modelo de contratação: Projeto fechado — R$ 100 a 300 mil')
    expect(topic({ '8.4': 'equipe' }, 'projeto')).toEqual(['Modelo de contratação: Equipe dedicada'])
  })

  it('usa só a faixa do modelo escolhido depois de trocar de modelo', () => {
    const lines = topic({ '8.4': 'mensalidade', '8.4.projeto': 'ate-100k', '8.4.mensal': '5-15k' }, 'projeto')
    expect(lines).toEqual(['Modelo de contratação: Mensalidade — R$ 5 a 15 mil por mês'])
    expect(lines.join(' ')).not.toContain('Até R$ 100 mil')
  })

  it('omite temas sem nenhuma resposta', () => {
    expect(synthesize({}, TODAY).topics).toEqual([])
  })
})

describe('síntese — pontos de atenção', () => {
  const attention = synthesize(FULL, TODAY).attention
  const texts = attention.map((point) => point.text)

  it('destaca riscos e decisões em aberto antes das observações', () => {
    const tones = attention.map((point) => point.tone)
    expect(tones.indexOf('info')).toBeGreaterThan(tones.lastIndexOf('alert'))
    expect(texts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Precisa funcionar sem internet em Teresina/),
        expect.stringMatching(/^6 módulos em prioridade alta/),
        'Prazo em 60 dias, em 28/11/2026 (Auditoria ONA).',
        'Definir se são comuns ou por unidade: Procedimentos da qualidade (POPs).',
      ]),
    )
  })

  it('aponta infraestrutura a providenciar e integrações necessárias', () => {
    expect(texts).toEqual(
      expect.arrayContaining([
        'Os esterilizadores não exportam dados dos ciclos: registro digitado ou integração com o fabricante.',
        'Equipamentos a providenciar: impressora de etiquetas.',
        'Rastreabilidade até o paciente depende de integração com os sistemas dos clientes (MV; Tasy).',
        expect.stringMatching(/^Há material processado em outra unidade/),
        'Documentos a enviar depois: Formulários e planilhas usados hoje.',
        expect.stringMatching(/perguntas? em branco/),
      ]),
    )
  })

  it('avisa sobre internet instável em cada unidade', () => {
    const answers = { 'ident.unidades': ['sao-luis', 'teresina'], '2.7@sao-luis': 'instavel', '2.7@teresina': 'estavel' }
    expect(attentionTexts(answers)).toContain('Internet instável em São Luís: o sistema deve tolerar quedas sem perder registros.')
    expect(attentionTexts(answers).join(' ')).not.toMatch(/sem internet/)
  })

  it('avisa sobre a exportação de ciclos para a empresa toda, só quando não há arquivo', () => {
    const exportPoint = 'Os esterilizadores não exportam dados dos ciclos: registro digitado ou integração com o fabricante.'
    expect(attentionTexts({ '2.5': 'nao' })).toContain(exportPoint)
    expect(attentionTexts({ '2.5': 'arquivo' })).not.toContain(exportPoint)
    expect(attentionTexts({})).not.toContain(exportPoint)
  })

  it('lista os equipamentos de rastreabilidade que faltam só quando a 2.6 foi respondida', () => {
    const equipmentPoint = (answers: Answers) => attentionTexts(answers).find((text) => text.startsWith('Equipamentos a providenciar'))
    expect(equipmentPoint({})).toBeUndefined()
    expect(equipmentPoint({ '2.6': ['computadores'] })).toBe('Equipamentos a providenciar: leitor de código de barras e impressora de etiquetas.')
    expect(equipmentPoint({ '2.6': ['leitor', 'impressora'] })).toBeUndefined()
  })

  it('pede integração para rastrear até o paciente, mesmo sem os sistemas informados', () => {
    expect(attentionTexts({ '3.1': 'paciente' })).toContain(
      'Rastreabilidade até o paciente depende de integração com os sistemas dos clientes.',
    )
  })

  it('aponta clientes compartilhados e o CNPJ de faturamento', () => {
    expect(attentionTexts({ '7.4': 'sim', '7.6': 'todas' })).toEqual(
      expect.arrayContaining([
        'Clientes atendidos por mais de uma unidade: o cadastro de clientes deve ser compartilhado.',
        'Cada unidade emite nota com CNPJ próprio: faturamento e medição separados por unidade.',
      ]),
    )
    expect(attentionTexts({ '7.6': 'depende' })).toContain('O CNPJ de faturamento varia por unidade: o sistema precisa aceitar os dois modelos.')
  })

  it('avisa quando a data informada já passou', () => {
    const past = synthesize({ '8.3': 'sim', '8.3.data': '2026-09-01' }, TODAY).attention.map((point) => point.text)
    expect(past).toContain('A data informada (01/09/2026) já passou — confirme o prazo.')
  })

  it('cobra o nome de quem respondeu', () => {
    expect(synthesize({}, TODAY).attention[0]).toEqual({
      tone: 'alert',
      text: 'Falta informar quem respondeu — sem isso o pacote não pode ser gerado.',
    })
  })

  it('alerta prazos de até 90 dias e ignora os mais distantes', () => {
    const hasDeadline = (date: string) =>
      synthesize({ '8.3': 'sim', '8.3.data': date }, TODAY).attention.some((point) => point.text.startsWith('Prazo em 90 dias'))
    expect(hasDeadline('2026-12-28')).toBe(true)
    expect(hasDeadline('2026-12-29')).toBe(false)
  })

  it('pede a data quando há prazo sem data válida, sem contas com datas inexistentes', () => {
    for (const date of [undefined, '2026-02-30', '2026-13-01']) {
      const texts = synthesize({ '8.3': 'sim', ...(date ? { '8.3.data': date } : {}) }, TODAY).attention.map((point) => point.text)
      expect(texts).toContain('Há prazo, mas falta a data — complete a pergunta 8.3.')
      expect(texts.join(' ')).not.toMatch(/NaN|já passou/)
    }
  })
})

describe('síntese — texto livre', () => {
  it('mantém cada texto numa linha só, mesmo com quebras vindas de um pacote importado', () => {
    const synthesis = synthesize(
      {
        'ident.nome': 'Ana\n\n## Título falso',
        '4.4': ['outra:pacote\n- item falso'],
        '8.3': 'sim',
        '8.3.data': '2026-10-10',
        '8.3.motivo': 'ONA\n# outro título',
      },
      TODAY,
    )
    const markdown = synthesisToMarkdown(synthesis)

    expect(synthesis.headline).toContain('respondido por Ana ## Título falso')
    expect(markdown).toContain('- Cobrança por: Outra: pacote - item falso')
    expect(markdown).not.toMatch(/^(## Título falso|- item falso|# outro título)/m)
  })
})

describe('síntese — texto e markdown', () => {
  it('gera texto simples para copiar', () => {
    const text = synthesisToText(synthesize(FULL, TODAY))
    expect(text).toMatch(/^SÍNTESE\n\nLevantamento de requisitos/)
    expect(text).toMatch(/Números\n- Preenchido: \d+%\n- Unidades: 2/)
    expect(text).toContain('Pontos de atenção\n- ')
    expect(text).toContain('Operação\n- Métodos: Óxido de etileno e Vapor')
  })

  it('gera a seção de markdown para o fim do resumo', () => {
    const markdown = synthesisToMarkdown(synthesize(FULL, TODAY))
    expect(markdown).toMatch(/^## Síntese\n/)
    expect(markdown).toContain('- **Atenção:** Prazo em 60 dias')
    expect(markdown).toContain('### Multiunidade')
    expect(markdown).toContain('- Ciclos por mês: 90 (informado em 1 de 2 unidades)')
  })
})
