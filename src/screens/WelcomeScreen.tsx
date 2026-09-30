import { useRef, useState } from 'react'
import hero from '../assets/hero-eto.webp'
import logo from '../assets/logo-steriliza.png'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AlertIcon, ArrowIcon, OrbitMark, TrashIcon, UploadIcon } from '../components/Icons'
import { useAttachmentStore } from '../draft/AttachmentsContext'
import { type ImportedPackage, readPackage } from '../draft/package'
import { createDraft, loadDraft, removeDraft, saveDraft } from '../draft/storage'
import { UNITS, UNIT_IDS, selectedUnits } from '../form/options'
import { overallProgress, visibleBlocks } from '../form/progress'
import { ImportError } from '../form/sanitize'
import { SECTIONS } from '../form/schema'

type WelcomeScreenProps = {
  readonly onStart: () => void
  readonly onImported: () => void
}

type Pending = { readonly kind: 'restart' } | { readonly kind: 'import'; readonly data: ImportedPackage }

/** Perguntas que todos veem; as de detalhe só aparecem conforme as respostas. */
const QUESTION_COUNT = SECTIONS.reduce((sum, section) => sum + visibleBlocks(section, {}).length, 0)
const STEP_COUNT = SECTIONS.length
const updatedFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function WelcomeScreen({ onStart, onImported }: WelcomeScreenProps) {
  const store = useAttachmentStore()
  const [draft, setDraft] = useState(() => loadDraft())
  const [pending, setPending] = useState<Pending | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const percent = draft ? Math.round(overallProgress(draft.answers).ratio * 100) : 0
  const activeUnits: readonly string[] = draft ? selectedUnits(draft.answers) : UNIT_IDS

  /**
   * Grava primeiro os anexos e só então substitui as respostas: se o navegador
   * recusar os arquivos, o rascunho anterior continua intacto.
   */
  const applyImport = async (data: ImportedPackage) => {
    try {
      await store.clear()
      for (const file of data.files) await store.add({ docKey: file.docKey, name: file.name, blob: file.blob })
      saveDraft({ ...createDraft(), answers: data.answers })
    } catch {
      setImportError('Não foi possível importar: o navegador recusou gravar as respostas ou os anexos. Libere espaço e tente de novo.')
      return
    }
    onImported()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    let data: ImportedPackage
    try {
      data = await readPackage(file)
    } catch (error) {
      setImportError(error instanceof ImportError ? error.message : 'Não foi possível importar este arquivo.')
      return
    }
    if (draft) setPending({ kind: 'import', data })
    else await applyImport(data)
  }

  const restart = async () => {
    removeDraft()
    try {
      await store.clear()
    } catch {
      setImportError('As respostas foram apagadas, mas não foi possível remover os anexos deste navegador.')
    }
    setDraft(null)
  }

  const confirmPending = async () => {
    if (!pending) return
    setPending(null)
    if (pending.kind === 'import') await applyImport(pending.data)
    else await restart()
  }

  return (
    <div className="welcome">
      <header className="welcome__bar">
        <img src={logo} alt="Steriliza" width={170} height={22} />
        <span className="welcome__bar-note">Sistema Steriliza · levantamento de requisitos</span>
      </header>

      <section className="welcome__hero" style={{ backgroundImage: `url(${hero})` }}>
        <div className="welcome__hero-inner">
          <p className="eyebrow eyebrow--light">Formulário de requisitos · Sistema multiunidade</p>
          <h1 className="welcome__title accent-title">Um sistema para todas as unidades.</h1>
          <p className="welcome__lead">
            Conte como a Steriliza trabalha hoje. É um formulário só, para todas as unidades, com perguntas de clicar.
            São {STEP_COUNT} etapas curtas, com salvamento automático.
          </p>
        </div>
      </section>

      <main className="welcome__main">
        <section className="start-panel" aria-labelledby="inicio-titulo">
          <h2 id="inicio-titulo">Unidades no novo sistema</h2>
          <ul className="tenant-grid">
            {UNITS.map((unit) => (
              <li key={unit.id} className="tenant" data-active={activeUnits.includes(unit.id)}>
                <OrbitMark className="tenant__mark" width={34} height={22} />
                <span className="tenant__state">{unit.state}</span>
                <span className="tenant__city">{unit.city}</span>
              </li>
            ))}
          </ul>

          <div className="start-panel__status">
            {draft ? (
              <>
                <p className="start-panel__progress">
                  <strong>{percent}%</strong> respondido · atualizado em {updatedFormat.format(new Date(draft.updatedAt))}
                </p>
                <span className="progress-track" aria-hidden>
                  <span className="progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
                </span>
              </>
            ) : (
              <p className="start-panel__hint">Nada respondido ainda. Leva cerca de 20 minutos e dá para parar e continuar depois.</p>
            )}
          </div>

          <div className="start-panel__actions">
            <button type="button" className="button button--primary start-panel__main" onClick={onStart}>
              <span>{draft ? 'Continuar de onde parei' : 'Começar agora'}</span>
              <span className="arrow-circle"><ArrowIcon /></span>
            </button>
            {draft && (
              <button type="button" className="button button--ghost button--small" onClick={() => setPending({ kind: 'restart' })}>
                <TrashIcon width={16} height={16} />
                <span>Recomeçar</span>
              </button>
            )}
          </div>
        </section>

        <section className="how" aria-label="Como funciona">
          <ol className="how__steps">
            <li><strong>Identifique-se</strong><span>e confirme as unidades que o sistema vai atender.</span></li>
            <li><strong>Responda {QUESTION_COUNT} perguntas</strong><span>Quase todas são de clicar. Detalhes aparecem só para os módulos que forem prioridade. O que não se aplicar pode ficar em branco.</span></li>
            <li><strong>Revise e baixe o pacote</strong><span>com respostas e anexos, pronto para enviar.</span></li>
          </ol>
          <div className="how__import">
            <button type="button" className="button button--ghost button--small" onClick={() => fileInput.current?.click()}>
              <UploadIcon width={18} height={18} />
              <span>Continuar de um arquivo (.zip ou .json)</span>
            </button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept=".zip,.json,application/zip,application/json"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void handleFile(file)
              }}
            />
            {importError && (
              <p className="notice notice--danger" role="alert">
                <AlertIcon width={18} height={18} />
                <span>{importError}</span>
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="welcome__footer">
        <p>Steriliza Corporation · Compromisso com a excelência em serviços de esterilização.</p>
        <p>As respostas ficam só neste navegador até você baixar o pacote.</p>
      </footer>

      <ConfirmDialog
        open={pending !== null}
        tone={pending?.kind === 'restart' ? 'danger' : 'default'}
        title={pending?.kind === 'restart' ? 'Recomeçar o formulário?' : 'Substituir as respostas?'}
        message={
          pending?.kind === 'restart'
            ? 'As respostas e os anexos salvos neste navegador serão apagados.'
            : 'Já existem respostas neste navegador. Elas serão substituídas pelo conteúdo do arquivo.'
        }
        confirmLabel={pending?.kind === 'restart' ? 'Apagar e recomeçar' : 'Substituir'}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
