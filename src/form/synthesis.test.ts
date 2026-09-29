import { synthesisToMarkdown, synthesisToText, synthesize } from './synthesis'
import type { Answers } from './types'

const TODAY = new Date('2026-09-29T12:00:00')

const FULL: Answers = {
  'ident.nome': 'Mariana Costa',
  'ident.cargo': 'Gerente de operações',
  'ident.data': '2026-09-28',
  'ident.unidades': ['sao-luis', 'teresina'],
  '1.1@sao-luis': ['eto', 'vapor'],
  '1.1@teresina': ['vapor'],
  '1.2@sao-luis': { itens: '1200', ciclos: '90', clientes: '30' },
  '1.2@teresina': { itens: '800' },
  '1.3@sao-luis': '24h',
  '1.3@teresina': 'outra:12 x 36',
  '1.4@sao-luis': { recepcao: '3', preparo: '8' },
  '1.4@teresina': { preparo: '5' },
  '2.1@sao-luis': ['producao', 'financeiro'],
  '2.1@teresina': ['financeiro'],
  '2.4': 'alguns',
  '2.4.quais': ['financeiro'],
  '2.6@sao-luis': 'arquivo',
  '2.6@teresina': 'impressao',
  '2.7@sao-luis': ['computadores', 'leitor', 'impressora'],
  '2.7@teresina': ['computadores'],
  '2.8@sao-luis': 'estavel',
  '2.8@teresina': 'offline',
  '3.1': 'paciente',
  '4.4': ['item', 'outra:pacote mensal'],
  modulos: { cadastros: 'alta', esterilizacao: 'alta', qualidade: 'alta', etiquetas: 'alta', faturamento: 'alta', portal: 'alta', relatorios: 'media' },
  '7.1': { clientes: 'comum', kits: 'comum', insumos: 'unidade', pops: 'nao-sei' },
  '7.4': 'sim',
  '8.1': ['Faturamento manual', '', 'Registros em papel'],
  '8.3': 'sim',
  '8.3.data': '2026-11-28',
  '8.3.motivo': 'Auditoria ONA',
  documentos: { formularios: 'depois', faturamento: 'anexado' },
}

const topic = (answers: Answers, id: string) => synthesize(answers, TODAY).topics.find((item) => item.id === id)?.lines ?? []
const metric = (label: string) => synthesize(FULL, TODAY).metrics.find((item) => item.label === label)

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
    expect(metric('Itens ou kits por mês')?.value).toBe('2.000')
    expect(metric('Ciclos por mês')).toEqual({ label: 'Ciclos por mês', value: '90', detail: 'informado em 1 de 2 unidades' })
    expect(metric('Módulos em prioridade alta')).toEqual({ label: 'Módulos em prioridade alta', value: '6', detail: 'de 13' })
  })

  it('mostra só os números que foram informados', () => {
    const labels = synthesize({}, TODAY).metrics.map((item) => item.label)
    expect(labels).toEqual(['Preenchido', 'Unidades'])
  })
})

describe('síntese — temas', () => {
  it('agrupa as respostas por unidade e resume "em todas as unidades"', () => {
    const lines = topic(FULL, 'operacao')
    expect(lines).toContain('Métodos: Óxido de etileno em São Luís; Vapor em todas as unidades')
    expect(lines).toContain('Horário: 24 horas em São Luís; Outro: 12 x 36 em Teresina')
    expect(lines).toContain('Equipe por unidade: São Luís 11, Teresina 5')
  })

  it('descreve a estratégia de troca dos sistemas', () => {
    expect(topic(FULL, 'sistemas')).toContain('Estratégia: substituir alguns sistemas (Financeiro)')
    expect(topic({ '2.4': 'integrar' }, 'sistemas')).toContain('Estratégia: integrar com os sistemas atuais')
  })

  it('inclui a resposta "Outra" com o texto informado', () => {
    expect(topic(FULL, 'clientes')).toContain('Cobrança por: Item e Outra: pacote mensal')
  })

  it('resume o que é comum e o que é de cada unidade', () => {
    const lines = topic(FULL, 'multiunidade')
    expect(lines).toContain('Comum a todas: Cadastro de clientes e Catálogo de kits e instrumentais')
    expect(lines).toContain('Cada unidade: Estoque de insumos')
    expect(lines).toContain('Material de uma unidade é processado em outra')
  })

  it('resume prioridades, problemas e prazo do projeto', () => {
    expect(topic(FULL, 'prioridades')[0]).toMatch(/^Prioridade alta: Cadastros, Esterilização/)
    expect(topic(FULL, 'projeto')).toEqual(
      expect.arrayContaining(['Problemas mais urgentes: 1) Faturamento manual; 3) Registros em papel', 'Prazo: 28/11/2026 — Auditoria ONA']),
    )
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
        expect.stringMatching(/^Esterilizadores sem exportação de ciclos em Teresina/),
        'Equipamentos a providenciar: leitor de código de barras em Teresina; impressora de etiquetas em Teresina.',
        expect.stringMatching(/^Rastreabilidade até o paciente/),
        expect.stringMatching(/^Há material processado em outra unidade/),
        'Documentos a enviar depois: Formulários e planilhas usados hoje.',
        expect.stringMatching(/perguntas? em branco/),
      ]),
    )
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
    expect(text).toContain('Operação\n- Métodos:')
  })

  it('gera a seção de markdown para o fim do resumo', () => {
    const markdown = synthesisToMarkdown(synthesize(FULL, TODAY))
    expect(markdown).toMatch(/^## Síntese\n/)
    expect(markdown).toContain('- **Atenção:** Prazo em 60 dias')
    expect(markdown).toContain('### Multiunidade')
    expect(markdown).toContain('- Ciclos por mês: 90 (informado em 1 de 2 unidades)')
  })
})
