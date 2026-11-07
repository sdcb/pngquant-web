import { useState, type ReactNode } from 'react'
import {
  DEFAULT_OPTIONS,
  isDefaultOptions,
  toCliCommand,
  type Compression,
  type QuantizeOptions,
} from '../lib/pngquant'

type Props = {
  options: QuantizeOptions
  onChange: (options: QuantizeOptions) => void
}

const COMPRESSION_CHOICES: { value: Compression; label: string; hint: string }[] = [
  { value: 'fast', label: '快速', hint: 'Deflate Fastest：最快，文件稍大' },
  { value: 'default', label: '标准', hint: 'Deflate Optimal（zlib 6）' },
  { value: 'smallest', label: '最小', hint: 'Deflate SmallestSize：像素不变，文件最小' },
]

export function SettingsPanel({ options, onChange }: Props) {
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
        <h2 className="m-0 text-sm font-semibold tracking-wide text-fg">参数</h2>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => onChange(DEFAULT_OPTIONS)}
          className="rounded-md px-2 py-1 text-xs text-fg-2 transition hover:bg-white/5 hover:text-fg disabled:opacity-35 disabled:hover:bg-transparent"
        >
          恢复默认
        </button>
      </div>

      <Field label="质量区间" value={`${min} – ${max}`} hint="min 达不到时按无损写出；max 越低颜色越少、文件越小">
        <div className="dual-range">
          <input
            type="range"
            className="range"
            min={0}
            max={100}
            value={min}
            aria-label="最低质量"
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
            aria-label="目标质量"
            onChange={(e) => setQuality({ max: Number(e.target.value) })}
          />
        </div>
      </Field>

      <Field label="最大颜色数" value={String(options.maxColors)}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="range"
            min={2}
            max={256}
            value={options.maxColors}
            aria-label="最大颜色数"
            style={{
              ['--track' as string]: `linear-gradient(90deg, var(--color-gold) ${((options.maxColors - 2) / 254) * 100}%, var(--color-line-strong) 0)`,
            }}
            onChange={(e) => onChange({ ...options, maxColors: Number(e.target.value) })}
          />
          <NumberBox
            value={options.maxColors}
            min={2}
            max={256}
            onCommit={(maxColors) => onChange({ ...options, maxColors })}
          />
        </div>
      </Field>

      <div className="flex flex-col gap-3">
        <Toggle
          label="Floyd–Steinberg 抖动"
          hint="平滑渐变更顺，但文件更大"
          checked={options.dithering}
          onChange={(dithering) => onChange({ ...options, dithering })}
        />
        <Toggle
          label="保留色彩元数据"
          hint="ICC / sRGB / gAMA / cHRM / cICP；关闭相当于 --strip"
          checked={options.keepMetadata}
          onChange={(keepMetadata) => onChange({ ...options, keepMetadata })}
        />
      </div>

      <Field label="压缩强度">
        <div role="radiogroup" aria-label="压缩强度" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-bg/60 p-1">
          {COMPRESSION_CHOICES.map((choice) => {
            const active = options.compression === choice.value
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={choice.hint}
                onClick={() => onChange({ ...options, compression: choice.value })}
                className={[
                  'rounded-md py-1.5 text-xs font-medium transition',
                  active ? 'bg-surface-2 text-gold-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-fg-2 hover:text-fg',
                ].join(' ')}
              >
                {choice.label}
              </button>
            )
          })}
        </div>
      </Field>

      <CommandPreview command={command} />
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
  min,
  max,
  onCommit,
}: {
  value: number
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
      aria-label="最大颜色数"
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

function CommandPreview({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-2">等价命令</span>
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
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <code className="block rounded-lg border border-line bg-bg/70 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed break-words text-fg-2">
        <span className="text-muted select-none">$ </span>
        {command}
      </code>
    </div>
  )
}
