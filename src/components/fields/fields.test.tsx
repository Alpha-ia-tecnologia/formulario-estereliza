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
  it('guarda a resposta de cada unidade separadamente', async () => {
    const user = openSection('operacao')
    const hours = questionOf(/Horário de funcionamento/)
    await user.click(within(within(hours).getByRole('radiogroup', { name: /^São Luís/ })).getByRole('radio', { name: 'Turnos' }))
    await user.click(within(within(hours).getByRole('radiogroup', { name: /^Teresina/ })).getByRole('radio', { name: '24 horas' }))

    await waitFor(() => {
      expect(savedAnswers()['1.3@sao-luis']).toBe('turnos')
      expect(savedAnswers()['1.3@teresina']).toBe('24h')
    })
    expect(within(within(hours).getByRole('radiogroup', { name: /^São Luís/ })).getByRole('radio', { name: 'Turnos' })).toBeChecked()
  })

  it('repete a resposta da primeira unidade nas demais', async () => {
    const user = openSection('operacao', { '1.1@sao-luis': ['eto', 'vapor'] })
    const methods = questionOf(/Métodos oferecidos/)
    await user.click(within(methods).getByRole('button', { name: /Repetir a resposta de São Luís/ }))

    await waitFor(() => expect(savedAnswers()['1.1@ananindeua']).toEqual(['eto', 'vapor']))
    expect(savedAnswers()['1.1@teresina']).toEqual(['eto', 'vapor'])
    expect(within(methods).queryByRole('button', { name: /Repetir/ })).not.toBeInTheDocument()
  })

  it('soma os funcionários por unidade e no total da empresa', async () => {
    const user = openSection('operacao')
    await user.type(screen.getByRole('textbox', { name: 'Recepção — São Luís' }), '3')
    await user.type(screen.getByRole('textbox', { name: 'Preparo — São Luís' }), '1a2')
    await user.type(screen.getByRole('textbox', { name: 'Preparo — Teresina' }), '5')

    expect(screen.getByRole('textbox', { name: 'Preparo — São Luís' })).toHaveValue('12')
    const table = within(questionOf(/Funcionários por área/)).getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(within(rows[1]!).getAllByRole('cell').at(-1)).toHaveTextContent('15')
    expect(within(rows.at(-1)!).getAllByRole('cell').at(-1)).toHaveTextContent('20')
    await waitFor(() => expect(savedAnswers()['1.4@sao-luis']).toEqual({ recepcao: '3', preparo: '12' }))
  })

  it('oferece em "quais substituir" só os sistemas usados em alguma unidade', async () => {
    const user = openSection('sistemas', { '2.1@sao-luis': ['financeiro'], '2.1@maracanau': ['odu'] })
    expect(screen.queryByRole('group', { name: 'Quais devem ser substituídos?' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Substituir alguns' }))
    const group = screen.getByRole('group', { name: 'Quais devem ser substituídos?' })
    expect(within(group).getAllByRole('checkbox').map((box) => box.getAttribute('value'))).toEqual(['financeiro', 'odu'])
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

  it('funciona em escolha única, inclusive dentro de uma linha por unidade', async () => {
    const user = openSection('operacao')
    const hours = questionOf(/Horário de funcionamento/)
    const teresina = within(within(hours).getByRole('radiogroup', { name: /^Teresina/ }))
    await user.click(teresina.getByRole('radio', { name: 'Outro' }))
    await user.type(within(hours).getByRole('textbox', { name: /Qual horário/ }), '12 x 36')
    await waitFor(() => expect(savedAnswers()['1.3@teresina']).toBe('outra:12 x 36'))
    expect(savedAnswers()['1.3@sao-luis']).toBeUndefined()
  })
})

describe('chips de sugestão', () => {
  it('em texto de várias linhas, cada chip entra e sai como uma linha', async () => {
    const user = openSection('sistemas')
    const chips = within(questionOf(/digitadas em mais de um sistema/))
    await user.click(chips.getByRole('button', { name: 'Cadastro de clientes' }))
    await user.click(chips.getByRole('button', { name: 'Dados do ciclo' }))
    expect(chips.getByRole('textbox')).toHaveValue('Cadastro de clientes\nDados do ciclo')
    expect(chips.getByRole('button', { name: 'Dados do ciclo' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(chips.getByRole('button', { name: 'Cadastro de clientes' }))
    expect(chips.getByRole('textbox')).toHaveValue('Dados do ciclo')
  })

  it('em texto de uma linha, o chip vira a resposta', async () => {
    const user = openSection('projeto')
    const budget = within(questionOf(/Faixa de orçamento/))
    await user.click(budget.getByRole('button', { name: 'Até R$ 100 mil' }))
    expect(budget.getByRole('textbox', { name: 'Faixa de orçamento' })).toHaveValue('Até R$ 100 mil')
    await user.click(budget.getByRole('button', { name: 'R$ 100 a 300 mil' }))
    expect(budget.getByRole('textbox', { name: 'Faixa de orçamento' })).toHaveValue('R$ 100 a 300 mil')
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

  it('sugere os módulos de prioridade alta na primeira entrega', async () => {
    const user = openSection('projeto', { modulos: { cadastros: 'alta', faturamento: 'alta' } })
    await user.click(screen.getByRole('button', { name: /Usar os módulos de prioridade alta/ }))
    expect(screen.getByRole('textbox', { name: /primeira entrega/ })).toHaveValue('Cadastros, Faturamento')
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

  it('aceita só dígitos no número de usuários', async () => {
    const user = openSection('acesso')
    const input = screen.getByRole('textbox', { name: /usuários ao mesmo tempo/ })
    await user.type(input, '4x0')
    expect(input).toHaveValue('40')
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
    await waitFor(() => expect(savedAnswers()['7.1']).toEqual({ clientes: 'comum', insumos: 'unidade' }))
    expect(screen.getByText('sem resposta')).toHaveTextContent('5 sem resposta')
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
