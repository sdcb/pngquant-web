import { useCallback, useEffect, useRef, useState } from 'react'
import { CompareView } from './components/CompareView'
import { Dropzone } from './components/Dropzone'
import { PalettePanel } from './components/PalettePanel'
import { ResultBar } from './components/ResultBar'
import { SettingsPanel } from './components/SettingsPanel'
import { buildOutputName, formatBytes } from './lib/format'
import {
  DEFAULT_OPTIONS,
  disposeQuantizer,
  normalizeOptions,
  prepareQuantizer,
  quantizePng,
  type QuantizeOptions,
} from './lib/pngquant'
import { useI18n } from './i18n/context'
import { ERR_DECODE, ERR_NO_CANVAS, type Lang, type Messages } from './i18n/messages'

type SourceImage = {
  file: File
  url: string
  bytes: number
  width: number
  height: number
}

type ResultImage = {
  url: string
  bytes: number
  width: number
  height: number
  paletteLength: number
  palette: Uint8Array
  outputName: string
  blob: Blob
}

/** Errors are kept as codes and turned into text at render time, so they follow a language switch. */
const ERR_NOT_IMAGE = 'ERR_NOT_IMAGE'
const ERR_REMOTE_DROP = 'ERR_REMOTE_DROP'
const ERR_QUANTIZE = 'ERR_QUANTIZE'
const ERROR_TEXT: Record<string, keyof Messages> = {
  [ERR_NOT_IMAGE]: 'errNotImage',
  [ERR_REMOTE_DROP]: 'errRemoteDrop',
  [ERR_QUANTIZE]: 'errQuantize',
  [ERR_DECODE]: 'errDecode',
  [ERR_NO_CANVAS]: 'errNoCanvas',
}

function errorText(error: string, t: Messages): string {
  const key = ERROR_TEXT[error]
  return key ? (t[key] as string) : error
}

const STORAGE_KEY = 'pngquant-web:options'
const REQUANTIZE_DELAY_MS = 400

function loadOptions(): QuantizeOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeOptions(JSON.parse(raw)) : DEFAULT_OPTIONS
  } catch {
    return DEFAULT_OPTIONS
  }
}

function saveOptions(options: QuantizeOptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    // Storage blocked (private mode etc.): settings just don't persist.
  }
}

function revokeUrl(url: string | null | undefined) {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

const IMAGE_EXTENSION = /\.(png|apng|jpe?g|jfif|webp|avif|gif|bmp|ico|svg|tiff?|heic|heif)$/i

/** Anything that looks like an image; whether the browser can actually decode it is found out by readSize. */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXTENSION.test(file.name)
}

/** Lossy sources (JPEG, WebP, AVIF, ...) often come out bigger as a palette PNG. */
function isLosslessPngLike(file: File): boolean {
  return file.type === 'image/png' || file.type === 'image/apng' || /\.a?png$/i.test(file.name)
}

/** Files from the OS, or an image dragged out of another web page (only a URL then). */
function hasDroppable(dt: DataTransfer | null): boolean {
  return !!dt && (dt.types.includes('Files') || dt.types.includes('text/uri-list'))
}

async function fileFromUrl(url: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image')
  return new File([blob], name, { type: blob.type })
}

function readSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error(ERR_DECODE))
    img.src = url
  })
}

