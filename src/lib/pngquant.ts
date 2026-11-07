import type { WorkerQuantizeOptions, WorkerQuantizeResult } from './pngquant.worker'

export type Compression = 'fast' | 'default' | 'smallest'

export type QuantizeOptions = {
  quality: {
    min: number
    max: number
  }
  maxColors: number
  dithering: boolean
  compression: Compression
  keepMetadata: boolean
}

export type QuantizeResult = WorkerQuantizeResult

/** Matches: pngquant --quality=0-20 --nofs (plus the strongest deflate, which changes no pixel). */
export const DEFAULT_OPTIONS: QuantizeOptions = {
  quality: { min: 0, max: 20 },
  dithering: false,
  maxColors: 256,
  compression: 'smallest',
  keepMetadata: true,
}

/** System.IO.Compression.CompressionLevel values. */
const COMPRESSION_LEVEL: Record<Compression, number> = {
  default: 0,
  fast: 1,
  smallest: 3,
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

/** Fills in and clamps options read from an untrusted place (localStorage). */
export function normalizeOptions(raw: unknown): QuantizeOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<QuantizeOptions>
  const q = (o.quality && typeof o.quality === 'object' ? o.quality : {}) as Partial<QuantizeOptions['quality']>
  const max = clamp(q.max, 0, 100, DEFAULT_OPTIONS.quality.max)
  const min = Math.min(max, clamp(q.min, 0, 100, DEFAULT_OPTIONS.quality.min))
  const compression: Compression =
    o.compression === 'fast' || o.compression === 'default' || o.compression === 'smallest'
      ? o.compression
      : DEFAULT_OPTIONS.compression
  return {
    quality: { min, max },
    maxColors: clamp(o.maxColors, 2, 256, DEFAULT_OPTIONS.maxColors),
    dithering: typeof o.dithering === 'boolean' ? o.dithering : DEFAULT_OPTIONS.dithering,
    compression,
    keepMetadata: typeof o.keepMetadata === 'boolean' ? o.keepMetadata : DEFAULT_OPTIONS.keepMetadata,
  }
}

export function isDefaultOptions(options: QuantizeOptions): boolean {
  return (
    options.quality.min === DEFAULT_OPTIONS.quality.min &&
    options.quality.max === DEFAULT_OPTIONS.quality.max &&
    options.maxColors === DEFAULT_OPTIONS.maxColors &&
    options.dithering === DEFAULT_OPTIONS.dithering &&
    options.compression === DEFAULT_OPTIONS.compression &&
    options.keepMetadata === DEFAULT_OPTIONS.keepMetadata
  )
}

/** The pngquant command line these options correspond to (deflate strength has no exact CLI twin). */
export function toCliCommand(options: QuantizeOptions): string {
  const parts = ['pngquant', `--quality=${options.quality.min}-${options.quality.max}`]
  if (!options.dithering) parts.push('--nofs')
  if (options.keepMetadata === false) parts.push('--strip')
  if (options.maxColors !== 256) parts.push(String(options.maxColors))
  parts.push('input.png', '-o', 'output.png')
  return parts.join(' ')
}

type WorkerRequest = {
  id: number
  pngBytes: ArrayBuffer
  options: WorkerQuantizeOptions
}

type WorkerSuccess = {
  id: number
  success: true
  result: WorkerQuantizeResult
}

type WorkerFailure = {
  id: number
  success: false
  error: string
}

type Pending = {
  resolve: (value: QuantizeResult) => void
  reject: (reason?: unknown) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function getWorker(): Worker {
  if (worker) {
    return worker
  }

  worker = new Worker(new URL('./pngquant.worker.ts', import.meta.url), {
    type: 'module',
  })

  worker.onmessage = (event: MessageEvent<WorkerSuccess | WorkerFailure>) => {
    const message = event.data
    const entry = pending.get(message.id)
    if (!entry) {
      return
    }

    pending.delete(message.id)

    if (!message.success) {
      entry.reject(new Error(message.error))
      return
    }

    entry.resolve(message.result)
  }

  worker.onerror = (event) => {
    const error = new Error(event.message || 'pngquant worker failed')
    for (const entry of pending.values()) {
      entry.reject(error)
    }
    pending.clear()
    worker?.terminate()
    worker = null
  }

  return worker
}

export async function quantizePng(
  pngData: Blob | ArrayBuffer,
  options: QuantizeOptions = DEFAULT_OPTIONS,
): Promise<QuantizeResult> {
  const buffer = pngData instanceof Blob ? await pngData.arrayBuffer() : pngData.slice(0)
  const activeWorker = getWorker()
  const id = nextId++

  return new Promise<QuantizeResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })

    const request: WorkerRequest = {
      id,
      pngBytes: buffer,
      options: {
        minQuality: options.quality.min,
        maxQuality: options.quality.max,
        maxColors: options.maxColors,
        dithering: options.dithering,
        compressionLevel: COMPRESSION_LEVEL[options.compression],
        keepMetadata: options.keepMetadata,
      },
    }

    activeWorker.postMessage(request, [buffer])
  })
}

/** Creates the worker so the quantizer loads while the user is still choosing; quantizePng does this too. */
export function prepareQuantizer(): void {
  getWorker()
}

export function disposeQuantizer(): void {
  for (const entry of pending.values()) {
    entry.reject(new Error('pngquant disposed'))
  }
  pending.clear()
  worker?.terminate()
  worker = null
}
