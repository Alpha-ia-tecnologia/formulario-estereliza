import { strToU8, unzipSync, zipSync } from 'fflate'
import { ImportError } from '../form/sanitize'
import type { Attachment } from './attachments'
import { JSON_NAME, MARKDOWN_NAME, buildExportJson, buildPackage, downloadBlob, readPackage, reconcileDocuments } from './package'

const NOW = new Date('2026-09-28T12:00:00')
const HEADER = { formulario: 'steriliza-requisitos', versao: 2 }

const attachment = (docKey: string, name: string, content: string): Attachment => ({
  id: `${docKey}-${name}-${content}`,
  docKey,
  name,
  type: 'text/plain',
  size: content.length,
  addedAt: NOW.toISOString(),
  blob: new Blob([content], { type: 'text/plain' }),
})

const asFile = (blob: Blob, name: string) => Object.assign(blob, { name })

describe('reconcileDocuments', () => {
  it('mantém "anexado" só para documentos que têm arquivo', () => {
    const answers = { documentos: { formularios: 'anexado', equipamentos: 'anexado', faturamento: 'depois' } }
    expect(reconcileDocuments(answers, [attachment('formularios', 'a.pdf', 'x')])).toEqual({
      documentos: { formularios: 'anexado', faturamento: 'depois' },
    })
  })

  it('remove a resposta quando nenhum documento sobra', () => {
    expect(reconcileDocuments({ documentos: { formularios: 'anexado' } }, [])).toEqual({})
  })

  it('não altera respostas sem documentos', () => {
    const answers = { '3.2': ['qr'] }
    expect(reconcileDocuments(answers, [])).toBe(answers)
  })
})

describe('buildExportJson', () => {
  it('inclui as unidades atendidas, respostas visíveis e resumo por unidade', () => {
    const json = buildExportJson({
      answers: {
        'ident.nome': 'Ana',
        'ident.unidades': ['sao-luis', 'teresina'],
        '1.3@sao-luis': 'turnos',
        '1.3@maracanau': '24h',
        '4.6': 'nao',
        '4.6.quais': 'oculto',
      },
      attachments: [attachment('formularios', 'planilha.xlsx', 'abc')],
      now: NOW,
    })
    expect(json).toMatchObject({
      formulario: 'steriliza-requisitos',
      versao: 2,
      unidades: ['São Luís — MA', 'Teresina — PI'],
      anexos: [{ documento: 'formularios', nome: 'planilha.xlsx', bytes: 3 }],
    })
    expect(json.respostas).toEqual({ 'ident.nome': 'Ana', 'ident.unidades': ['sao-luis', 'teresina'], '1.3@sao-luis': 'turnos', '4.6': 'nao' })
    expect(json.resumo.find((row) => row.numero === '1.3')?.resposta).toBe('São Luís: Turnos')
    expect(json.resumo.find((row) => row.numero === '3.2')?.resposta).toBeNull()
  })

  it('inclui a síntese estruturada, calculada só com as respostas exportadas', () => {
    const json = buildExportJson({
      answers: { 'ident.nome': 'Ana', 'ident.unidades': ['teresina'], '2.8@teresina': 'offline', '2.8@sao-luis': 'instavel' },
      attachments: [],
      now: NOW,
    })
    expect(json.sintese.headline).toMatch(/^Levantamento de requisitos da Steriliza para 1 unidade \(Teresina\), respondido por Ana/)
    expect(json.sintese.attention.map((point) => point.text)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Precisa funcionar sem internet em Teresina/)]),
    )
    expect(json.sintese.attention.some((point) => point.text.includes('São Luís'))).toBe(false)
  })
})

