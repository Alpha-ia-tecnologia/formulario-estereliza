import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'
import { App } from '../../App'
import { AttachmentsProvider } from '../../draft/AttachmentsContext'
import { type AttachmentStore, createMemoryStore } from '../../draft/attachments'
import { createDraft, loadDraft, saveDraft } from '../../draft/storage'
import { DOCUMENTS } from '../../form/options'
import type { AnswerUpdate, Answers, Block } from '../../form/types'
import { QuestionBlock } from '../QuestionBlock'

function openSection(sectionId: string, answers: Answers = {}, store: AttachmentStore = createMemoryStore()) {
  saveDraft({ ...createDraft(), answers: { ...createDraft().answers, ...answers } })
  window.location.hash = `#/etapa/${sectionId}`
  const user = userEvent.setup()
  render(<App attachmentStore={store} />)
  return user
}

/**
 * Renderiza uma pergunta avulsa com estado próprio. Serve para os tipos de campo
 * que o motor ainda aceita (grade numérica, lista ordenada, pessoa, documentos),
 * mas que nenhuma etapa do formulário usa hoje.
 */
function renderBlock(block: Block, initial: Answers = {}, store: AttachmentStore = createMemoryStore()) {
  const latest = { answers: initial }
  function Harness() {
    const [answers, setAnswers] = useState<Answers>(initial)
    const onChange = useCallback((id: string, update: AnswerUpdate) => {
      setAnswers((current) => {
        const { [id]: previous, ...rest } = current
        const value = typeof update === 'function' ? update(previous) : update
        const next = value === undefined ? rest : { ...rest, [id]: value }
        latest.answers = next
        return next
      })
    }, [])
    return <QuestionBlock block={block} answers={answers} onChange={onChange} />
  }
  const user = userEvent.setup()
  render(
    <AttachmentsProvider store={store}>
      <Harness />
    </AttachmentsProvider>,
  )
  return { user, answers: () => latest.answers }
}

const STAFF_BLOCK: Block = {
  id: 'equipe',
  title: 'Número de funcionários de cada unidade',
  fields: [{ kind: 'numberGrid', id: 'equipe', perUnit: true, suffix: 'pessoas', items: [{ key: 'total', label: 'Funcionários' }] }],
}

const VOLUME_BLOCK: Block = {
  id: 'volume',
  title: 'Volume médio mensal de cada unidade',
  fields: [{
    kind: 'numberGrid', id: 'volume', perUnit: true, suffix: 'por mês', items: [
      { key: 'itens', label: 'Kits e itens' },
      { key: 'ciclos', label: 'Ciclos' },
    ],
  }],
}

const RANKED_BLOCK: Block = {
  id: 'problemas',
  title: 'Os três problemas mais urgentes que o sistema deve resolver',
  fields: [{
    kind: 'ranked', id: 'problemas', count: 3,
    suggestions: ['Faturamento manual', 'Registros de ciclo em papel', 'Rastreabilidade até o cliente'],
  }],
}

const DYNAMIC_RANKED_BLOCK: Block = {
  id: 'dinamica',
  title: 'Problemas sugeridos a partir de outra resposta',
  fields: [{
    kind: 'ranked', id: 'dinamica', count: 3,
    suggestions: (answers) => [...(Array.isArray(answers['base']) ? answers['base'] : []), 'Padrão'],
  }],
}

const PEOPLE_BLOCK: Block = {
  id: 'pessoas',
  title: 'Quem decide e quem será o ponto focal',
  fields: [
    { kind: 'person', id: 'decisor', label: 'Quem decide', canUseRespondent: true },
    { kind: 'person', id: 'focal', label: 'Ponto focal', canUseRespondent: true },
  ],
}

const REASON_BLOCK: Block = {
  id: 'motivo',
  title: 'Há prazo ou data importante?',
  fields: [{ kind: 'text', id: 'motivo', label: 'O que acontece nessa data?', suggestions: ['Auditoria ONA', 'Início de contrato'] }],
}

const DOCUMENTS_BLOCK: Block = {
  id: 'documentos',
  title: 'Documentos para anexar',
  fields: [{ kind: 'documents', id: 'documentos', items: DOCUMENTS }],
}