export default function App() {
  const { t, lang, setLang } = useI18n()
  const [source, setSource] = useState<SourceImage | null>(null)
  const [result, setResult] = useState<ResultImage | null>(null)
  const [options, setOptions] = useState<QuantizeOptions>(loadOptions)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const requestId = useRef(0)
  const lastSource = useRef<SourceImage | null>(null)

  useEffect(() => {
    return () => {
      disposeQuantizer()
    }
  }, [])

  useEffect(() => {
    saveOptions(options)
  }, [options])

  const replaceResult = useCallback((next: ResultImage | null) => {
    setResult((prev) => {
      if (prev !== next) revokeUrl(prev?.url)
      return next
    })
  }, [])

  const setSourceFile = useCallback(
    async (file: File | null) => {
      requestId.current++
      replaceResult(null)
      setElapsedMs(null)
      setError(null)
      setProcessing(false)

      if (!file) {
        setSource((prev) => {
          revokeUrl(prev?.url)
          return null
        })
        return
      }

      prepareQuantizer()
      const url = URL.createObjectURL(file)
      try {
        const size = await readSize(url)
        setSource((prev) => {
          revokeUrl(prev?.url)
          return { file, url, bytes: file.size, ...size }
        })
      } catch (err) {
        revokeUrl(url)
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [replaceResult],
  )

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      const file = files?.[0]
      if (!file) {
        return
      }

      if (!isImageFile(file)) {
        setError(ERR_NOT_IMAGE)
        return
      }

      void setSourceFile(file)
    },
    [setSourceFile],
  )

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) {
        return
      }

      for (const item of items) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) {
          continue
        }

        const file = item.getAsFile()
        if (!file) {
          continue
        }

        event.preventDefault()
        handleFiles([file])
        return
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handleFiles])

  // Drop anywhere on the page. Without this, a drop outside a drop target makes the browser open the file itself.
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    let depth = 0
    const onEnter = (event: DragEvent) => {
      if (!hasDroppable(event.dataTransfer)) return
      event.preventDefault()
      depth++
      setDragging(true)
    }
    const onOver = (event: DragEvent) => {
      if (!hasDroppable(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = 'copy'
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      const dt = event.dataTransfer
      if (!hasDroppable(dt)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      if (dt!.files.length > 0) {
        handleFiles(dt!.files)
        return
      }
      const url = dt!.getData('text/uri-list').split(/\r?\n/).find((line) => line && !line.startsWith('#'))
      if (!url) return
      void fileFromUrl(url).then(
        (file) => handleFiles([file]),
        () => setError(ERR_REMOTE_DROP),
      )
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFiles])

  const runQuantize = useCallback(
    async (image: SourceImage, opts: QuantizeOptions) => {
      const id = ++requestId.current
      setProcessing(true)
      setError(null)
      const started = performance.now()

      try {
        const quantized = await quantizePng(image.file, opts)
        if (id !== requestId.current) return
        const blob = new Blob([quantized.pngBytes as Uint8Array<ArrayBuffer>], { type: 'image/png' })
        replaceResult({
          url: URL.createObjectURL(blob),
          bytes: blob.size,
          width: quantized.width,
          height: quantized.height,
          paletteLength: quantized.paletteLength,
          palette: quantized.palette,
          outputName: buildOutputName(image.file.name),
          blob,
        })
        setElapsedMs(Math.round(performance.now() - started))
      } catch (err) {
        if (id !== requestId.current) return
        setError(err instanceof Error && err.message ? err.message : ERR_QUANTIZE)
      } finally {
        if (id === requestId.current) setProcessing(false)
      }
    },
    [replaceResult],
  )

  // Quantize right away for a new image; after a settings change, once the user pauses.
  useEffect(() => {
    if (!source) return
    const isNewSource = lastSource.current !== source
    const timer = window.setTimeout(
      () => {
        lastSource.current = source
        void runQuantize(source, options)
      },
      isNewSource ? 0 : REQUANTIZE_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [options, runQuantize, source])

  const download = useCallback(() => {
    if (!result) {
      return
    }

    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.outputName
    anchor.click()
  }, [result])

  return (
    <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-[10px] ring-1 ring-line-strong" />
          <div className="min-w-0">
            <h1 className="m-0 text-[17px] leading-tight font-semibold tracking-tight text-fg">pngquant Web</h1>
            <p className="m-0 truncate text-xs text-muted">{t.tagline}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LangSwitch lang={lang} onChange={setLang} label={t.langLabel} />
          <a
            href="https://github.com/sdcb/pngquant-web"
            target="_blank"
            rel="noreferrer"
            aria-label={t.githubLabel}
            title={t.githubLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-2 transition hover:border-line-strong hover:text-fg"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </header>

      <main className="grid flex-1 items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="order-2 flex flex-col gap-5 lg:order-none lg:sticky lg:top-6">
          {source ? (
            <section className="card flex items-center gap-3 p-3">
              <div className="checker-sm h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-line">
                <img src={source.url} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg" title={source.file.name}>
                  {source.file.name}
                </div>
                <div className="tabular font-mono text-[11px] text-muted">
                  {source.width}×{source.height} · {formatBytes(source.bytes)}
                </div>
              </div>
              <Dropzone onFiles={handleFiles} className="shrink-0 !border-solid border-line px-2.5 py-1.5 text-xs text-fg-2 hover:text-fg">
                {t.replace}
              </Dropzone>
              <button
                type="button"
                onClick={() => void setSourceFile(null)}
                aria-label={t.clearImage}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-white/5 hover:text-fg"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </section>
          ) : null}

          <SettingsPanel options={options} onChange={setOptions} />
        </aside>

        <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-none">
          {error ? (
            <div role="alert" className="fade-in rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-[#ffd9d4]">
              {errorText(error, t)}
            </div>
          ) : null}

          {source ? (
            <>
              <section className="card overflow-hidden">
                <CompareView
                  key={source.url}
                  beforeUrl={source.url}
                  afterUrl={result?.url ?? null}
                  width={source.width}
                  height={source.height}
                  processing={processing}
                />
                <ResultBar
                  sourceBytes={source.bytes}
                  result={result}
                  elapsedMs={elapsedMs}
                  processing={processing}
                  onDownload={download}
                />
              </section>

              {result && !isLosslessPngLike(source.file) && result.bytes >= source.bytes ? (
                <p className="m-0 px-1 text-xs text-muted">
                  {t.lossyHint}
                </p>
              ) : null}

              {result && result.paletteLength > 0 ? (
                <PalettePanel key={result.url} palette={result.palette} />
              ) : result ? (
                <p className="m-0 px-1 text-xs text-muted">
                  {t.noPaletteHint}
                </p>
              ) : null}
            </>
          ) : (
            <Dropzone
              onFiles={handleFiles}
              className="card flex min-h-[min(70vh,640px)] flex-col items-center justify-center gap-5 !border-dashed px-6 py-16 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line-strong bg-surface-2 text-gold">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 15V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-fg">{t.emptyTitle}</div>
                <p className="mx-auto mt-2 mb-0 max-w-md text-sm text-muted">
                  {t.emptyPastePrefix}{' '}
                  <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">Ctrl</kbd>{' '}
                  +{' '}
                  <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">V</kbd>
                  {lang === 'zh' ? ' ' : ''}
                  {t.emptyPasteSuffix}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-[11px] text-muted">
                {t.emptyTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-line px-2.5 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            </Dropzone>
          )}
        </div>
      </main>

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/75 p-6 backdrop-blur-sm">
          <div className="fade-in flex h-full max-h-[480px] w-full max-w-3xl flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-gold/70 bg-gold/[0.04]">
            <div className="text-xl font-semibold tracking-tight text-fg">{t.dropTitle}</div>
            <div className="text-sm text-muted">{t.dropHint}</div>
          </div>
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pb-2 text-[11px] text-muted">
        <span>MIT</span>
        <span aria-hidden>·</span>
        <span>
          {t.footerQuantizer}{' '}
          <a href="https://github.com/sdcb/SimdCodecs" target="_blank" rel="noreferrer" className="text-fg-2 no-underline hover:text-gold-soft">
            Sdcb.SimdCodecs
          </a>{' '}
          (.NET WebAssembly + SIMD)
        </span>
        <span aria-hidden>·</span>
        <a href="https://pngquant.sdcb.ai" className="text-fg-2 no-underline hover:text-gold-soft">
          pngquant.sdcb.ai
        </a>
      </footer>
    </div>
  )
}

function LangSwitch({ lang, onChange, label }: { lang: Lang; onChange: (lang: Lang) => void; label: string }) {
  const choices: { value: Lang; text: string; name: string }[] = [
    { value: 'zh', text: '中', name: '中文' },
    { value: 'en', text: 'EN', name: 'English' },
  ]
  return (
    <div role="radiogroup" aria-label={label} className="flex h-9 items-center gap-0.5 rounded-lg border border-line p-0.5">
      {choices.map((c) => {
        const active = lang === c.value
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.value)}
            className={[
              'h-full min-w-8 rounded-md px-2 text-xs font-medium transition',
              active ? 'bg-surface-2 text-gold-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            {c.text}
          </button>
        )
      })}
    </div>
  )
}
