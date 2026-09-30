import type { Attachment } from '../src/draft/attachments'
import { IMPORT_LIMITS, type ImportLimits, JSON_NAME, buildPackageFiles, readPackage, zipFiles } from '../src/draft/package'
import { overallProgress } from '../src/form/progress'
import { textOf } from '../src/form/read'
import type { NewResponse } from './store'

/**
 * Transforma o que chegou (o pacote .zip do botão "Baixar" ou um respostas.json
 * avulso) numa resposta normalizada: as respostas passam pela mesma validação
 * da importação e o JSON, o resumo.md e a síntese são refeitos aqui, sem
 * confiar no que o cliente mandou.
 */
export async function intake(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  now: Date,
  limits: ImportLimits = IMPORT_LIMITS,
): Promise<NewResponse> {
  const isJson = contentType.toLowerCase().startsWith('application/json')
  const imported = await readPackage(new File([bytes], isJson ? JSON_NAME : 'pacote.zip'), limits)
  const attachments = imported.files.map(
    (file, index): Attachment => ({
      id: String(index + 1),
      docKey: file.docKey,
      name: file.name,
      type: file.blob.type,
      size: file.blob.size,
      addedAt: now.toISOString(),
      blob: file.blob,
    }),
  )
  const built = await buildPackageFiles({ answers: imported.answers, attachments, now })
  return {
    recebidoEm: now.toISOString(),
    respondente: textOf(imported.answers, 'ident.nome'),
    cargo: textOf(imported.answers, 'ident.cargo'),
    unidades: built.json.unidades,
    preenchido: Math.round(overallProgress(imported.answers).ratio * 100),
    anexos: attachments.length,
    sintese: built.json.sintese.headline,
    dados: JSON.stringify(built.json, null, 2),
    resumo: built.markdown,
    pacote: zipFiles(built.files),
  }
}