/** Store cujo add() só termina quando o teste libera, para simular gravações simultâneas. */
function createGatedStore() {
  const base = createMemoryStore()
  const gates: Array<() => void> = []
  const store: AttachmentStore = {
    ...base,
    add: async (input) => {
      await new Promise<void>((release) => gates.push(release))
      return base.add(input)
    },
  }
  return { store, gates }
}

const savedAnswers = () => loadDraft()?.answers ?? {}
const questionOf = (title: RegExp) => screen.getByRole('region', { name: title })
const rowOf = (label: string) => screen.getByText(label).closest('li')!
const fileInputOf = (row: HTMLElement) => row.querySelector<HTMLInputElement>('input[type="file"]')!

describe('perguntas por unidade', () => {
  it('guarda a internet de cada unidade separadamente', async () => {
    const user = openSection('sistemas')
    const internet = questionOf(/Internet em cada unidade/)
    await user.click(within(within(internet).getByRole('radiogroup', { name: /^São Luís/ })).getByRole('radio', { name: 'Instável' }))
    await user.click(
      within(within(internet).getByRole('radiogroup', { name: /^Teresina/ })).getByRole('radio', { name: 'Precisa funcionar sem internet' }),
    )

    await waitFor(() => {
      expect(savedAnswers()['2.7@sao-luis']).toBe('instavel')
      expect(savedAnswers()['2.7@teresina']).toBe('offline')
    })
    expect(within(within(internet).getByRole('radiogroup', { name: /^São Luís/ })).getByRole('radio', { name: 'Instável' })).toBeChecked()
  })

  it('repete a resposta da primeira unidade nas demais', async () => {
    const user = openSection('sistemas', { '2.7@sao-luis': 'offline' })
    const internet = questionOf(/Internet em cada unidade/)
    await user.click(within(internet).getByRole('button', { name: 'Repetir a resposta de São Luís nas demais unidades' }))

    await waitFor(() => expect(savedAnswers()['2.7@ananindeua']).toBe('offline'))
    expect(savedAnswers()['2.7@teresina']).toBe('offline')
    expect(savedAnswers()['2.7@maracanau']).toBe('offline')
    expect(within(internet).queryByRole('button', { name: /Repetir/ })).not.toBeInTheDocument()
  })

  it('pergunta só uma vez o que vale para a empresa toda', () => {
    openSection('sistemas')
    const systems = questionOf(/Sistemas usados hoje/)
    expect(within(systems).getAllByRole('checkbox', { name: 'Produção' })).toHaveLength(1)
    expect(within(systems).queryByRole('button', { name: /Repetir/ })).not.toBeInTheDocument()
  })

  it('guarda o total de funcionários de cada unidade, só com dígitos', async () => {
    const { user, answers } = renderBlock(STAFF_BLOCK)
    await user.type(screen.getByRole('textbox', { name: 'Funcionários — São Luís' }), '1a2')
    await user.type(screen.getByRole('textbox', { name: 'Funcionários — Teresina' }), '5')

    expect(screen.getByRole('textbox', { name: 'Funcionários — São Luís' })).toHaveValue('12')
    const table = within(questionOf(/Número de funcionários de cada unidade/)).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Unidade', 'Funcionários'])
    expect(within(table).getByRole('rowheader', { name: 'Todas' }).closest('tr')).toHaveTextContent('Todas17')
    await waitFor(() => {
      expect(answers()['equipe@sao-luis']).toEqual({ total: '12' })
      expect(answers()['equipe@teresina']).toEqual({ total: '5' })
    })
  })

  it('guarda o volume de kits e itens de cada unidade', async () => {
    const { user, answers } = renderBlock(VOLUME_BLOCK)
    await user.type(screen.getByRole('textbox', { name: 'Kits e itens — Maracanaú' }), '800')
    await waitFor(() => expect(answers()['volume@maracanau']).toEqual({ itens: '800' }))
  })
})

