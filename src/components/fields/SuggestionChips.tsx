type SuggestionChipsProps = {
  readonly items: readonly string[]
  readonly isActive: (item: string) => boolean
  readonly isDisabled?: (item: string) => boolean
  readonly onPick: (item: string) => void
}

/** Respostas comuns em chips: tocar preenche, tocar de novo desfaz. */
export function SuggestionChips({ items, isActive, isDisabled, onPick }: SuggestionChipsProps) {
  if (items.length === 0) return null
  return (
    <div className="chips" role="group" aria-label="Sugestões de resposta">
      <span className="chips__label">Sugestões</span>
      {items.map((item) => {
        const active = isActive(item)
        return (
          <button
            key={item}
            type="button"
            className="chip"
            aria-pressed={active}
            disabled={!active && (isDisabled?.(item) ?? false)}
            onClick={() => onPick(item)}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}
