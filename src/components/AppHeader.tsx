import type { ReactNode } from 'react'
import logo from '../assets/logo-steriliza.png'
import type { SaveState } from '../draft/useDraft'
import { AlertIcon, CheckIcon } from './Icons'

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

function SaveIndicator({ save }: { save: SaveState }) {
  if (save.status === 'error') {
    return (
      <p className="save-indicator save-indicator--error" role="alert">
        <AlertIcon width={16} height={16} />
        <span>Não foi possível salvar neste navegador — baixe o pacote para não perder as respostas.</span>
      </p>
    )
  }
  if (save.status === 'idle') return null
  return (
    <p className="save-indicator">
      <CheckIcon width={14} height={14} />
      <span>
        Salvo <span className="save-indicator__time">às {timeFormat.format(save.at)}</span>
      </span>
    </p>
  )
}

type AppHeaderProps = {
  readonly save: SaveState
  readonly onHome: () => void
  readonly children?: ReactNode
}

export function AppHeader({ save, onHome, children }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <button type="button" className="app-header__logo" onClick={onHome} aria-label="Voltar ao início">
          <img src={logo} alt="Steriliza" width={150} height={20} />
        </button>
        <span className="app-header__divider" aria-hidden />
        <div className="app-header__context">
          <span className="app-header__title">Formulário de requisitos</span>
          <span className="app-header__unit">
            Sistema multiunidade<span className="app-header__unit-extra"> · todas as unidades</span>
          </span>
        </div>
      </div>
      <div className="app-header__actions">
        <SaveIndicator save={save} />
        {children}
      </div>
    </header>
  )
}
