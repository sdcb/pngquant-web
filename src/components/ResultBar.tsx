import { useState } from 'react'
import { formatBytes, formatPercent } from '../lib/format'
import { useI18n } from '../i18n/context'

type Props = {
  sourceBytes: number
  result: {
    bytes: number
    width: number
    height: number
    paletteLength: number
    blob: Blob
  } | null
  elapsedMs: number | null
  processing: boolean
  onDownload: () => void
}

const canCopyImage =
  typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined'

export function ResultBar({ sourceBytes, result, elapsedMs, processing, onDownload }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle')
  const { t } = useI18n()

  const ratio = result && sourceBytes > 0 ? (sourceBytes - result.bytes) / sourceBytes : null
  const grew = ratio !== null && ratio < 0

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': result.blob })])
      setCopyState('done')
    } catch {
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 1400)
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-[96px]">
          <div
            className={[
              'tabular font-mono text-[2rem] leading-none font-medium tracking-tight',
              ratio === null ? 'text-muted' : grew ? 'text-bad' : 'text-gold',
            ].join(' ')}
          >
            {ratio === null ? (processing ? '…' : '–') : formatPercent(ratio)}
          </div>
          <div className="tabular mt-1.5 font-mono text-[11px] text-muted">
            {formatBytes(sourceBytes)} → {result ? formatBytes(result.bytes) : '…'}
          </div>
        </div>
        <dl className="m-0 flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <Stat label={t.statSize} value={result ? `${result.width}×${result.height}` : '–'} />
          <Stat
            label={t.statColors}
            value={result ? (result.paletteLength > 0 ? `${result.paletteLength}` : t.noPalette) : '–'}
          />
          <Stat label={t.statTime} value={elapsedMs == null ? '–' : `${elapsedMs} ms`} />
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canCopyImage ? (
          <button
            type="button"
            disabled={!result}
            onClick={() => void copy()}
            className="h-10 rounded-xl border border-line-strong px-4 text-sm font-medium text-fg-2 transition enabled:hover:border-white/25 enabled:hover:text-fg disabled:opacity-40"
          >
            {copyState === 'done' ? t.copied : copyState === 'failed' ? t.copyFailed : t.copyImage}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!result}
          onClick={onDownload}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-[#14110b] transition enabled:hover:bg-gold-soft disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 2v8m0 0 3.5-3.5M8 10 4.5 6.5M3 13h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t.download}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="tabular m-0 font-mono whitespace-nowrap text-fg">{value}</dd>
    </div>
  )
}