describe('perguntas condicionais', () => {
  it('oferece em "quais substituir" só os sistemas marcados na primeira pergunta', async () => {
    const user = openSection('sistemas', { '2.1': ['financeiro', 'odu'] })
    expect(screen.queryByRole('group', { name: 'Quais devem ser substituídos?' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Substituir alguns' }))
    const group = screen.getByRole('group', { name: 'Quais devem ser substituídos?' })
    expect(within(group).getAllByRole('checkbox').map((box) => box.getAttribute('value'))).toEqual(['financeiro', 'odu'])
  })

  it('pergunta o que é digitado em mais de um sistema só depois de marcar a digitação repetida', async () => {
    const user = openSection('sistemas')
    const typing = { name: 'O que é digitado em mais de um sistema?' }
    expect(screen.queryByRole('group', typing)).not.toBeInTheDocument()

    const pains = screen.getByRole('group', { name: 'Mais incomoda' })
    await user.click(within(pains).getByRole('checkbox', { name: 'Lentidão' }))
    expect(screen.queryByRole('group', typing)).not.toBeInTheDocument()
    await user.click(within(pains).getByRole('checkbox', { name: 'Digitação repetida entre sistemas' }))

    await user.click(within(screen.getByRole('group', typing)).getByRole('checkbox', { name: 'Cadastro de clientes' }))
    await waitFor(() => expect(savedAnswers()['2.2.digitacao']).toEqual(['clientes']))
    expect(savedAnswers()['2.2.incomoda']).toEqual(['lentidao', 'digitacao'])
  })

  it('pergunta o que migrar e quanto histórico quando o novo sistema substitui os atuais', async () => {
    const user = openSection('sistemas')
    const migrate = { name: 'O que precisa vir dos sistemas atuais?' }
    const history = { name: 'Quanto histórico levar?' }
    expect(screen.queryByRole('group', migrate)).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', history)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Substituir todos' }))
    expect(screen.getByRole('group', migrate)).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', history)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Quais devem ser substituídos?' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Substituir alguns' }))
    await user.click(within(screen.getByRole('radiogroup', history)).getByRole('radio', { name: 'Último ano' }))
    await waitFor(() => expect(savedAnswers()['2.3.historico']).toBe('1-ano'))
    expect(screen.getByRole('group', migrate)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Integrar com os atuais' }))
    expect(screen.queryByRole('group', migrate)).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', history)).not.toBeInTheDocument()
  })

  it('pergunta os sistemas dos hospitais quando a rastreabilidade vai até o paciente', async () => {
    const user = openSection('rastreabilidade')
    const systems = { name: 'Com quais sistemas dos hospitais o novo sistema precisa conversar?' }
    expect(screen.queryByRole('textbox', systems)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^Paciente/ }))
    await user.click(within(questionOf(/Até onde a rastreabilidade precisa chegar/)).getByRole('button', { name: 'Tasy' }))

    expect(screen.getByRole('textbox', systems)).toHaveValue('Tasy')
    await waitFor(() => expect(savedAnswers()['3.1.sistemas']).toBe('Tasy'))
  })

  it('pergunta quem pode completar as respostas só quando outra pessoa ajuda', async () => {
    const user = openSection('identificacao')
    const who = { name: 'Quem são (nome e contato)' }
    const support = within(questionOf(/Em quais assuntos outra pessoa pode completar/))
    expect(screen.queryByRole('textbox', who)).not.toBeInTheDocument()

    await user.click(support.getByRole('checkbox', { name: 'Respondo tudo sozinho(a)' }))
    expect(screen.queryByRole('textbox', who)).not.toBeInTheDocument()

    await user.click(support.getByRole('checkbox', { name: 'Informática' }))
    await user.type(screen.getByRole('textbox', who), 'Rui, TI')
    await waitFor(() => expect(savedAnswers()['ident.apoio.quem']).toBe('Rui, TI'))
    expect(savedAnswers()['ident.apoio']).toEqual(['informatica', 'nenhum'])
  })
})

describe('escolhas', () => {
  it('permite limpar uma escolha única', async () => {
    const user = openSection('sistemas')
    await user.click(screen.getByRole('radio', { name: 'Nuvem' }))
    const hosting = questionOf(/Hospedagem preferida/)
    await user.click(within(hosting).getByRole('button', { name: 'Limpar escolha' }))
    expect(screen.getByRole('radio', { name: 'Nuvem' })).not.toBeChecked()
  })

  it('desmarca itens da múltipla escolha', async () => {
    const user = openSection('rastreabilidade', { '3.2': ['manual', 'qr'] })
    await user.click(screen.getByRole('checkbox', { name: 'QR code' }))
    expect(screen.getByRole('checkbox', { name: 'Etiqueta manual' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'QR code' })).not.toBeChecked()
  })

  it('marca os níveis anteriores na escala de rastreabilidade', async () => {
    const user = openSection('rastreabilidade')
    await user.click(screen.getByRole('radio', { name: 'Item individual' }))
    const labels = screen.getAllByRole('radio').slice(0, 4).map((radio) => radio.closest('label')!)
    expect(labels.map((label) => label.dataset.included)).toEqual(['true', 'true', 'true', 'false'])
  })
})

