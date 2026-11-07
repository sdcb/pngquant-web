// Runs the .NET quantizer (Sdcb.SimdCodecs.Png compiled to WebAssembly, see wasm/) off the main thread, on any image
// the browser can decode: PNG goes straight to .NET, other formats are decoded by the browser first.
// `npm run build:wasm` publishes it to public/dotnet.

import { ERR_DECODE, ERR_NO_CANVAS } from '../i18n/messages'

export type WorkerQuantizeOptions = {
  minQuality: number
  maxQuality: number
  maxColors: number
  dithering: boolean
  /** System.IO.Compression.CompressionLevel: Optimal 0, Fastest 1, SmallestSize 3. */
  compressionLevel: number
  keepMetadata: boolean
}

export type WorkerQuantizeResult = {
  pngBytes: Uint8Array
  /** RGBA, 4 bytes per palette entry; empty when the output has no PLTE. */
  palette: Uint8Array
  paletteLength: number
  width: number
  height: number
}

type WorkerRequest = {
  id: number
  pngBytes: ArrayBuffer
  options: WorkerQuantizeOptions
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

type Exports = {
  Quantizer: {
    Quantize: (
      png: Uint8Array,
      minQuality: number,
      maxQuality: number,
      maxColors: number,
      dither: boolean,
      compressionLevel: number,
      keepMetadata: boolean,
    ) => Uint8Array
    QuantizeRgba: (
      rgba: Uint8Array,
      width: number,
      height: number,
      minQuality: number,
      maxQuality: number,
      maxColors: number,
      dither: boolean,
      compressionLevel: number,
    ) => Uint8Array
  }
}

let exportsPromise: Promise<Exports> | null = null

function ensureInit(): Promise<Exports> {
  exportsPromise ??= (async () => {
    const url = new URL(`${import.meta.env.BASE_URL}dotnet/dotnet.js`, self.location.origin).href
    const { dotnet } = await import(/* @vite-ignore */ url)
    const runtime = await dotnet.create()
    return (await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName)) as Exports
  })()
  exportsPromise.catch(() => {
    exportsPromise = null
  })
  return exportsPromise
}

// Start loading the runtime (about 2.5 MB compressed) as soon as the worker exists, before the first request.
void ensureInit().catch(() => undefined)

/** Width, height and palette (PLTE + tRNS), read from the PNG we just wrote; both chunks come before IDAT. */
function describe(png: Uint8Array): Omit<WorkerQuantizeResult, 'pngBytes'> {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  let palette = new Uint8Array(0)
  for (let at = 8; at + 8 <= png.byteLength; ) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(png[at + 4]!, png[at + 5]!, png[at + 6]!, png[at + 7]!)
    const data = at + 8
    if (type === 'PLTE') {
      const count = length / 3
      palette = new Uint8Array(count * 4)
      for (let i = 0; i < count; i++) {
        palette[i * 4] = png[data + i * 3]!
        palette[i * 4 + 1] = png[data + i * 3 + 1]!
        palette[i * 4 + 2] = png[data + i * 3 + 2]!
        palette[i * 4 + 3] = 255
      }
    } else if (type === 'tRNS' && palette.length > 0) {
      for (let i = 0; i < length && i * 4 + 3 < palette.length; i++) {
        palette[i * 4 + 3] = png[data + i]!
      }
    } else if (type === 'IDAT') {
      break
    }
    at += 12 + length
  }
  return { width, height, palette, paletteLength: palette.length / 4 }
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}

/** Lets the browser decode any format it supports (JPEG, WebP, AVIF, GIF's first frame, ...) into sRGB RGBA8. */
async function decodeWithBrowser(bytes: Uint8Array): Promise<{ rgba: Uint8Array; width: number; height: number }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'default',
    })
  } catch {
    throw new Error(ERR_DECODE)
  }
  try {
    const { width, height } = bitmap
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error(ERR_NO_CANVAS)
    ctx.drawImage(bitmap, 0, 0)
    const data = ctx.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data
    return { rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width, height }
  } finally {
    bitmap.close()
  }
}

async function quantizeImageBytes(
  bytes: Uint8Array,
  options: WorkerQuantizeOptions,
): Promise<WorkerQuantizeResult> {
  // PNG goes to the .NET reader, which keeps its colour-space chunks; everything else is decoded by the browser.
  const decoded = isPng(bytes) ? null : await decodeWithBrowser(bytes)
  const exports = await ensureInit()
  const output = decoded
    ? exports.Quantizer.QuantizeRgba(
        decoded.rgba,
        decoded.width,
        decoded.height,
        options.minQuality,
        options.maxQuality,
        options.maxColors,
        options.dithering,
        options.compressionLevel,
      )
    : exports.Quantizer.Quantize(
        bytes,
        options.minQuality,
        options.maxQuality,
        options.maxColors,
        options.dithering,
        options.compressionLevel,
        options.keepMetadata,
      )
  return { pngBytes: output, ...describe(output) }
}

// addEventListener, not onmessage: the .NET runtime's start-up waits forever in a worker whose onmessage is set
// (it takes the worker for one of its own).
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, pngBytes, options } = event.data

  void (async () => {
    try {
      const result = await quantizeImageBytes(new Uint8Array(pngBytes), options)
      const pngBuffer = result.pngBytes.buffer.slice(
        result.pngBytes.byteOffset,
        result.pngBytes.byteOffset + result.pngBytes.byteLength,
      ) as ArrayBuffer
      const response: WorkerResponse = {
        id,
        success: true,
        result: { ...result, pngBytes: new Uint8Array(pngBuffer) },
      }
      ;(self as DedicatedWorkerGlobalScope).postMessage(response, [pngBuffer, result.palette.buffer as ArrayBuffer])
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
})
