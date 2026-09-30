import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { COPY_FEEDBACK_MS, SynthesisPanel } from './SynthesisPanel'

describe('SynthesisPanel', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra o resultado da cópia por um instante e volta ao normal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<SynthesisPanel answers={{ 'ident.nome': 'Ana' }} />)

    await user.click(screen.getByRole('button', { name: 'Copiar síntese' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Síntese copiada'))

    act(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS))

    expect(screen.getByRole('button', { name: 'Copiar síntese' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('mostra cada número antes do rótulo, na mesma ordem da leitura', () => {
    render(<SynthesisPanel answers={{ 'ident.unidades': ['teresina'], modulos: { coleta: 'alta', portal: 'baixa' }, '6.3': '11-30' }} />)

    const metrics = screen.getByRole('list', { name: 'Números' })
    expect(metrics).toHaveTextContent('1 Unidade')
    expect(metrics).toHaveTextContent('1 Módulos em prioridade alta de 13')
    expect(metrics).toHaveTextContent('11 a 30 Usuários simultâneos')
  })
})
