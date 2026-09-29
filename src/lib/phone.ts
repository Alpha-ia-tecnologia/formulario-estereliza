const MAX_DIGITS = 11
const DDD_LENGTH = 2
const MOBILE_LENGTH = 9

/** Aplica a máscara de telefone brasileiro enquanto a pessoa digita. */
export function formatPhoneBR(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, MAX_DIGITS)
  if (digits.length === 0) return ''
  if (digits.length <= DDD_LENGTH) return `(${digits}`
  const ddd = digits.slice(0, DDD_LENGTH)
  const rest = digits.slice(DDD_LENGTH)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  const split = rest.length === MOBILE_LENGTH ? 5 : 4
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}
