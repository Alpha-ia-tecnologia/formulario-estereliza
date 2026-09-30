import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { type AttachmentStore, createMemoryStore } from '../../draft/attachments'
import { createDraft, loadDraft, saveDraft } from '../../draft/storage'
import type { Answers } from '../../form/types'

function openSection(sectionId: string, answers: Answers = {}, store: AttachmentStore = createMemoryStore()) {
  saveDraft({ ...createDraft(), answers: { ...createDraft().answers, ...answers } })
  window.location.hash = `#/etapa/${sectionId}`
  const user = userEvent.setup()
  render(<App attachmentStore={store} />)
  return user
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
    openSection('operacao')
    const methods = questionOf(/Métodos de esterilização oferecidos/)
    expect(within(methods).getAllByRole('checkbox', { name: 'Vapor' })).toHaveLength(1)
    expect(within(methods).queryByRole('button', { name: /Repetir/ })).not.toBeInTheDocument()
  })

  it('guarda o total de funcionários de cada unidade, só com dígitos', async () => {
    const user = openSection('operacao')
    await user.type(screen.getByRole('textbox', { name: 'Funcionários — São Luís' }), '1a2')
    await user.type(screen.getByRole('textbox', { name: 'Funcionários — Teresina' }), '5')

    expect(screen.getByRole('textbox', { name: 'Funcionários — São Luís' })).toHaveValue('12')
    const table = within(questionOf(/Número de funcionários de cada unidade/)).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Unidade', 'Funcionários'])
    expect(within(table).getByRole('rowheader', { name: 'Todas' }).closest('tr')).toHaveTextContent('Todas17')
    await waitFor(() => {
      expect(savedAnswers()['1.4@sao-luis']).toEqual({ total: '12' })
      expect(savedAnswers()['1.4@teresina']).toEqual({ total: '5' })
    })
  })

  it('guarda o volume de kits e itens de cada unidade', async () => {
    const user = openSection('operacao')
    await user.type(screen.getByRole('textbox', { name: 'Kits e itens — Maracanaú' }), '800')
    await waitFor(() => expect(savedAnswers()['1.2@maracanau']).toEqual({ itens: '800' }))
  })
})

describe('perguntas condicionais', () => {
  it('oferece em "quais substituir" só os sistemas marcados na 2.1', async () => {
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

  it('mostra a faixa de orçamento que combina com o modelo de contratação', async () => {
    const user = openSection('projeto')
    const project = { name: 'Faixa de orçamento do projeto' }
    const monthly = { name: 'Faixa de orçamento por mês' }
    expect(screen.queryByRole('radiogroup', project)).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', monthly)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Projeto fechado' }))
    await user.click(within(screen.getByRole('radiogroup', project)).getByRole('radio', { name: 'R$ 100 a 300 mil' }))
    await waitFor(() => expect(savedAnswers()['8.4.projeto']).toBe('100-300k'))
    expect(screen.queryByRole('radiogroup', monthly)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Mensalidade' }))
    expect(screen.queryByRole('radiogroup', project)).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('radiogroup', monthly)).getByRole('radio', { name: 'Até R$ 5 mil por mês' }))
    await waitFor(() => expect(savedAnswers()['8.4.mensal']).toBe('ate-5k'))
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
    const user = openSection('operacao')
    const hours = within(questionOf(/Horário de funcionamento/))
    await user.click(hours.getByRole('radio', { name: 'Outro' }))
    await user.type(hours.getByRole('textbox', { name: /Qual horário/ }), '12 x 36')
    await waitFor(() => expect(savedAnswers()['1.3']).toBe('outra:12 x 36'))

    await user.click(hours.getByRole('radio', { name: 'Turnos' }))
    expect(hours.queryByRole('textbox', { name: /Qual horário/ })).not.toBeInTheDocument()
    await waitFor(() => expect(savedAnswers()['1.3']).toBe('turnos'))
  })
})

