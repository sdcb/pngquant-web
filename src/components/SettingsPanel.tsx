import { useState, type ReactNode } from 'react'
import {
  DEFAULT_OPTIONS,
  isDefaultOptions,
  toCliCommand,
  type Compression,
  type QuantizeOptions,
} from '../lib/pngquant'
import { useI18n } from '../i18n/context'
import type { Messages } from '../i18n/messages'

type Props = {
  options: QuantizeOptions
  onChange: (options: QuantizeOptions) => void
}

const COMPRESSION_CHOICES: { value: Compression; label: keyof Messages; hint: keyof Messages }[] = [
  { value: 'fast', label: 'compressionFast', hint: 'compressionFastHint' },
  { value: 'default', label: 'compressionDefault', hint: 'compressionDefaultHint' },
  { value: 'smallest', label: 'compressionSmallest', hint: 'compressionSmallestHint' },
]

export function SettingsPanel({ options, onChange }: Props) {
  const { t } = useI18n()
  const isDefault = isDefaultOptions(options)
  const command = toCliCommand(options)
  const { min, max } = options.quality

  const setQuality = (next: { min?: number; max?: number }) => {
    let nmin = next.min ?? min
    let nmax = next.max ?? max
    if (next.min !== undefined && nmin > nmax) nmax = nmin
    if (next.max !== undefined && nmax < nmin) nmin = nmax
    onChange({ ...options, quality: { min: nmin, max: nmax } })
  }

  const minPct = min
  const maxPct = max

  return (
    <section className="card flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-sm font-semibold tracking-wide text-fg">{t.settings}</h2>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => onChange(DEFAULT_OPTIONS)}
          className="rounded-md px-2 py-1 text-xs text-fg-2 transition hover:bg-white/5 hover:text-fg disabled:opacity-35 disabled:hover:bg-transparent"
        >
          {t.resetDefaults}
        </button>
      </div>

      <Field label={t.quality} value={`${min} – ${max}`} hint={t.qualityHint}>
        <div className="dual-range">
          <input
            type="range"
            className="range"
            min={0}
            max={100}
            value={min}
            aria-label={t.minQuality}
            style={{
              ['--track' as string]: `linear-gradient(90deg, var(--color-line-strong) ${minPct}%, var(--color-gold) ${minPct}% ${maxPct}%, var(--color-line-strong) ${maxPct}%)`,
            }}
            onChange={(e) => setQuality({ min: Number(e.target.value) })}
          />
          <input
            type="range"
            className="range"
            min={0}
            max={100}
            value={max}
            aria-label={t.maxQuality}
            onChange={(e) => setQuality({ max: Number(e.target.value) })}
          />
        </div>
      </Field>

      <Field label={t.maxColors} value={String(options.maxColors)}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="range"
            min={2}
            max={256}
            value={options.maxColors}
            aria-label={t.maxColors}
            style={{
              ['--track' as string]: `linear-gradient(90deg, var(--color-gold) ${((options.maxColors - 2) / 254) * 100}%, var(--color-line-strong) 0)`,
            }}
            onChange={(e) => onChange({ ...options, maxColors: Number(e.target.value) })}
          />
          <NumberBox
            value={options.maxColors}
            label={t.maxColors}
            min={2}
            max={256}
            onCommit={(maxColors) => onChange({ ...options, maxColors })}
          />
        </div>
      </Field>

      <div className="flex flex-col gap-3">
        <Toggle
          label={t.dithering}
          hint={t.ditheringHint}
          checked={options.dithering}
          onChange={(dithering) => onChange({ ...options, dithering })}
        />
        <Toggle
          label={t.keepMetadata}
          hint={t.keepMetadataHint}
          checked={options.keepMetadata}
          onChange={(keepMetadata) => onChange({ ...options, keepMetadata })}
        />
      </div>

      <Field label={t.compression}>
        <div role="radiogroup" aria-label={t.compression} className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-bg/60 p-1">
          {COMPRESSION_CHOICES.map((choice) => {
            const active = options.compression === choice.value
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={t[choice.hint] as string}
                onClick={() => onChange({ ...options, compression: choice.value })}
                className={[
                  'rounded-md py-1.5 text-xs font-medium transition',
                  active ? 'bg-surface-2 text-gold-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-fg-2 hover:text-fg',
                ].join(' ')}
              >
                {t[choice.label] as string}
              </button>
            )
          })}
        </div>
      </Field>

      <CommandPreview command={command} label={t.command} copyLabel={t.copy} copiedLabel={t.copied} />
    </section>
  )
}

function Field({ label, value, hint, children }: { label: string; value?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        {value ? <span className="tabular font-mono text-xs text-fg">{value}</span> : null}
      </div>
      {children}
      {hint ? <p className="m-0 text-[11px] leading-snug text-muted">{hint}</p> : null}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-lg text-left"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-fg-2">{label}</span>
        <span className="block text-[11px] leading-snug text-muted">{hint}</span>
      </span>
      <span
        aria-hidden
        className={[
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-gold' : 'bg-line-strong',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow transition-transform',
            checked ? 'translate-x-4 bg-bg' : 'bg-fg',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

function NumberBox({
  value,
  label,
  min,
  max,
  onCommit,
}: {
  value: number
  label: string
  min: number
  max: number
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Math.round(Number(draft))
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)))
    setDraft(null)
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setDraft(null)
      }}
      className="tabular h-7 w-14 shrink-0 rounded-md border border-line bg-bg/60 text-center font-mono text-xs outline-none focus:border-gold/60"
    />
  )
}

function CommandPreview({
  command,
  label,
  copyLabel,
  copiedLabel,
}: {
  command: string
  label: string
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(command).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1200)
            })
          }}
          className="rounded-md px-2 py-0.5 text-[11px] text-fg-2 transition hover:bg-white/5 hover:text-fg"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <code className="block rounded-lg border border-line bg-bg/70 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed break-words text-fg-2">
        <span className="text-muted select-none">$ </span>
        {command}
      </code>
    </div>
  )
}
