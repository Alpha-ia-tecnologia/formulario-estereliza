import { MODULES } from './options'
import { synthesisToMarkdown, synthesisToText, synthesize } from './synthesis'
import type { Answers } from './types'

const TODAY = new Date('2026-09-29T12:00:00')

const FULL: Answers = {
  'ident.nome': 'Mariana Costa',
  'ident.cargo': 'Gerente de operações',
  'ident.data': '2026-09-28',
  'ident.unidades': ['sao-luis', 'teresina'],
  '2.1': ['producao', 'financeiro'],
  '2.2.bem': ['relatorios'],
  '2.2.incomoda': ['lentidao', 'digitacao'],
  '2.2.digitacao': ['clientes', 'ciclo'],
  '2.3': 'alguns',
  '2.3.quais': ['financeiro'],
  '2.3.migrar': ['clientes', 'historico'],
  '2.3.historico': 'ate-5-anos',
  '2.4': ['contabil', 'outra:Folha X'],
  '2.5.registro': { vapor: 'arquivo', eto: 'impressao', peroxido: 'manual' },
  '2.6.postos': { preparo: 'leitor', motorista: 'papel', limpeza: 'papel' },
  '2.7@sao-luis': 'estavel',
  '2.7@teresina': 'offline',
  '2.9': ['bancos', 'nota-fiscal'],
  '2.10': 'minutos',
  '2.10.perda': 'nenhum',
  '3.1': 'paciente',
  '3.1.sistemas': 'MV\nTasy',
  '3.4.quem': 'rt',
  '3.4.apos': ['integrador', 'biologico'],
  '3.7': '5-anos',
  '3.8': ['ona', 'licenca'],
  '3.9': 'desde-ultimo',
  '3.9.acoes': ['listar', 'avisar'],
  '4.4': ['item', 'outra:pacote mensal'],
  modulos: { cadastros: 'alta', esterilizacao: 'alta', qualidade: 'alta', etiquetas: 'alta', faturamento: 'alta', portal: 'alta', relatorios: 'media' },
  '6.3': '11-30',
  '6.5': 'historico',
  '7.1': { clientes: 'comum', kits: 'comum', insumos: 'unidade', pops: 'nao-sei' },
  '7.2': 'sim',
  '7.5': 'sim',
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

  it('mostra só preenchido, unidades, módulos em prioridade alta e usuários simultâneos', () => {
    expect(synthesize(FULL, TODAY).metrics.map((item) => item.label)).toEqual([
      'Preenchido',
      'Unidades',
      'Módulos em prioridade alta',
      'Usuários simultâneos',
    ])
    expect(metric('Unidades')?.value).toBe('2')
    expect(metric('Módulos em prioridade alta')).toEqual({ label: 'Módulos em prioridade alta', value: '6', detail: 'de 13' })
  })

  it('usa "Unidade" no singular quando só uma é atendida', () => {
    expect(metric('Unidade', { 'ident.unidades': ['teresina'] })).toEqual({ label: 'Unidade', value: '1' })
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
  it('não tem mais os temas de operação atual e de projeto', () => {
    expect(synthesize(FULL, TODAY).topics.map((item) => item.id)).toEqual([
      'sistemas',
      'rastreabilidade',
      'clientes',
      'prioridades',
      'acesso',
      'multiunidade',
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
        'Outros sistemas: Contábil e Outro: Folha X',
      ]),
    )
  })

  it('resume como sai o registro de ciclo de cada equipamento', () => {
    expect(topic(FULL, 'sistemas')).toEqual(
      expect.arrayContaining([
        'Registro de ciclo — arquivo: Autoclaves a vapor',
        'Registro de ciclo — só impressão: Óxido de etileno',
        'Registro de ciclo — anotado à mão: Peróxido de hidrogênio',
      ]),
    )
  })

  it('resume com o que cada posto de trabalho registra', () => {
    expect(topic(FULL, 'sistemas')).toEqual(
      expect.arrayContaining([
        'Postos — computador com leitor: Preparo e embalagem',
        'Postos — só papel: Limpeza (área suja) e Coleta e entrega (motorista)',
      ]),
    )
  })

  it('resume as integrações sem digitação e a tolerância a parada', () => {
    expect(topic(FULL, 'sistemas')).toEqual(
      expect.arrayContaining([
        'Integrações sem digitação: Bancos (boleto, Pix, extrato) e Emissão de nota fiscal',
        'Tolerância a parada: Não pode parar nem por minutos — Nenhum registro pode se perder',
      ]),
    )
    expect(topic({ '2.10.perda': '1h' }, 'sistemas')).toEqual(['Tolerância a parada: Até 1 hora de trabalho'])
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

  it('resume rastreabilidade, liberação de lote, guarda dos registros, normas e falhas de indicador', () => {
    expect(topic(FULL, 'rastreabilidade')).toEqual([
      'Rastreabilidade até: Paciente — MV; Tasy',
      'Liberação de lote: RT da unidade, após integrador e indicador biológico',
      'Guarda dos registros: 5 anos',
      'Normas e acreditações: Acreditação ONA e Licença da vigilância sanitária',
      'Falha de indicador ou teste: Todas as cargas do equipamento desde o último resultado aprovado — Listar clientes, setores e kits afetados e Avisar os clientes',
    ])
  })

  it('descreve a liberação de lote só com quem libera ou só com os resultados', () => {
    expect(topic({ '3.4.quem': 'outra:Enfermeira' }, 'rastreabilidade')).toEqual(['Liberação de lote: Outro: Enfermeira'])
    expect(topic({ '3.4.apos': ['fim-ciclo'] }, 'rastreabilidade')).toEqual(['Liberação de lote: após fim do ciclo'])
  })

  it('inclui a resposta "Outra" com o texto informado', () => {
    expect(topic(FULL, 'clientes')).toContain('Cobrança por: Item e Outra: pacote mensal')
  })

  it('resume o faturamento e o que os clientes públicos exigem', () => {
    expect(topic({ '4.5.periodicidade': 'mensal', '4.5.documentos': ['medicao', 'nota-fiscal'] }, 'clientes')).toEqual([
      'Faturamento: Mensal, com Medição e Nota fiscal',
    ])
    expect(topic({ '4.6': 'nao' }, 'clientes')).toEqual(['Clientes públicos não exigem formato específico'])
    expect(topic({ '4.6': 'sim' }, 'clientes')).toEqual(['Clientes públicos exigem: relatório ou formato específico'])
  })

  it('mostra os usuários no pico e a correção de registros em acesso e segurança', () => {
    expect(topic(FULL, 'acesso')).toEqual([
      'Usuários ao mesmo tempo no pico: 11 a 30',
      'Correção de registros: Permitir, guardando o valor antigo, quem, quando e o motivo',
    ])
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

  it('resume as prioridades dos módulos', () => {
    expect(topic(FULL, 'prioridades')[0]).toMatch(/^Prioridade alta: Cadastros, Esterilização/)
    expect(topic({ modulos: { portal: 'nao' } }, 'prioridades')).toEqual(['Não precisa: Portal do cliente'])
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
    expect(attention.filter((point) => point.tone === 'alert').map((point) => point.text)).toEqual([
      'Precisa funcionar sem internet em Teresina: prever operação offline com sincronização.',
      'A operação não pode parar nem por minutos: o sistema precisa de contingência e alta disponibilidade.',
      '6 módulos em prioridade alta — vale escalonar a primeira entrega.',
      'Definir se são comuns ou por unidade: Procedimentos da qualidade (POPs).',
    ])
  })

  it('aponta registros em papel, integrações necessárias e lacunas', () => {
    expect(texts).toEqual(
      expect.arrayContaining([
        'Registro de ciclo só em papel (Óxido de etileno e Peróxido de hidrogênio): será digitado ou integrado com o fabricante.',
        'Postos que ainda registram só em papel (Limpeza (área suja) e Coleta e entrega (motorista)): prever computador, leitor ou celular.',
        'Rastreabilidade até o paciente depende de integração com os sistemas dos clientes (MV; Tasy).',
        expect.stringMatching(/^Há material processado em outra unidade/),
        expect.stringMatching(/perguntas? em branco/),
      ]),
    )
  })

  it('não tem mais avisos de prazo nem de documentos a enviar', () => {
    expect(texts.join(' ')).not.toMatch(/Prazo|prazo|Documentos a enviar/)
  })

  it('avisa sobre internet instável em cada unidade', () => {
    const answers = { 'ident.unidades': ['sao-luis', 'teresina'], '2.7@sao-luis': 'instavel', '2.7@teresina': 'estavel' }
    expect(attentionTexts(answers)).toContain('Internet instável em São Luís: o sistema deve tolerar quedas sem perder registros.')
    expect(attentionTexts(answers).join(' ')).not.toMatch(/sem internet/)
  })

  it('alerta alta disponibilidade só quando a operação não pode parar nem por minutos', () => {
    const point = 'A operação não pode parar nem por minutos: o sistema precisa de contingência e alta disponibilidade.'
    expect(synthesize({ '2.10': 'minutos' }, TODAY).attention).toContainEqual({ tone: 'alert', text: point })
    expect(attentionTexts({ '2.10': '1h' })).not.toContain(point)
    expect(attentionTexts({})).not.toContain(point)
  })

  it('avisa sobre o registro de ciclo em papel só para os equipamentos com impressão ou anotação à mão', () => {
    const cyclePoint = (answers: Answers) => attentionTexts(answers).find((text) => text.startsWith('Registro de ciclo só em papel'))
    expect(cyclePoint({ '2.5.registro': { vapor: 'manual' } })).toBe(
      'Registro de ciclo só em papel (Autoclaves a vapor): será digitado ou integrado com o fabricante.',
    )
    expect(cyclePoint({ '2.5.registro': { vapor: 'arquivo', eto: 'rede', seladoras: 'nao-tem' } })).toBeUndefined()
    expect(cyclePoint({})).toBeUndefined()
  })

  it('lista os postos que registram só em papel', () => {
    const paperPoint = (answers: Answers) => attentionTexts(answers).find((text) => text.startsWith('Postos que ainda registram'))
    expect(synthesize({ '2.6.postos': { escritorio: 'papel' } }, TODAY).attention).toContainEqual({
      tone: 'info',
      text: 'Postos que ainda registram só em papel (Faturamento e escritório): prever computador, leitor ou celular.',
    })
    expect(paperPoint({ '2.6.postos': { preparo: 'leitor', motorista: 'movel' } })).toBeUndefined()
    expect(paperPoint({})).toBeUndefined()
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

  it('aponta novas unidades previstas', () => {
    expect(attentionTexts({ '7.7': 'proximo-ano', '7.7.onde': 'Caxias' })).toContain(
      'Novas unidades previstas (Caxias): incluir uma unidade nova no sistema deve ser simples.',
    )
  })

  it('cobra o nome de quem respondeu', () => {
    expect(synthesize({}, TODAY).attention[0]).toEqual({
      tone: 'alert',
      text: 'Falta informar quem respondeu — sem isso o pacote não pode ser gerado.',
    })
  })

  it('conta como em branco só as perguntas visíveis', () => {
    expect(attentionTexts({ 'ident.nome': 'Ana' })).toContain('44 perguntas em branco; a etapa com mais lacunas é "Sistemas e infraestrutura".')
    const allHigh = { 'ident.nome': 'Ana', modulos: Object.fromEntries(MODULES.map((module) => [module.key, 'alta'])) }
    expect(attentionTexts(allHigh)).toContain('68 perguntas em branco; a etapa com mais lacunas é "Detalhes dos módulos prioritários".')
  })
})

describe('síntese — texto livre', () => {
  it('mantém cada texto numa linha só, mesmo com quebras vindas de um pacote importado', () => {
    const synthesis = synthesize(
      {
        'ident.nome': 'Ana\n\n## Título falso',
        '4.4': ['outra:pacote\n- item falso'],
        '7.7': 'sem-data',
        '7.7.onde': 'Caxias\n# outro título',
      },
      TODAY,
    )
    const markdown = synthesisToMarkdown(synthesis)

    expect(synthesis.headline).toContain('respondido por Ana ## Título falso')
    expect(markdown).toContain('- Cobrança por: Outra: pacote - item falso')
    expect(markdown).toContain('Novas unidades previstas (Caxias # outro título)')
    expect(markdown).not.toMatch(/^(## Título falso|- item falso|# outro título)/m)
  })
})

describe('síntese — texto e markdown', () => {
  it('gera texto simples para copiar', () => {
    const text = synthesisToText(synthesize(FULL, TODAY))
    expect(text).toMatch(/^SÍNTESE\n\nLevantamento de requisitos/)
    expect(text).toMatch(/Números\n- Preenchido: \d+%\n- Unidades: 2\n- Módulos em prioridade alta: 6 \(de 13\)/)
    expect(text).toContain('Pontos de atenção\n- ')
    expect(text).toContain('Sistemas e infraestrutura\n- Sistemas em uso: Produção e Financeiro')
  })

  it('omite os pontos de atenção do texto quando não há nenhum', () => {
    const text = synthesisToText({ headline: 'H', metrics: [], attention: [], topics: [] })
    expect(text).not.toContain('Pontos de atenção')
  })

  it('gera a seção de markdown para o fim do resumo', () => {
    const markdown = synthesisToMarkdown(synthesize(FULL, TODAY))
    expect(markdown).toMatch(/^## Síntese\n/)
    expect(markdown).toContain('- **Atenção:** A operação não pode parar nem por minutos')
    expect(markdown).toContain('### Multiunidade')
    expect(markdown).toContain('- Módulos em prioridade alta: 6 (de 13)')
  })
})
