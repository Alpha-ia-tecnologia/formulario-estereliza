/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** E-mail que recebe os pacotes de respostas (opcional). */
  readonly VITE_DESTINATARIO_EMAIL?: string
  /** Origem do servidor que guarda as respostas, quando não é a mesma da página (opcional). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
