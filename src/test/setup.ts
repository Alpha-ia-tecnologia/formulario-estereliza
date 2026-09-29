import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'

// jsdom não implementa rolagem.
window.scrollTo = () => undefined
Element.prototype.scrollIntoView = () => undefined

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = ''
})
