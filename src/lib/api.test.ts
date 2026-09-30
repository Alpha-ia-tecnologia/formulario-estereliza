import { SendError, apiBase, createApi, detectApi } from './api'

const json = (body: unknown, status = 200) => Response.json(body, { status })

describe('apiBase', () => {
  it('usa VITE_API_URL sem espaços nem barra final', () => {
    expect(apiBase({ VITE_API_URL: ' https://requisitos.exemplo.com.br/ ' }, 'file:')).toBe('https://requisitos.exemplo.com.br')
  })

  it('sem configuração, usa a própria origem quando servido por http', () => {
    expect(apiBase({}, 'https:')).toBe('')
    expect(apiBase({ VITE_API_URL: '' }, 'http:')).toBe('')
  })

  it('sem configuração e aberto do disco, não há servidor', () => {
    expect(apiBase({}, 'file:')).toBeNull()
  })
})

describe('detectApi', () => {
  it('encontra o servidor pela rota de saúde', async () => {
    const fetchFn = vi.fn(async () => json({ ok: true }))

    const api = await detectApi('', fetchFn)

    expect(api).not.toBeNull()
    expect(fetchFn).toHaveBeenCalledWith('/api/saude', expect.anything())
  })

  it('devolve null sem servidor, com erro ou com resposta estranha', async () => {
    const notCalled = vi.fn()

    expect(await detectApi(null, notCalled)).toBeNull()
    expect(notCalled).not.toHaveBeenCalled()
    expect(await detectApi('', async () => Promise.reject(new TypeError('Failed to fetch')))).toBeNull()
    expect(await detectApi('', async () => json({ erro: 'x' }, 404))).toBeNull()
    expect(await detectApi('', async () => json({ outro: true }))).toBeNull()
  })
})

describe('envio', () => {
  const blob = new Blob(['zip'], { type: 'application/zip' })

  it('envia o pacote e devolve o protocolo', async () => {
    const fetchFn = vi.fn(async () => json({ id: 7, recebidoEm: '2026-09-29T15:00:00.000Z' }, 201))

    const receipt = await createApi('https://x', fetchFn).send(blob)

    expect(receipt).toEqual({ id: 7, recebidoEm: '2026-09-29T15:00:00.000Z' })
    expect(fetchFn).toHaveBeenCalledWith(
      'https://x/api/respostas',
      expect.objectContaining({ method: 'POST', headers: { 'content-type': 'application/zip' }, body: blob }),
    )
  })

  it('repassa a mensagem do servidor quando ele recusa o envio', async () => {
    const refused = createApi('', async () => json({ erro: 'Este arquivo não é do formulário de requisitos da Steriliza.' }, 400))
    const full = createApi('', async () => json({ erro: 'O servidor está sem espaço para novas respostas.' }, 507))

    await expect(refused.send(blob)).rejects.toThrow(new SendError('Este arquivo não é do formulário de requisitos da Steriliza.'))
    await expect(full.send(blob)).rejects.toThrow(/sem espaço/)
  })

  it('explica tamanho, excesso de envios, falhas do servidor, demora e falta de conexão', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })

    await expect(createApi('', async () => json({}, 413)).send(blob)).rejects.toThrow(/grande demais/)
    await expect(createApi('', async () => json({}, 429)).send(blob)).rejects.toThrow(/Muitos envios/)
    await expect(createApi('', async () => json({}, 500)).send(blob)).rejects.toThrow(/O servidor não conseguiu receber/)
    await expect(createApi('', async () => Promise.reject(timeout)).send(blob)).rejects.toThrow(/demorou demais/)
    await expect(createApi('', async () => Promise.reject(new TypeError('Failed to fetch'))).send(blob)).rejects.toThrow(/Sem conexão/)
  })

  it('recusa uma resposta sem protocolo', async () => {
    await expect(createApi('', async () => json({}, 201)).send(blob)).rejects.toThrow(SendError)
  })
})
