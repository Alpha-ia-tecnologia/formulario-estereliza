import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { type AttachmentStore, createMemoryStore } from './draft/attachments'
import { DRAFT_KEY, createDraft, loadDraft, saveDraft } from './draft/storage'
import type { Answers } from './form/types'

function renderApp(hash = '', answers?: Answers, store: AttachmentStore = createMemoryStore()) {
  if (answers) saveDraft({ ...createDraft(), answers: { ...createDraft().answers, ...answers } })
  window.location.hash = hash
  const user = userEvent.setup()
  render(<App attachmentStore={store} />)
  return user
}

const laneOf = (name: RegExp) => screen.getAllByRole('group', { name })

async function uploadJson(user: ReturnType<typeof userEvent.setup>, content: object) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  await act(() => user.upload(input, new File([JSON.stringify(content)], 'respostas.json', { type: 'application/json' })))
}

describe('fluxo completo', () => {
  it('começa o formulário único, responde por unidade, revisa e baixa o pacote', async () => {
    const createObjectURL = vi.fn(() => 'blob:pacote')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const user = renderApp()

    await user.click(screen.getByRole('button', { name: /Começar agora/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Identificação/ })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Respondido por/ }), 'Mariana Costa')
    await user.click(screen.getByRole('button', { name: /Próxima etapa.*Operação atual/ }))

    expect(await screen.findByRole('heading', { level: 1, name: /Operação atual/ })).toBeInTheDocument()
    const [saoLuisMethods] = laneOf(/^São Luís MA$/)
    await user.click(within(saoLuisMethods!).getByRole('checkbox', { name: 'Vapor' }))

    await user.click(screen.getAllByRole('button', { name: 'Revisar e enviar' })[0]!)
    expect(await screen.findByRole('heading', { level: 1, name: 'Revise e envie' })).toBeInTheDocument()
    expect(screen.getByText('Unidades atendidas:').closest('p')).toHaveTextContent(
      'São Luís — MA, Teresina — PI, Maracanaú — CE, Ananindeua — PA',
    )
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument()
    expect(screen.getByText('Vapor')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Baixar pacote/ }))
    expect(await screen.findByText(/steriliza-requisitos-\d{4}-\d{2}-\d{2}\.zip/)).toBeInTheDocument()
    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))

    click.mockRestore()
    vi.unstubAllGlobals()
  })

  it('salva automaticamente e mostra o progresso ao voltar para o início', async () => {
    const user = renderApp('#/etapa/rastreabilidade')
    await user.click(await screen.findByRole('checkbox', { name: 'QR code' }))

    await waitFor(() => expect(loadDraft()?.answers['3.2']).toEqual(['qr']))
    expect(await screen.findByText(/Salvo/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(await screen.findByRole('button', { name: /Continuar de onde parei/ })).toBeInTheDocument()
    expect(screen.getByText(/respondido · atualizado em/)).toBeInTheDocument()
  })

  it('retoma na última etapa visitada', async () => {
    saveDraft({ ...createDraft(), lastSection: 'multiunidade' })
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: /Continuar de onde parei/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Operação multiunidade/ })).toBeInTheDocument()
  })

  it('deixa de perguntar pela unidade desmarcada na identificação', async () => {
    const user = renderApp('#/etapa/identificacao')
    const units = screen.getByRole('group', { name: /Unidades que o novo sistema vai atender/ })
    await user.click(within(units).getByRole('checkbox', { name: 'Ananindeua — PA' }))
    await user.click(screen.getByRole('button', { name: /Próxima etapa.*Operação atual/ }))

    expect(await screen.findByRole('heading', { level: 1, name: /Operação atual/ })).toBeInTheDocument()
    expect(laneOf(/^Teresina PI$/).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('group', { name: /^Ananindeua PA$/ })).toHaveLength(0)
    expect(screen.queryByRole('textbox', { name: /Ananindeua/ })).not.toBeInTheDocument()
  })

  it('bloqueia o pacote enquanto falta o nome de quem respondeu', async () => {
    const user = renderApp('#/revisao', { '2.9': 'nuvem' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/quem respondeu/)
    expect(screen.getByRole('button', { name: /Baixar pacote/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Preencher agora' }))
    expect(await screen.findByRole('textbox', { name: /Respondido por/ })).toBeInTheDocument()
  })

  it('filtra só as perguntas em branco na revisão e volta direto para uma delas', async () => {
    const user = renderApp('#/revisao', { 'ident.nome': 'Ana' })
    expect(screen.getByText('Ana')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Mostrar só as/ }))
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /7\.3 Um mesmo cliente/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Operação multiunidade/ })).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement?.id).toBe('pergunta-7-3'))
  })

  it('termina o relatório com a síntese, que acompanha as respostas e pode ser copiada', async () => {
    const user = renderApp('#/revisao', { 'ident.nome': 'Ana', 'ident.unidades': ['teresina'], '2.8@teresina': 'offline' })
    const synthesis = screen.getByRole('region', { name: 'Síntese' })
    const lastSection = screen.getByRole('region', { name: /Documentos para anexar/ })

    expect(lastSection.compareDocumentPosition(synthesis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(synthesis).getByText(/para 1 unidade \(Teresina\), respondido por Ana/)).toBeInTheDocument()
    expect(within(synthesis).getByText(/^Precisa funcionar sem internet em Teresina/).closest('li')).toHaveAttribute('data-tone', 'alert')
    expect(within(synthesis).getByText('Unidade').closest('li')).toHaveTextContent('1 Unidade')

    await user.click(within(synthesis).getByRole('button', { name: 'Copiar síntese' }))
    await waitFor(() => expect(within(synthesis).getByRole('status')).toHaveTextContent('Síntese copiada'))
    expect(await navigator.clipboard.readText()).toMatch(/^SÍNTESE\n\nLevantamento de requisitos/)
  })

  it('o atalho do topo da revisão leva à síntese e põe o foco nela', async () => {
    const user = renderApp('#/revisao', { 'ident.nome': 'Ana' })

    await user.click(screen.getByRole('button', { name: 'Ver a síntese no fim do relatório' }))

    expect(screen.getByRole('region', { name: 'Síntese' })).toHaveFocus()
  })

  it('avisa quando não consegue copiar a síntese', async () => {
    const user = renderApp('#/revisao', { 'ident.nome': 'Ana' })
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('permissão negada'))
    const synthesis = screen.getByRole('region', { name: 'Síntese' })

    await user.click(within(synthesis).getByRole('button', { name: 'Copiar síntese' }))

    expect(await within(synthesis).findByRole('button', { name: 'Não foi possível copiar' })).toBeInTheDocument()
    expect(within(synthesis).getByRole('status')).toHaveTextContent('Não foi possível copiar')
  })

  it('recomeça depois de confirmar', async () => {
    saveDraft({ ...createDraft(), answers: { 'ident.nome': 'Ana' } })
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: /Recomeçar/ }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await user.click(within(dialog).getByRole('button', { name: 'Apagar e recomeçar', hidden: true }))
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull())
    expect(await screen.findByRole('button', { name: /Começar agora/ })).toBeInTheDocument()
  })

  it('importa um arquivo de respostas e abre a revisão', async () => {
    const user = renderApp()
    await uploadJson(user, { formulario: 'steriliza-requisitos', versao: 2, respostas: { 'ident.nome': 'Paulo' } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Revise e envie' })).toBeInTheDocument()
    expect(screen.getByText('Paulo')).toBeInTheDocument()
  })

  it('avisa e preserva o rascunho quando a substituição por importação falha', async () => {
    saveDraft({ ...createDraft(), answers: { 'ident.nome': 'Original' } })
    const failing = { ...createMemoryStore(), clear: () => Promise.reject(new Error('QuotaExceeded')) }
    const user = renderApp('', undefined, failing)

    await uploadJson(user, { formulario: 'steriliza-requisitos', versao: 2, respostas: { 'ident.nome': 'Importado' } })
    const dialog = screen.getByRole('dialog', { hidden: true })
    await user.click(within(dialog).getByRole('button', { name: 'Substituir', hidden: true }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível importar/)
    expect(screen.getByRole('heading', { level: 2, name: /Unidades no novo sistema/ })).toBeInTheDocument()
    expect(loadDraft()?.answers['ident.nome']).toBe('Original')
  })

  it('explica quando o arquivo é da versão antiga, por unidade', async () => {
    const user = renderApp()
    await uploadJson(user, { formulario: 'steriliza-requisitos', versao: 1, unidade: 'teresina', respostas: {} })
    expect(await screen.findByRole('alert')).toHaveTextContent(/não é compatível/)
  })
})