describe('opção "Outra"', () => {
  it('abre o campo "Qual?" com foco e guarda o texto junto da escolha', async () => {
    const user = openSection('clientes')
    const clients = within(questionOf(/Tipos de cliente atendidos/))
    await user.click(clients.getByRole('checkbox', { name: 'Clínica' }))
    await user.click(clients.getByRole('checkbox', { name: 'Outro' }))

    const other = clients.getByRole('textbox', { name: /Qual tipo de cliente/ })
    expect(other).toHaveFocus()
    await user.type(other, 'Laboratório')
    await waitFor(() => expect(savedAnswers()['4.1']).toEqual(['clinica', 'outra:Laboratório']))

    await user.click(clients.getByRole('checkbox', { name: 'Outro' }))
    expect(clients.queryByRole('textbox', { name: /Qual tipo de cliente/ })).not.toBeInTheDocument()
    await waitFor(() => expect(savedAnswers()['4.1']).toEqual(['clinica']))
  })

  it('funciona em escolha única e sai quando outra opção é marcada', async () => {
    const user = openSection('rastreabilidade')
    const release = within(questionOf(/Quem libera o lote/))
    await user.click(release.getByRole('radio', { name: 'Outro' }))
    await user.type(release.getByRole('textbox', { name: /Quem\?/ }), 'Enfermeira')
    await waitFor(() => expect(savedAnswers()['3.4.quem']).toBe('outra:Enfermeira'))

    await user.click(release.getByRole('radio', { name: 'Operador' }))
    expect(release.queryByRole('textbox', { name: /Quem\?/ })).not.toBeInTheDocument()
    await waitFor(() => expect(savedAnswers()['3.4.quem']).toBe('operador'))
  })
})

