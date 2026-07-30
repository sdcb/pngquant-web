export type QuantizeOptions = {
  speed?: number
  quality?: {
    min: number
    target: number
  }
  maxColors?: number
  dithering?: number
  posterization?: number
}

export type QuantizeResult = {
  palette: number[][]
  pngBytes: Uint8Array
  imageData: ImageData
  quality: number
  paletteLength: number
  width: number
  height: number
}

/** Matches: pngquant --quality=0-20 --nofs */
export const DEFAULT_OPTIONS: Required<
  Pick<QuantizeOptions, 'quality' | 'dithering' | 'speed' | 'maxColors'>
> = {
  quality: { min: 0, target: 20 },
  dithering: 0,
  speed: 3,
  maxColors: 256,
}

type WorkerRequest = {
  id: number
  pngBytes: ArrayBuffer
  options?: QuantizeOptions
}

type WorkerSuccess = {
  id: number
  success: true
  result: {
    palette: number[][]
    pngBytes: Uint8Array
    imageDataBuffer: ArrayBuffer
    quality: number
    paletteLength: number
    width: number
    height: number
  }
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

    const { result } = message
    const imageData = new ImageData(
      new Uint8ClampedArray(result.imageDataBuffer),
      result.width,
      result.height,
    )

    entry.resolve({
      palette: result.palette,
      pngBytes: result.pngBytes,
      imageData,
      quality: result.quality,
      paletteLength: result.paletteLength,
      width: result.width,
      height: result.height,
    })
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

async function toArrayBuffer(
  pngData: Uint8Array | ArrayBuffer | Blob,
): Promise<ArrayBuffer> {
  if (pngData instanceof Blob) {
    return pngData.arrayBuffer()
  }

  if (pngData instanceof ArrayBuffer) {
    return pngData.slice(0)
  }

  const copy = new Uint8Array(pngData.byteLength)
  copy.set(pngData)
  return copy.buffer
}

export async function quantizePng(
  pngData: Uint8Array | ArrayBuffer | Blob,
  options: QuantizeOptions = DEFAULT_OPTIONS,
): Promise<QuantizeResult> {
  const buffer = await toArrayBuffer(pngData)
  const activeWorker = getWorker()
  const id = nextId++

  return new Promise<QuantizeResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })

    const request: WorkerRequest = {
      id,
      pngBytes: buffer,
      options: {
        ...DEFAULT_OPTIONS,
        ...options,
        quality: options.quality ?? DEFAULT_OPTIONS.quality,
      },
    }

    activeWorker.postMessage(request, [buffer])
  })
}

export function disposeQuantizer(): void {
  for (const entry of pending.values()) {
    entry.reject(new Error('pngquant disposed'))
  }
  pending.clear()
  worker?.terminate()
  worker = null
}
