/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** E-mail que recebe os pacotes de respostas (opcional). */
  readonly VITE_DESTINATARIO_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
