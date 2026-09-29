import { copyText } from './clipboard'
import { exportFileName, formatBytes, safeFileName, uniqueName } from './files'
import { formatPhoneBR } from './phone'
import { parseRoute, toHash } from './route'
import { transition } from './transition'

describe('transition', () => {
  const root = document.documentElement

  afterEach(() => {
    delete root.dataset.nav
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sem a View Transitions API, aplica na hora e marca o sentido por um instante', () => {
    vi.useFakeTimers()
    const apply = vi.fn()
    transition('forward', apply)
    expect(apply).toHaveBeenCalledOnce()
    expect(root.dataset.nav).toBe('forward')
    vi.runAllTimers()
    expect(root.dataset.nav).toBeUndefined()
  })

  it('com a API, aplica dentro da transição e limpa o sentido ao terminar', async () => {
    const start = vi.fn((update: () => void) => {
      update()
      return { finished: Promise.resolve() }
    })
    Object.assign(document, { startViewTransition: start })
    const apply = vi.fn()
    transition('back', apply)
    expect(start).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledOnce()
    expect(root.dataset.nav).toBe('back')
    await Promise.resolve()
    await Promise.resolve()
    expect(root.dataset.nav).toBeUndefined()
    delete (document as { startViewTransition?: unknown }).startViewTransition
  })

  it('sem sentido ou com movimento reduzido, só aplica', () => {
    const apply = vi.fn()
    transition('none', apply)
    expect(root.dataset.nav).toBeUndefined()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    transition('forward', apply)
    expect(apply).toHaveBeenCalledTimes(2)
    expect(root.dataset.nav).toBeUndefined()
  })
})

describe('formatPhoneBR', () => {
  it.each([
    ['', ''],
    ['9', '(9'],
    ['98', '(98'],
    ['983', '(98) 3'],
    ['983248', '(98) 3248'],
    ['9832483', '(98) 3248-3'],
    ['9832483379', '(98) 3248-3379'],
    ['86998010354', '(86) 99801-0354'],
    ['(86) 99801-03549999', '(86) 99801-0354'],
    ['tel: 98 3248 3379', '(98) 3248-3379'],
  ])('formata %s como %s', (input, expected) => {
    expect(formatPhoneBR(input)).toBe(expected)
  })
})

describe('rotas', () => {
  it('abre a tela inicial para hash vazio ou desconhecido', () => {
    expect(parseRoute('')).toEqual({ name: 'welcome' })
    expect(parseRoute('#/qualquer/coisa')).toEqual({ name: 'welcome' })
    expect(parseRoute('#/u/teresina/sistemas')).toEqual({ name: 'welcome' })
  })

  it('lê a etapa do formulário', () => {
    expect(parseRoute('#/etapa/sistemas')).toEqual({ name: 'section', sectionId: 'sistemas' })
  })

  it('usa a primeira etapa quando a etapa não existe ou foi omitida', () => {
    expect(parseRoute('#/etapa/xyz')).toEqual({ name: 'section', sectionId: 'identificacao' })
    expect(parseRoute('#/etapa')).toEqual({ name: 'section', sectionId: 'identificacao' })
  })

  it('lê a revisão', () => {
    expect(parseRoute('#/revisao')).toEqual({ name: 'review' })
  })

  it('gera hashes que voltam à mesma rota', () => {
    const routes = [{ name: 'welcome' }, { name: 'section', sectionId: 'multiunidade' }, { name: 'review' }] as const
    for (const route of routes) expect(parseRoute(toHash(route))).toEqual(route)
  })
})

describe('arquivos', () => {
  it('formata tamanhos em pt-BR', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3,0 MB')
  })

  it('remove caminhos e caracteres proibidos do nome', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('C:\\temp\\planilha:v2?.xlsx')).toBe('planilha_v2_.xlsx')
    expect(safeFileName('   ')).toBe('arquivo')
  })

  it('limita nomes longos preservando a extensão', () => {
    const name = safeFileName(`${'a'.repeat(300)}.pdf`)
    expect(name.length).toBeLessThanOrEqual(120)
    expect(name.endsWith('.pdf')).toBe(true)
  })

  it('evita nomes repetidos', () => {
    const taken = new Set(['foto.jpg', 'foto (2).jpg'])
    expect(uniqueName('foto.jpg', taken)).toBe('foto (3).jpg')
    expect(uniqueName('nova.jpg', taken)).toBe('nova.jpg')
    expect(uniqueName('LEIAME', new Set(['LEIAME']))).toBe('LEIAME (2)')
  })

  it('monta o nome do pacote exportado', () => {
    expect(exportFileName(new Date('2026-09-28T12:00:00'), 'zip')).toBe('steriliza-requisitos-2026-09-28.zip')
  })
})

describe('copyText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, 'execCommand')
  })

  const stubExecCommand = (result: () => boolean) => {
    const execCommand = vi.fn(result)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    return execCommand
  }

  it('usa a Clipboard API quando existe', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyText('síntese')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('síntese')
  })

  it('sem a Clipboard API, copia pela seleção de um campo oculto e devolve o foco', async () => {
    vi.stubGlobal('navigator', {})
    const button = document.body.appendChild(document.createElement('button'))
    button.focus()
    let selected = ''
    const execCommand = stubExecCommand(() => {
      const area = document.activeElement as HTMLTextAreaElement
      selected = area.value.slice(area.selectionStart, area.selectionEnd)
      return true
    })

    await expect(copyText('síntese')).resolves.toBe(true)

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(selected).toBe('síntese')
    expect(document.querySelector('textarea')).toBeNull()
    expect(button).toHaveFocus()
    button.remove()
  })

  it('devolve false quando nenhum dos dois métodos funciona', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('permissão negada')) } })
    await expect(copyText('síntese')).resolves.toBe(false)

    stubExecCommand(() => {
      throw new Error('não suportado')
    })
    await expect(copyText('síntese')).resolves.toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })
})
