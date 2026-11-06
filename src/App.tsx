import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildOutputName, formatBytes, formatPercent } from './lib/format'
import { DEFAULT_OPTIONS, disposeQuantizer, prepareQuantizer, quantizePng } from './lib/pngquant'

type SourceImage = {
  file: File
  url: string
  bytes: number
}

type ResultImage = {
  url: string
  bytes: number
  width: number
  height: number
  paletteLength: number
  outputName: string
  blob: Blob
}

function revokeUrl(url: string | null | undefined) {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

function isPngFile(file: File): boolean {
  if (file.type === 'image/png') {
    return true
  }
  return file.name.toLowerCase().endsWith('.png')
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<SourceImage | null>(null)
  const [result, setResult] = useState<ResultImage | null>(null)
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      disposeQuantizer()
    }
  }, [])

  const clearResult = useCallback(() => {
    setResult((prev) => {
      revokeUrl(prev?.url)
      return null
    })
    setElapsedMs(null)
  }, [])

  const setSourceFile = useCallback(
    (file: File | null) => {
      clearResult()
      setError(null)
      if (file) {
        prepareQuantizer()
      }

      setSource((prev) => {
        revokeUrl(prev?.url)
        if (!file) {
          return null
        }
        return {
          file,
          url: URL.createObjectURL(file),
          bytes: file.size,
        }
      })
    },
    [clearResult],
  )

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      const file = files?.[0]
      if (!file) {
        return
      }

      if (!isPngFile(file)) {
        setError('请选择 PNG 文件。')
        return
      }

      setSourceFile(file)
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

  const runQuantize = useCallback(async () => {
    if (!source || processing) {
      return
    }

    setProcessing(true)
    setError(null)
    clearResult()

    const started = performance.now()

    try {
      const quantized = await quantizePng(source.file, DEFAULT_OPTIONS)
      const bytes = quantized.pngBytes
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)
      const blob = new Blob([copy.buffer], { type: 'image/png' })
      const url = URL.createObjectURL(blob)

      setResult({
        url,
        bytes: blob.size,
        width: quantized.width,
        height: quantized.height,
        paletteLength: quantized.paletteLength,
        outputName: buildOutputName(source.file.name),
        blob,
      })
      setElapsedMs(Math.round(performance.now() - started))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '压缩失败，请换一张 PNG 再试。'
      setError(message)
    } finally {
      setProcessing(false)
    }
  }, [clearResult, processing, source])

  const download = useCallback(() => {
    if (!result) {
      return
    }

    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.outputName
    anchor.click()
  }, [result])

  const savings = useMemo(() => {
    if (!source || !result) {
      return null
    }
    const saved = source.bytes - result.bytes
    const ratio = source.bytes > 0 ? saved / source.bytes : 0
    return { saved, ratio }
  }, [result, source])

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.svg"
            alt=""
            className="h-10 w-10 rounded-[12px] shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
          />
          <div>
            <h1 className="m-0 font-serif text-[clamp(1.7rem,3vw,2.35rem)] leading-none text-[#f7f3eb]">
              pngquant Web
            </h1>
            <p className="mt-2 mb-0 text-sm text-[var(--muted)]">
              纯前端调色盘压缩 · 默认{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-[0.8rem] text-[var(--gold-soft)]">
                --quality=0-20 --nofs
              </code>
            </p>
          </div>
        </div>

        <a
          href="https://github.com/sdcb/pngquant-web"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-[#dce6f3] no-underline transition hover:border-[rgba(242,186,97,0.3)] hover:bg-white/[0.08] hover:text-white"
        >
          GitHub
        </a>
      </header>

      <main className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-[20px] border border-[var(--line)] bg-[image:var(--panel)] p-4 shadow-[0_12px_24px_rgba(0,0,0,0.22)] backdrop-blur-[14px] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 font-serif text-lg text-[#f8fbff]">选择 PNG</h2>
            {source ? (
              <button
                type="button"
                onClick={() => setSourceFile(null)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-sm text-[#dce6f3] transition hover:bg-white/[0.08]"
              >
                清除
              </button>
            ) : null}
          </div>

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                inputRef.current?.click()
              }
            }}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              handleFiles(event.dataTransfer.files)
            }}
            className={[
              'flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition',
              dragging
                ? 'border-[var(--gold)] bg-[rgba(242,186,97,0.08)]'
                : 'border-white/15 bg-[linear-gradient(180deg,rgba(7,12,18,0.86),rgba(14,19,28,0.98))] hover:border-[rgba(242,186,97,0.35)]',
            ].join(' ')}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,.png"
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files)
                event.currentTarget.value = ''
              }}
            />

            {source ? (
              <div className="flex w-full flex-col items-center gap-4">
                <img
                  src={source.url}
                  alt={source.file.name}
                  className="max-h-[320px] max-w-full rounded-xl object-contain shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                />
                <div className="text-sm text-[#dce6f3]">
                  <div className="font-semibold break-all">{source.file.name}</div>
                  <div className="mt-1 text-[var(--muted)]">
                    {formatBytes(source.bytes)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-sm">
                <div className="text-lg font-semibold text-[#f7f3eb]">
                  拖拽、粘贴 PNG，或点击选择
                </div>
                <p className="mt-2 mb-0 text-sm text-[var(--muted)]">
                  按 Ctrl+V 可直接粘贴剪贴板图片。图片只在浏览器本地处理，不会上传到服务器。
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!source || processing}
              onClick={() => {
                void runQuantize()
              }}
              className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f2ba61,#ffd38f)] px-5 text-sm font-bold text-[#0c1118] transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {processing ? '压缩中…' : 'pngquant'}
            </button>

            <div className="text-sm text-[var(--muted)]">
              等价命令：
              <code className="ml-1 rounded bg-white/5 px-1.5 py-0.5 text-[0.78rem] text-[#dce6f3]">
                pngquant --quality=0-20 --nofs input.png -o output.png
              </code>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-[20px] border border-[var(--line)] bg-[image:var(--panel)] p-4 shadow-[0_12px_24px_rgba(0,0,0,0.22)] backdrop-blur-[14px] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 font-serif text-lg text-[#f8fbff]">压缩结果</h2>
            {result ? (
              <button
                type="button"
                onClick={download}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-sm font-semibold text-[#dce6f3] transition hover:border-[rgba(242,186,97,0.3)] hover:bg-white/[0.08]"
              >
                下载
              </button>
            ) : null}
          </div>

          {result ? (
            <div className="flex flex-col gap-4">
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(7,12,18,0.86),rgba(14,19,28,0.98))] p-4">
                <img
                  src={result.url}
                  alt={result.outputName}
                  className="max-h-[320px] max-w-full rounded-xl object-contain shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Stat label="输出大小" value={formatBytes(result.bytes)} />
                <Stat
                  label="体积变化"
                  value={
                    savings
                      ? `${formatBytes(Math.abs(savings.saved))} (${formatPercent(savings.ratio)})`
                      : '-'
                  }
                />
                <Stat label="尺寸" value={`${result.width} × ${result.height}`} />
                <Stat label="调色板" value={`${result.paletteLength} 色`} />
                <Stat
                  label="耗时"
                  value={elapsedMs == null ? '-' : `${elapsedMs} ms`}
                />
              </dl>

              <p className="m-0 text-sm text-[var(--muted)]">
                文件名：
                <span className="text-[#dce6f3]">{result.outputName}</span>
              </p>
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(7,12,18,0.86),rgba(14,19,28,0.98))] px-6 text-center">
              <div className="text-lg font-semibold text-[#f7f3eb]">
                {processing ? '正在本地量化…' : '还没有结果'}
              </div>
              <p className="mt-2 mb-0 max-w-sm text-sm text-[var(--muted)]">
                {processing
                  ? '大图可能需要几秒，界面不会上传任何数据。'
                  : '选择 PNG 后点击 pngquant，结果会出现在这里。'}
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="pb-2 text-center text-xs text-[var(--muted)]">
        生产环境：
        <a
          href="https://pngquant.sdcb.ai"
          className="mx-1 text-[var(--gold-soft)] no-underline hover:underline"
        >
          https://pngquant.sdcb.ai
        </a>
        · MIT · 基于 Sdcb.SimdCodecs（.NET WebAssembly）
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <dt className="text-[0.75rem] tracking-wide text-[var(--muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 mb-0 font-semibold text-[#f3efe6]">{value}</dd>
    </div>
  )
}