describe('chips de sugestão', () => {
  it('em texto de várias linhas, cada chip entra e sai como uma linha', async () => {
    const user = openSection('clientes', { '4.6': 'sim' })
    const chips = within(questionOf(/Clientes públicos exigem relatório/))
    await user.click(chips.getByRole('button', { name: 'Relatório mensal por setor' }))
    await user.click(chips.getByRole('button', { name: 'Planilha de medição própria' }))
    expect(chips.getByRole('textbox')).toHaveValue('Relatório mensal por setor\nPlanilha de medição própria')
    expect(chips.getByRole('button', { name: 'Planilha de medição própria' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(chips.getByRole('button', { name: 'Relatório mensal por setor' }))
    expect(chips.getByRole('textbox')).toHaveValue('Planilha de medição própria')
  })

  it('em texto de uma linha, o chip vira a resposta', async () => {
    const { user } = renderBlock(REASON_BLOCK)
    const reason = within(questionOf(/Há prazo ou data importante/))
    await user.click(reason.getByRole('button', { name: 'Auditoria ONA' }))
    expect(reason.getByRole('textbox')).toHaveValue('Auditoria ONA')
    await user.click(reason.getByRole('button', { name: 'Início de contrato' }))
    expect(reason.getByRole('textbox')).toHaveValue('Início de contrato')
  })

  it('na lista ordenada, as sugestões podem depender de outras respostas', () => {
    renderBlock(DYNAMIC_RANKED_BLOCK, { base: ['Lentidão'] })
    const ranked = within(questionOf(/Problemas sugeridos/))
    const chips = within(ranked.getByRole('group', { name: 'Sugestões de resposta' })).getAllByRole('button')
    expect(chips.map((chip) => chip.textContent)).toEqual(['Lentidão', 'Padrão'])
  })

  it('na lista ordenada, os chips ocupam a próxima posição vazia', async () => {
    const { user } = renderBlock(RANKED_BLOCK)
    const ranked = within(questionOf(/três problemas mais urgentes/))
    await user.type(ranked.getByRole('textbox', { name: 'Problema 2' }), 'meu problema')
    await user.click(ranked.getByRole('button', { name: 'Faturamento manual' }))
    await user.click(ranked.getByRole('button', { name: 'Registros de ciclo em papel' }))

    expect(ranked.getByRole('textbox', { name: 'Problema 1' })).toHaveValue('Faturamento manual')
    expect(ranked.getByRole('textbox', { name: 'Problema 3' })).toHaveValue('Registros de ciclo em papel')
    expect(ranked.getByRole('button', { name: 'Rastreabilidade até o cliente' })).toBeDisabled()

    await user.click(ranked.getByRole('button', { name: 'Faturamento manual' }))
    expect(ranked.getByRole('textbox', { name: 'Problema 1' })).toHaveValue('')
  })
})

describe('campos de texto', () => {
  it('formata o telefone enquanto digita', async () => {
    const user = openSection('identificacao')
    const phone = screen.getByRole('textbox', { name: 'Telefone' })
    await user.type(phone, '98998010354')
    expect(phone).toHaveValue('(98) 99801-0354')
  })

  it('avisa sobre e-mail inválido ao sair do campo', async () => {
    const user = openSection('identificacao')
    const email = screen.getByRole('textbox', { name: 'E-mail' })
    await user.type(email, 'mariana@')
    await user.tab()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Confira o e-mail/)).toBeInTheDocument()
  })

  it('preenche "quem decide" com os dados de quem responde', async () => {
    const { user, answers } = renderBlock(PEOPLE_BLOCK, { 'ident.nome': 'Ana', 'ident.email': 'ana@x.com' })
    const decisor = screen.getByRole('group', { name: 'Quem decide' })
    await user.click(within(decisor).getByRole('button', { name: /Sou eu/ }))
    expect(within(decisor).getByRole('textbox', { name: 'Nome' })).toHaveValue('Ana')
    expect(within(decisor).getByRole('textbox', { name: 'Contato' })).toHaveValue('ana@x.com')
    await waitFor(() => expect(answers()['decisor']).toEqual({ nome: 'Ana', contato: 'ana@x.com' }))
  })

  it('guarda os três problemas na ordem', async () => {
    const { user, answers } = renderBlock(RANKED_BLOCK)
    await user.type(screen.getByRole('textbox', { name: 'Problema 2' }), 'faturamento manual')
    await waitFor(() => expect(answers()['problemas']).toEqual(['', 'faturamento manual', '']))
  })

  it('pergunta onde serão as novas unidades só quando há previsão', async () => {
    const user = openSection('multiunidade')
    expect(screen.queryByRole('textbox', { name: 'Onde?' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Sim, sem data definida' }))
    expect(screen.getByRole('textbox', { name: 'Onde?' })).toBeInTheDocument()
  })

  it('pergunta os usuários ao mesmo tempo por faixa, sem digitar números', async () => {
    const user = openSection('acesso')
    const peak = within(questionOf(/Quantas pessoas usam o sistema ao mesmo tempo/))
    expect(peak.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(peak.getByRole('radio', { name: '11 a 30' }))
    await waitFor(() => expect(savedAnswers()['6.3']).toBe('11-30'))
  })
})

describe('matrizes', () => {
  it('conta os níveis e alerta quando há módulos demais em alta', async () => {
    const answers = { modulos: { cadastros: 'alta', coleta: 'alta', recebimento: 'alta', preparo: 'alta', esterilizacao: 'alta' } }
    const user = openSection('modulos', answers)
    expect(screen.queryByText(/módulos em prioridade alta/)).not.toBeInTheDocument()

    const quality = within(screen.getByRole('radiogroup', { name: 'Qualidade e liberação' }))
    await user.click(quality.getByRole('radio', { name: 'Alta' }))
    expect(screen.getByText(/6 módulos em prioridade alta/)).toBeInTheDocument()
    expect(screen.getByText('sem resposta')).toHaveTextContent('7 sem resposta')
  })

  it('registra o que é comum a todas as unidades e o que é de cada uma', async () => {
    const user = openSection('multiunidade')
    await user.click(within(screen.getByRole('radiogroup', { name: 'Cadastro de clientes' })).getByRole('radio', { name: 'Comum a todas' }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Estoque de insumos' })).getByRole('radio', { name: 'Cada unidade' }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Fluxo de liberação de lote' })).getByRole('radio', { name: 'Comum a todas' }))
    await waitFor(() => expect(savedAnswers()['7.1']).toEqual({ clientes: 'comum', insumos: 'unidade', liberacao: 'comum' }))
    expect(screen.getByText('sem resposta')).toHaveTextContent('8 sem resposta')
  })

  it('registra como sai o registro de ciclo e com o que cada posto trabalha', async () => {
    const user = openSection('sistemas')
    await user.click(within(screen.getByRole('radiogroup', { name: 'Autoclaves a vapor' })).getByRole('radio', { name: 'Só impressão' }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Coleta e entrega (motorista)' })).getByRole('radio', { name: 'Só papel' }))
    await waitFor(() => {
      expect(savedAnswers()['2.5.registro']).toEqual({ vapor: 'impressao' })
      expect(savedAnswers()['2.6.postos']).toEqual({ motorista: 'papel' })
    })
  })
})

describe('detalhes dos módulos prioritários', () => {
  it('avisa que não há perguntas quando nenhum módulo está em prioridade alta', () => {
    openSection('detalhes', { modulos: { coleta: 'media' } })
    expect(screen.getByRole('heading', { level: 1, name: /Detalhes dos módulos prioritários/ })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma pergunta nesta etapa para as suas respostas. É só seguir.')).toBeInTheDocument()
    expect(screen.queryAllByRole('region')).toEqual([])
    expect(screen.getByText(/^Etapa 6 de 8/)).toHaveTextContent('0 de 0 respondidas')
  })

  it('mostra só as perguntas dos módulos em prioridade alta', async () => {
    const user = openSection('detalhes', { modulos: { coleta: 'alta', portal: 'media' } })
    expect(screen.queryByText(/Nenhuma pergunta nesta etapa/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('region').map((region) => region.querySelector('h2')?.textContent)).toEqual([
      'Coleta e entrega: Como as coletas e rotas são programadas?',
      'Coleta e entrega: O que o protocolo de coleta e entrega precisa registrar?',
    ])
    expect(screen.queryByRole('region', { name: /^Portal do cliente:/ })).not.toBeInTheDocument()

    const routes = within(questionOf(/^Coleta e entrega: Como as coletas e rotas são programadas\?/))
    await user.click(routes.getByRole('checkbox', { name: 'Coleta extra de emergência' }))
    await waitFor(() => expect(savedAnswers()['m.coleta.1']).toEqual(['emergencia']))
    expect(screen.getByText(/^Etapa 6 de 8/)).toHaveTextContent('1 de 2 respondidas')
  })

  it('passa a mostrar os detalhes de um módulo marcado como alta na etapa anterior', async () => {
    const user = openSection('modulos')
    await user.click(within(screen.getByRole('radiogroup', { name: 'Faturamento' })).getByRole('radio', { name: 'Alta' }))
    await user.click(screen.getByRole('button', { name: /Próxima etapa.*Detalhes dos módulos prioritários/ }))

    expect(await screen.findByRole('heading', { level: 1, name: /Detalhes dos módulos prioritários/ })).toBeInTheDocument()
    expect(screen.getAllByRole('region').map((region) => region.querySelector('h2')?.textContent)).toEqual([
      'Faturamento: Como o preço é formado?',
      'Faturamento: Como a medição do mês é montada e conferida?',
      'Faturamento: Como são emitidas a nota e a cobrança?',
    ])
  })
})

describe('numeração', () => {
  it('numera as etapas e as perguntas pela posição, sem mudar os ids das respostas', async () => {
    const user = openSection('sistemas')
    expect(screen.getByRole('heading', { level: 1, name: '1. Sistemas e infraestrutura' })).toBeInTheDocument()
    expect(questionOf(/^1\.7\s*Internet em cada unidade$/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Nuvem' }))
    await waitFor(() => expect(savedAnswers()['2.8']).toBe('nuvem'))
  })

  it('mostra a etapa de detalhes sem número', () => {
    openSection('detalhes')
    expect(screen.getByRole('heading', { level: 1, name: 'Detalhes dos módulos prioritários' })).toBeInTheDocument()
  })
})

describe('documentos', () => {
  it('anexa e remove arquivos, atualizando o status', async () => {
    const { user, answers } = renderBlock(DOCUMENTS_BLOCK)
    const row = rowOf('Lista de equipamentos por unidade (fabricante, modelo, capacidade)')

    await user.upload(fileInputOf(row), new File(['autoclave'], 'equipamentos.csv', { type: 'text/csv' }))
    expect(await within(row).findByText('equipamentos.csv')).toBeInTheDocument()
    await waitFor(() => expect(answers()['documentos']).toEqual({ equipamentos: 'anexado' }))

    await user.click(within(row).getByRole('button', { name: 'Remover equipamentos.csv' }))
    await waitFor(() => expect(within(row).queryByText('equipamentos.csv')).not.toBeInTheDocument())
    await waitFor(() => expect(answers()['documentos']).toBeUndefined())
  })

  it('mantém o status de dois documentos anexados ao mesmo tempo', async () => {
    const { store, gates } = createGatedStore()
    const { user, answers } = renderBlock(DOCUMENTS_BLOCK, {}, store)
    const forms = rowOf('Formulários e planilhas usados hoje')
    const equipment = rowOf('Lista de equipamentos por unidade (fabricante, modelo, capacidade)')

    await user.upload(fileInputOf(forms), new File(['a'], 'a.xlsx'))
    await user.upload(fileInputOf(equipment), new File(['b'], 'b.csv'))
    await waitFor(() => expect(gates).toHaveLength(2))

    act(() => gates[0]!())
    expect(await within(forms).findByText('a.xlsx')).toBeInTheDocument()
    act(() => gates[1]!())
    expect(await within(equipment).findByText('b.csv')).toBeInTheDocument()

    await waitFor(() => expect(answers()['documentos']).toEqual({ formularios: 'anexado', equipamentos: 'anexado' }))
  })

  it('limpa o status quando dois arquivos do mesmo documento são removidos em sequência', async () => {
    const store = createMemoryStore()
    await store.add({ docKey: 'formularios', name: '1.pdf', blob: new Blob(['1']) })
    await store.add({ docKey: 'formularios', name: '2.pdf', blob: new Blob(['2']) })
    const { user, answers } = renderBlock(DOCUMENTS_BLOCK, { documentos: { formularios: 'anexado' } }, store)
    const forms = within(rowOf('Formulários e planilhas usados hoje'))

    await user.click(await forms.findByRole('button', { name: 'Remover 1.pdf' }))
    await user.click(await forms.findByRole('button', { name: 'Remover 2.pdf' }))
    await waitFor(() => expect(answers()['documentos']).toBeUndefined())
  })

  it('marca um documento para envio posterior e desmarca', async () => {
    const { user } = renderBlock(DOCUMENTS_BLOCK)
    const row = within(rowOf('Formulários e planilhas usados hoje'))
    await user.click(row.getByRole('button', { name: 'Envio depois' }))
    expect(row.getByRole('button', { name: 'Envio depois' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(row.getByRole('button', { name: 'Envio depois' }))
    expect(row.getByRole('button', { name: 'Envio depois' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('remove o status "anexado" quando o arquivo não existe mais', async () => {
    const { answers } = renderBlock(DOCUMENTS_BLOCK, { documentos: { formularios: 'anexado', faturamento: 'depois' } })
    await waitFor(() => expect(answers()['documentos']).toEqual({ faturamento: 'depois' }))
  })

  it('recusa arquivos acima do limite', async () => {
    const { user } = renderBlock(DOCUMENTS_BLOCK)
    const big = new File(['x'], 'enorme.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 30 * 1024 * 1024 })
    await user.upload(fileInputOf(rowOf('Formulários e planilhas usados hoje')), big)
    expect(await screen.findByRole('alert')).toHaveTextContent(/enorme\.pdf passa de 25,0 MB/)
  })
})

describe('navegação', () => {
  it('abre e fecha a gaveta de etapas e navega por ela', async () => {
    const user = openSection('identificacao')
    await user.click(screen.getByRole('button', { name: /Etapas/ }))
    const rail = screen.getByRole('navigation', { name: 'Etapas do formulário' })
    expect(rail).toHaveAttribute('data-open', 'true')
    await user.keyboard('{Escape}')
    expect(rail).toHaveAttribute('data-open', 'false')

    await user.click(within(rail).getByRole('button', { name: /Operação multiunidade/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Operação multiunidade/ })).toBeInTheDocument()
  })

  it('volta para a etapa anterior', async () => {
    const user = openSection('rastreabilidade')
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Sistemas e infraestrutura/ })).toBeInTheDocument()
  })

  it('volta da primeira etapa numerada para a identificação', async () => {
    const user = openSection('sistemas')
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Identificação/ })).toBeInTheDocument()
  })
})