describe('pacote .zip', () => {
  it('gera o zip com respostas, resumo e anexos sem nomes repetidos', async () => {
    const built = await buildPackage({
      answers: { 'ident.nome': 'Ana' },
      attachments: [attachment('formularios', 'a.txt', 'um'), attachment('formularios', 'a.txt', 'dois')],
      now: NOW,
    })
    expect(built.fileName).toBe('steriliza-requisitos-2026-09-28.zip')
    const entries = unzipSync(new Uint8Array(await built.blob.arrayBuffer()))
    expect(Object.keys(entries).sort()).toEqual([JSON_NAME, MARKDOWN_NAME, 'anexos/formularios/a (2).txt', 'anexos/formularios/a.txt'].sort())
    const markdown = new TextDecoder().decode(entries[MARKDOWN_NAME])
    expect(markdown.indexOf('## Síntese')).toBeGreaterThan(markdown.indexOf('## 9. Documentos para anexar'))
  })

  it('importa de volta um pacote exportado, com anexos', async () => {
    const built = await buildPackage({
      answers: { 'ident.nome': 'Ana', '1.1@teresina': ['vapor'], documentos: { equipamentos: 'anexado' } },
      attachments: [attachment('equipamentos', 'lista.csv', 'autoclave')],
      now: NOW,
    })
    const imported = await readPackage(asFile(built.blob, built.fileName))
    expect(imported.answers).toEqual({ 'ident.nome': 'Ana', '1.1@teresina': ['vapor'], documentos: { equipamentos: 'anexado' } })
    expect(imported.files).toHaveLength(1)
    expect(imported.files[0]).toMatchObject({ docKey: 'equipamentos', name: 'lista.csv' })
    expect(imported.files[0]?.blob.type).toBe('text/csv')
    expect(await imported.files[0]?.blob.text()).toBe('autoclave')
  })

  it('importa um respostas.json avulso', async () => {
    const json = JSON.stringify({ ...HEADER, respostas: { '2.9': 'nuvem' } })
    expect(await readPackage(asFile(new Blob([json]), 'respostas.json'))).toEqual({ answers: { '2.9': 'nuvem' }, files: [] })
  })

  it('ignora arquivos fora da pasta de anexos ou de documentos desconhecidos', async () => {
    const zip = zipSync({
      [JSON_NAME]: strToU8(JSON.stringify({ ...HEADER, respostas: {} })),
      'anexos/inventado/x.txt': strToU8('x'),
      'outra/pasta.txt': strToU8('x'),
      'anexos/formularios/sub/pasta.txt': strToU8('x'),
    })
    expect((await readPackage(asFile(new Blob([zip]), 'pacote.zip'))).files).toEqual([])
  })

  describe('limites contra arquivos adulterados', () => {
    // O .zip compactado fica bem abaixo de maxTotalBytes; só o conteúdo descompactado estoura.
    const limits = { maxJsonBytes: 200, maxFileBytes: 1000, maxTotalBytes: 2000 }
    const header = JSON.stringify({ ...HEADER, respostas: {} })

    it('recusa respostas.json descompactado acima do limite', async () => {
      const zip = zipSync({ [JSON_NAME]: strToU8(header + ' '.repeat(500)) })
      await expect(readPackage(asFile(new Blob([zip]), 'pacote.zip'), limits)).rejects.toThrow(/grande demais/)
    })

    it('recusa quando a soma descompactada passa do limite total', async () => {
      const zip = zipSync({
        [JSON_NAME]: strToU8(header),
        'anexos/formularios/a.txt': strToU8('a'.repeat(900)),
        'anexos/formularios/b.txt': strToU8('b'.repeat(900)),
        'anexos/equipamentos/c.txt': strToU8('c'.repeat(900)),
      })
      expect(zip.length).toBeLessThan(limits.maxTotalBytes)
      await expect(readPackage(asFile(new Blob([zip]), 'pacote.zip'), limits)).rejects.toThrow(/grande demais/)
    })

    it('ignora anexos individuais acima do limite por arquivo', async () => {
      const zip = zipSync({
        [JSON_NAME]: strToU8(header),
        'anexos/formularios/grande.txt': strToU8('x'.repeat(1500)),
        'anexos/formularios/ok.txt': strToU8('ok'),
      })
      const imported = await readPackage(asFile(new Blob([zip]), 'pacote.zip'), limits)
      expect(imported.files.map((file) => file.name)).toEqual(['ok.txt'])
    })

    it('recusa respostas.json avulso acima do limite', async () => {
      await expect(readPackage(asFile(new Blob([header + ' '.repeat(500)]), 'respostas.json'), limits)).rejects.toThrow(/grande demais/)
    })
  })

  it('recusa JSON inválido com mensagem clara', async () => {
    await expect(readPackage(asFile(new Blob(['{oops']), 'respostas.json'))).rejects.toThrow(ImportError)
  })

  it('recusa zip corrompido', async () => {
    await expect(readPackage(asFile(new Blob(['nao sou zip']), 'pacote.zip'))).rejects.toThrow(/corrompido/)
  })

  it('recusa zip sem respostas.json', async () => {
    const zip = zipSync({ 'leia-me.txt': strToU8('oi') })
    await expect(readPackage(asFile(new Blob([zip]), 'pacote.zip'))).rejects.toThrow(/respostas\.json/)
  })
})

describe('downloadBlob', () => {
  it('cria um link temporário e dispara o download', () => {
    const createObjectURL = vi.fn(() => 'blob:teste')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.useFakeTimers()

    downloadBlob(new Blob(['x']), 'arquivo.zip')
    vi.runAllTimers()

    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:teste')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    click.mockRestore()
  })
})
