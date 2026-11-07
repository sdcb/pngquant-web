import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/context'

type Props = {
  /** RGBA, 4 bytes per entry. */
  palette: Uint8Array
}

function hex(n: number) {
  return n.toString(16).padStart(2, '0').toUpperCase()
}

export function PalettePanel({ palette }: Props) {
  const [copied, setCopied] = useState<number | null>(null)
  const { t } = useI18n()
  const colors = useMemo(() => {
    const list: { r: number; g: number; b: number; a: number; code: string }[] = []
    for (let i = 0; i + 3 < palette.length; i += 4) {
      const r = palette[i]!
      const g = palette[i + 1]!
      const b = palette[i + 2]!
      const a = palette[i + 3]!
      list.push({ r, g, b, a, code: `#${hex(r)}${hex(g)}${hex(b)}${a === 255 ? '' : hex(a)}` })
    }
    return list
  }, [palette])

  return (
    <section className="card fade-in p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="m-0 text-sm font-semibold tracking-wide text-fg">{t.palette}</h2>
        <span className="tabular font-mono text-xs text-muted">
          {copied !== null ? t.copiedValue(colors[copied]?.code ?? '') : t.paletteCount(colors.length)}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] gap-1">
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            title={c.code}
            aria-label={c.code}
            onClick={() => {
              void navigator.clipboard?.writeText(c.code).then(() => {
                setCopied(i)
                window.setTimeout(() => setCopied((v) => (v === i ? null : v)), 1200)
              })
            }}
            className="checker-sm aspect-square overflow-hidden rounded-[5px] ring-1 ring-white/10 transition hover:z-10 hover:scale-125 hover:ring-white/60"
          >
            <span className="block h-full w-full" style={{ backgroundColor: `rgb(${c.r} ${c.g} ${c.b} / ${c.a / 255})` }} />
          </button>
        ))}
      </div>
    </section>
  )
}