describe('chips de sugestão', () => {
  it('em texto de várias linhas, cada chip entra e sai como uma linha', async () => {
    const user = openSection('operacao')
    const chips = within(questionOf(/Alguma unidade foge do padrão/))
    await user.click(chips.getByRole('button', { name: 'Métodos diferentes em uma unidade' }))
    await user.click(chips.getByRole('button', { name: 'Horário diferente em uma unidade' }))
    expect(chips.getByRole('textbox')).toHaveValue('Métodos diferentes em uma unidade\nHorário diferente em uma unidade')
    expect(chips.getByRole('button', { name: 'Horário diferente em uma unidade' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(chips.getByRole('button', { name: 'Métodos diferentes em uma unidade' }))
    expect(chips.getByRole('textbox')).toHaveValue('Horário diferente em uma unidade')
  })

  it('em texto de uma linha, o chip vira a resposta', async () => {
    const user = openSection('projeto', { '8.3': 'sim' })
    const deadline = within(questionOf(/Há prazo ou data importante/))
    await user.click(deadline.getByRole('button', { name: 'Auditoria ONA' }))
    expect(deadline.getByRole('textbox', { name: 'O que acontece nessa data?' })).toHaveValue('Auditoria ONA')
    await user.click(deadline.getByRole('button', { name: 'Início de contrato' }))
    expect(deadline.getByRole('textbox', { name: 'O que acontece nessa data?' })).toHaveValue('Início de contrato')
  })

  it('na lista ordenada, sugere primeiro o que foi marcado como incômodo na 2.2', () => {
    openSection('projeto', { '2.2.incomoda': ['lentidao', 'digitacao', 'outra:Etiquetas ilegíveis'] })
    const ranked = within(questionOf(/três problemas mais urgentes/))
    const chips = within(ranked.getByRole('group', { name: 'Sugestões de resposta' })).getAllByRole('button')

    expect(chips.slice(0, 4).map((chip) => chip.textContent)).toEqual([
      'Lentidão',
      'Digitação repetida entre sistemas',
      'Etiquetas ilegíveis',
      'Rastreabilidade até o cliente',
    ])
    expect(chips.filter((chip) => chip.textContent === 'Digitação repetida entre sistemas')).toHaveLength(1)
  })

  it('na lista ordenada, os chips ocupam a próxima posição vazia', async () => {
    const user = openSection('projeto')
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

  it('pergunta por qual unidade a implantação começa', async () => {
    const user = openSection('projeto')
    const pilot = within(questionOf(/unidade piloto/))
    expect(pilot.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Sim: São Luís',
      'Sim: Teresina',
      'Sim: Maracanaú',
      'Sim: Ananindeua',
      'Não, todas juntas',
      'Ainda não definido',
    ])
    await user.click(pilot.getByRole('radio', { name: 'Sim: Teresina' }))
    await waitFor(() => expect(savedAnswers()['8.2']).toBe('teresina'))
  })

  it('preenche "quem decide" com os dados de quem responde', async () => {
    const user = openSection('projeto', { 'ident.nome': 'Ana', 'ident.email': 'ana@x.com' })
    const decisor = screen.getByRole('group', { name: 'Quem decide' })
    await user.click(within(decisor).getByRole('button', { name: /Sou eu/ }))
    expect(within(decisor).getByRole('textbox', { name: 'Nome' })).toHaveValue('Ana')
    expect(within(decisor).getByRole('textbox', { name: 'Contato' })).toHaveValue('ana@x.com')
  })

  it('guarda os três problemas na ordem', async () => {
    const user = openSection('projeto')
    await user.type(screen.getByRole('textbox', { name: 'Problema 2' }), 'faturamento manual')
    await waitFor(() => expect(savedAnswers()['8.1']).toEqual(['', 'faturamento manual', '']))
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
})

describe('documentos', () => {
  it('anexa e remove arquivos, atualizando o status', async () => {
    const user = openSection('documentos')
    const row = rowOf('Lista de equipamentos por unidade (fabricante, modelo, capacidade)')

    await user.upload(fileInputOf(row), new File(['autoclave'], 'equipamentos.csv', { type: 'text/csv' }))
    expect(await within(row).findByText('equipamentos.csv')).toBeInTheDocument()
    await waitFor(() => expect(savedAnswers()['documentos']).toEqual({ equipamentos: 'anexado' }))

    await user.click(within(row).getByRole('button', { name: 'Remover equipamentos.csv' }))
    await waitFor(() => expect(within(row).queryByText('equipamentos.csv')).not.toBeInTheDocument())
    await waitFor(() => expect(savedAnswers()['documentos']).toBeUndefined())
  })

  it('mantém o status de dois documentos anexados ao mesmo tempo', async () => {
    const { store, gates } = createGatedStore()
    const user = openSection('documentos', {}, store)
    const forms = rowOf('Formulários e planilhas usados hoje')
    const equipment = rowOf('Lista de equipamentos por unidade (fabricante, modelo, capacidade)')

    await user.upload(fileInputOf(forms), new File(['a'], 'a.xlsx'))
    await user.upload(fileInputOf(equipment), new File(['b'], 'b.csv'))
    await waitFor(() => expect(gates).toHaveLength(2))

    act(() => gates[0]!())
    expect(await within(forms).findByText('a.xlsx')).toBeInTheDocument()
    act(() => gates[1]!())
    expect(await within(equipment).findByText('b.csv')).toBeInTheDocument()

    await waitFor(() => expect(savedAnswers()['documentos']).toEqual({ formularios: 'anexado', equipamentos: 'anexado' }))
  })

  it('limpa o status quando dois arquivos do mesmo documento são removidos em sequência', async () => {
    const store = createMemoryStore()
    await store.add({ docKey: 'formularios', name: '1.pdf', blob: new Blob(['1']) })
    await store.add({ docKey: 'formularios', name: '2.pdf', blob: new Blob(['2']) })
    const user = openSection('documentos', { documentos: { formularios: 'anexado' } }, store)
    const forms = within(rowOf('Formulários e planilhas usados hoje'))

    await user.click(await forms.findByRole('button', { name: 'Remover 1.pdf' }))
    await user.click(await forms.findByRole('button', { name: 'Remover 2.pdf' }))
    await waitFor(() => expect(savedAnswers()['documentos']).toBeUndefined())
  })

  it('marca um documento para envio posterior e desmarca', async () => {
    const user = openSection('documentos')
    const row = within(rowOf('Formulários e planilhas usados hoje'))
    await user.click(row.getByRole('button', { name: 'Envio depois' }))
    expect(row.getByRole('button', { name: 'Envio depois' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(row.getByRole('button', { name: 'Envio depois' }))
    expect(row.getByRole('button', { name: 'Envio depois' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('remove o status "anexado" quando o arquivo não existe mais', async () => {
    openSection('documentos', { documentos: { formularios: 'anexado', faturamento: 'depois' } })
    await waitFor(() => expect(savedAnswers()['documentos']).toEqual({ faturamento: 'depois' }))
  })

  it('recusa arquivos acima do limite', async () => {
    const user = openSection('documentos')
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
    const user = openSection('sistemas')
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Operação atual/ })).toBeInTheDocument()
  })
})
