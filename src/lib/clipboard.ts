/**
 * Copia texto para a área de transferência. Usa a Clipboard API quando o
 * navegador a oferece; senão (ex.: arquivo aberto do disco fora de contexto
 * seguro) seleciona o texto num campo oculto e usa o comando de cópia antigo.
 * Devolve se a cópia deu certo.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permissão negada ou página sem foco: tenta o método antigo abaixo.
    }
  }
  return copyBySelection(text)
}

function copyBySelection(text: string): boolean {
  if (typeof document.execCommand !== 'function') return false
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.setAttribute('aria-hidden', 'true')
  area.className = 'visually-hidden'
  document.body.append(area)
  area.focus({ preventScroll: true })
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
    previousFocus?.focus({ preventScroll: true })
  }
}
