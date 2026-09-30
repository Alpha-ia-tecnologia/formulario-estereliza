import { useState } from 'react'
import type { Attachment } from '../draft/attachments'
import { buildExportJson, buildPackage, downloadBlob } from '../draft/package'
import type { Answers } from '../form/types'
import { type ApiClient, type Receipt, SendError } from '../lib/api'
import { exportFileName } from '../lib/files'
import { AlertIcon, CheckIcon, DownloadIcon, MailIcon, PrinterIcon, UploadIcon } from './Icons'

const EMAIL_ONLY = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const CONFIGURED_RECIPIENT = (import.meta.env.VITE_DESTINATARIO_EMAIL ?? '').trim()
// Só aceita um endereço simples, para que nada além dele entre no link mailto:.
const RECIPIENT = EMAIL_ONLY.test(CONFIGURED_RECIPIENT) ? CONFIGURED_RECIPIENT : ''

const GENERIC_SEND_ERROR = 'Não foi possível enviar. Tente de novo ou baixe o pacote e envie por e-mail.'
const PACKAGE_ERROR = 'Não foi possível gerar o pacote. Tente de novo ou use “Imprimir ou salvar PDF”.'

/** O que está acontecendo agora; o protocolo do último envio fica guardado à parte. */
type Activity =
  | { readonly status: 'idle' }
  | { readonly status: 'working'; readonly action: 'send' | 'download' }
  | { readonly status: 'downloaded'; readonly fileName: string }
  | { readonly status: 'error'; readonly message: string }

function mailtoHref(fileName: string): string {
  const subject = 'Requisitos do Sistema Steriliza (multiunidade)'
  const body = `Olá,\n\nSegue em anexo o pacote de respostas do formulário de requisitos do Sistema Steriliza (${fileName}).\n\nObrigado!`
  return `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function formatReceivedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : ` em ${date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
}

type SendPanelProps = {
  readonly answers: Answers
  readonly attachments: readonly Attachment[]
  readonly canExport: boolean
  /** Servidor que guarda as respostas; null quando não há (aí o caminho é baixar e enviar por e-mail). */
  readonly api: ApiClient | null
}

/** Painel lateral da revisão: enviar ao servidor ou baixar o pacote, imprimir e mandar por e-mail. */
export function SendPanel({ answers, attachments, canExport, api }: SendPanelProps) {
  const [activity, setActivity] = useState<Activity>({ status: 'idle' })
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const isWorking = activity.status === 'working'
  const isSending = isWorking && activity.action === 'send'
  const isPackaging = isWorking && activity.action === 'download'

  const handleSend = async () => {
    if (!api) return
    setReceipt(null)
    setActivity({ status: 'working', action: 'send' })
    try {
      const built = await buildPackage({ answers, attachments })
      setReceipt(await api.send(built.blob))
      setActivity({ status: 'idle' })
    } catch (error) {
      setActivity({ status: 'error', message: error instanceof SendError ? error.message : GENERIC_SEND_ERROR })
    }
  }

  const handleDownloadPackage = async () => {
    setActivity({ status: 'working', action: 'download' })
    try {
      const built = await buildPackage({ answers, attachments })
      downloadBlob(built.blob, built.fileName)
      setActivity({ status: 'downloaded', fileName: built.fileName })
    } catch {
      setActivity({ status: 'error', message: PACKAGE_ERROR })
    }
  }

  const handleDownloadJson = () => {
    const json = buildExportJson({ answers, attachments })
    downloadBlob(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), exportFileName(new Date(), 'json'))
  }

  const withAttachments = attachments.length > 0 ? ' e os anexos' : ''
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
        {api ? (
          <>
            <li>Confira as respostas ao lado.</li>
            <li>Toque em “Enviar respostas”: elas{withAttachments} ficam guardadas no servidor do projeto.</li>
          </>
        ) : (
          <>
            <li>Baixe o pacote com as respostas{withAttachments}.</li>
            <li>{sendStep}</li>
          </>
        )}
      </ol>

      {api ? (
        <button type="button" className="button button--primary send-panel__main" disabled={!canExport || isWorking} onClick={handleSend}>
          <UploadIcon width={20} height={20} />
          <span>{isSending ? 'Enviando…' : 'Enviar respostas'}</span>
        </button>
      ) : (
        <button
          type="button"
          className="button button--primary send-panel__main"
          disabled={!canExport || isWorking}
          onClick={handleDownloadPackage}
        >
          <DownloadIcon width={20} height={20} />
          <span>{isPackaging ? 'Gerando pacote…' : 'Baixar pacote (.zip)'}</span>
        </button>
      )}

      {receipt && (
        <div className="notice notice--success" role="status">
          <CheckIcon width={16} height={16} />
          <span>
            Respostas recebidas — <strong>protocolo nº {receipt.id}</strong>
            {formatReceivedAt(receipt.recebidoEm)}. Se mudar algo, é só enviar de novo.
          </span>
        </div>
      )}
      {activity.status === 'downloaded' && (
        <div className="notice notice--success" role="status">
          <CheckIcon width={16} height={16} />
          <span>
            Pacote <strong>{activity.fileName}</strong> baixado.{api ? '' : ' Agora é só enviar.'}
          </span>
        </div>
      )}
      {activity.status === 'error' && (
        <p className="notice notice--danger" role="alert">
          <AlertIcon width={18} height={18} />
          <span>{activity.message}</span>
        </p>
      )}
      {RECIPIENT && activity.status === 'downloaded' && (
        <a className="button button--outline" href={mailtoHref(activity.fileName)}>
          <MailIcon width={18} height={18} />
          <span>Abrir e-mail</span>
        </a>
      )}

      {api && (
        <button type="button" className="button button--outline" disabled={!canExport || isWorking} onClick={handleDownloadPackage}>
          <DownloadIcon width={18} height={18} />
          <span>{isPackaging ? 'Gerando pacote…' : 'Baixar uma cópia (.zip)'}</span>
        </button>
      )}
      <button type="button" className="button button--outline" onClick={() => window.print()}>
        <PrinterIcon width={18} height={18} />
        <span>Imprimir ou salvar PDF</span>
      </button>
      <button type="button" className="link-button send-panel__json" disabled={!canExport} onClick={handleDownloadJson}>
        Baixar só as respostas (.json)
      </button>
      <p className="send-panel__privacy">
        {api
          ? 'As respostas ficam neste navegador até você enviar. Ao enviar, vão para o servidor do projeto e ficam guardadas para análise.'
          : 'As respostas ficam só neste navegador até você baixar o pacote. Nada é enviado pela internet automaticamente.'}
      </p>
    </aside>
  )
}
