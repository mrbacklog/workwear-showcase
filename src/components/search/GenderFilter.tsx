'use client'

export interface GenderInfo {
  code: string
  label: string
  modelCount: number
}

interface GenderFilterProps {
  genders: GenderInfo[]
  selected: Set<string>
  onToggle: (code: string) => void
}

const GENDER_ORDER = ['male', 'female', 'unisex', 'junior']
const GENDER_LABELS: Record<string, string> = {
  male: 'Man',
  female: 'Vrouw',
  unisex: 'Unisex',
  junior: 'Junior',
}

export default function GenderFilter({ genders, selected, onToggle }: GenderFilterProps) {
  if (genders.length === 0) return null

  const sorted = [...genders].sort(
    (a, b) => GENDER_ORDER.indexOf(a.code) - GENDER_ORDER.indexOf(b.code)
  )

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Geslacht
      </h2>
      <div className="flex flex-wrap gap-2">
        {sorted.map((g) => {
          const isSelected = selected.has(g.code)
          const isDisabled = g.modelCount === 0 && !isSelected

          return (
            <button
              key={g.code}
              type="button"
              disabled={isDisabled}
              onClick={() => onToggle(g.code)}
              className={`rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-gray-800 text-white'
                  : isDisabled
                    ? 'bg-gray-50 text-gray-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {GENDER_LABELS[g.code] ?? g.label}
              <span className={`ml-1 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                {g.modelCount}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
