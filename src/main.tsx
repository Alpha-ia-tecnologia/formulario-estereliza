import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/fields.css'
import './styles/matrix.css'
import './styles/per-unit.css'
import './styles/welcome.css'
import './styles/review.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
