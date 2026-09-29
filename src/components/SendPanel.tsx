import { useState } from 'react'
import type { Attachment } from '../draft/attachments'
import { buildExportJson, buildPackage, downloadBlob } from '../draft/package'
import type { Answers } from '../form/types'
import { exportFileName } from '../lib/files'
import { AlertIcon, CheckIcon, DownloadIcon, MailIcon, PrinterIcon } from './Icons'

const EMAIL_ONLY = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const CONFIGURED_RECIPIENT = (import.meta.env.VITE_DESTINATARIO_EMAIL ?? '').trim()
// Só aceita um endereço simples, para que nada além dele entre no link mailto:.
const RECIPIENT = EMAIL_ONLY.test(CONFIGURED_RECIPIENT) ? CONFIGURED_RECIPIENT : ''

type ExportState =
  | { readonly status: 'idle' }
  | { readonly status: 'working' }
  | { readonly status: 'done'; readonly fileName: string }
  | { readonly status: 'error' }

function mailtoHref(fileName: string): string {
  const subject = 'Requisitos do Sistema Steriliza (multiunidade)'
  const body = `Olá,\n\nSegue em anexo o pacote de respostas do formulário de requisitos do Sistema Steriliza (${fileName}).\n\nObrigado!`
  return `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

type SendPanelProps = {
  readonly answers: Answers
  readonly attachments: readonly Attachment[]
  readonly canExport: boolean
}

/** Painel lateral da revisão: baixar o pacote, imprimir e enviar. */
export function SendPanel({ answers, attachments, canExport }: SendPanelProps) {
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const isWorking = exportState.status === 'working'

  const handleDownloadPackage = async () => {
    setExportState({ status: 'working' })
    try {
      const built = await buildPackage({ answers, attachments })
      downloadBlob(built.blob, built.fileName)
      setExportState({ status: 'done', fileName: built.fileName })
    } catch {
      setExportState({ status: 'error' })
    }
  }

  const handleDownloadJson = () => {
    const json = buildExportJson({ answers, attachments })
    downloadBlob(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), exportFileName(new Date(), 'json'))
  }

  const sendStep = RECIPIENT ? (
    <>
      Envie o arquivo para <strong>{RECIPIENT}</strong>.
    </>
  ) : (
    'Envie o arquivo para o responsável pelo projeto.'
  )

  return (
    <aside className="send-panel" aria-labelledby="enviar-titulo">
      <h2 id="enviar-titulo">Enviar respostas</h2>
      <ol className="send-panel__steps">
        <li>Baixe o pacote com as respostas{attachments.length > 0 ? ' e os anexos' : ''}.</li>
        <li>{sendStep}</li>
      </ol>
      <button
        type="button"
        className="button button--primary send-panel__main"
        disabled={!canExport || isWorking}
        onClick={handleDownloadPackage}
      >
        <DownloadIcon width={20} height={20} />
        <span>{isWorking ? 'Gerando pacote…' : 'Baixar pacote (.zip)'}</span>
      </button>
      {exportState.status === 'done' && (
        <div className="notice notice--success" role="status">
          <CheckIcon width={16} height={16} />
          <span>
            Pacote <strong>{exportState.fileName}</strong> baixado. Agora é só enviar.
          </span>
        </div>
      )}
      {exportState.status === 'error' && (
        <p className="notice notice--danger" role="alert">
          <AlertIcon width={18} height={18} />
          <span>Não foi possível gerar o pacote. Tente de novo ou use “Imprimir ou salvar PDF”.</span>
        </p>
      )}
      {RECIPIENT && exportState.status === 'done' && (
        <a className="button button--outline" href={mailtoHref(exportState.fileName)}>
          <MailIcon width={18} height={18} />
          <span>Abrir e-mail</span>
        </a>
      )}
      <button type="button" className="button button--outline" onClick={() => window.print()}>
        <PrinterIcon width={18} height={18} />
        <span>Imprimir ou salvar PDF</span>
      </button>
      <button type="button" className="link-button send-panel__json" disabled={!canExport} onClick={handleDownloadJson}>
        Baixar só as respostas (.json)
      </button>
      <p className="send-panel__privacy">
        As respostas ficam só neste navegador até você baixar o pacote. Nada é enviado pela internet automaticamente.
      </p>
    </aside>
  )
}
