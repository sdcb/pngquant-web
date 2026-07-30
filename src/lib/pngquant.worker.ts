import init, {
  decode_png_to_rgba,
  encode_palette_to_png,
  ImageQuantizer,
} from 'libimagequant-wasm/wasm/libimagequant_wasm.js'
import wasmUrl from 'libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url'

export type WorkerQuantizeOptions = {
  speed?: number
  quality?: {
    min: number
    target: number
  }
  maxColors?: number
  dithering?: number
  posterization?: number
}

export type WorkerQuantizeResult = {
  palette: number[][]
  pngBytes: Uint8Array
  imageDataBuffer: ArrayBuffer
  quality: number
  paletteLength: number
  width: number
  height: number
}

type WorkerRequest = {
  id: number
  pngBytes: ArrayBuffer
  options?: WorkerQuantizeOptions
}

type WorkerResponse =
  | {
      id: number
      success: true
      result: WorkerQuantizeResult
    }
  | {
      id: number
      success: false
      error: string
    }

let initPromise: Promise<void> | null = null

function ensureInit(): Promise<void> {
  initPromise ??= init({ module_or_path: wasmUrl }).then(() => undefined)
  return initPromise
}

function quantizeRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: WorkerQuantizeOptions = {},
): WorkerQuantizeResult {
  const quantizer = new ImageQuantizer()

  try {
    if (options.speed !== undefined) {
      quantizer.setSpeed(options.speed)
    }

    if (options.quality !== undefined) {
      quantizer.setQuality(options.quality.min, options.quality.target)
    }

    if (options.maxColors !== undefined) {
      quantizer.setMaxColors(options.maxColors)
    }

    if (options.posterization !== undefined) {
      quantizer.setPosterization(options.posterization)
    }

    const result = quantizer.quantizeImage(rgba, width, height)

    try {
      if (options.dithering !== undefined) {
        result.setDithering(options.dithering)
      }

      const palette = result.getPalette() as number[][]
      const quality = result.getQuantizationQuality()
      const paletteLength = result.getPaletteLength()
      const indices = result.getPaletteIndices(rgba, width, height)
      const pngBytes = encode_palette_to_png(indices, palette, width, height)

      const pixelCount = width * height
      const imageDataBuffer = new ArrayBuffer(pixelCount * 4)
      const imageData = new Uint8ClampedArray(imageDataBuffer)

      for (let i = 0; i < pixelCount; i += 1) {
        const color = palette[indices[i]]!
        const offset = i * 4
        imageData[offset] = color[0]!
        imageData[offset + 1] = color[1]!
        imageData[offset + 2] = color[2]!
        imageData[offset + 3] = color[3]!
      }

      return {
        palette,
        pngBytes,
        imageDataBuffer,
        quality,
        paletteLength,
        width,
        height,
      }
    } finally {
      result.free()
    }
  } finally {
    quantizer.free()
  }
}

function quantizePngBytes(
  pngBytes: Uint8Array,
  options: WorkerQuantizeOptions = {},
): WorkerQuantizeResult {
  const decoded = decode_png_to_rgba(pngBytes) as [
    Uint8ClampedArray,
    number,
    number,
  ]
  const [rgba, width, height] = decoded
  return quantizeRgba(rgba, width, height, options)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, pngBytes, options } = event.data

  void (async () => {
    try {
      await ensureInit()
      const result = quantizePngBytes(new Uint8Array(pngBytes), options ?? {})
      const pngBuffer = result.pngBytes.buffer.slice(
        result.pngBytes.byteOffset,
        result.pngBytes.byteOffset + result.pngBytes.byteLength,
      )
      const transferableResult: WorkerQuantizeResult = {
        ...result,
        pngBytes: new Uint8Array(pngBuffer),
      }
      const response: WorkerResponse = {
        id,
        success: true,
        result: transferableResult,
      }
      ;(self as DedicatedWorkerGlobalScope).postMessage(response, [
        pngBuffer,
        transferableResult.imageDataBuffer,
      ])
    } catch (error) {
      let message = 'Unknown error occurred'
      if (error instanceof Error && error.message) {
        message = error.message
      } else if (typeof error === 'string' && error.trim()) {
        message = error
      } else {
        try {
          message = JSON.stringify(error)
        } catch {
          message = String(error)
        }
      }

      const response: WorkerResponse = {
        id,
        success: false,
        error: message,
      }
      ;(self as DedicatedWorkerGlobalScope).postMessage(response)
    }
  })()
}
