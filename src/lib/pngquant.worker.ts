// Runs the .NET quantizer (Sdcb.SimdCodecs.Png compiled to WebAssembly, see wasm/) off the main thread.
// `npm run build:wasm` publishes it to public/dotnet.

export type WorkerQuantizeOptions = {
  quality?: {
    min: number
    target: number
  }
  maxColors?: number
  dithering?: boolean
}

export type WorkerQuantizeResult = {
  pngBytes: Uint8Array
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

type Exports = {
  Quantizer: {
    Quantize: (
      png: Uint8Array,
      minQuality: number,
      maxQuality: number,
      maxColors: number,
      dither: boolean,
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

/** Width, height and palette size, read from the PNG we just wrote (IHDR first, then PLTE before IDAT). */
function describe(png: Uint8Array): { width: number; height: number; paletteLength: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  let paletteLength = 0
  for (let at = 8; at + 8 <= png.byteLength; ) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(png[at + 4]!, png[at + 5]!, png[at + 6]!, png[at + 7]!)
    if (type === 'PLTE') {
      paletteLength = length / 3
      break
    }
    if (type === 'IDAT') {
      break
    }
    at += 12 + length
  }
  return { width, height, paletteLength }
}

async function quantizePngBytes(
  pngBytes: Uint8Array,
  options: WorkerQuantizeOptions,
): Promise<WorkerQuantizeResult> {
  const exports = await ensureInit()
  const output = exports.Quantizer.Quantize(
    pngBytes,
    options.quality?.min ?? 0,
    options.quality?.target ?? 100,
    options.maxColors ?? 256,
    options.dithering ?? false,
  )
  return { pngBytes: output, ...describe(output) }
}

// addEventListener, not onmessage: the .NET runtime's start-up waits forever in a worker whose onmessage is set
// (it takes the worker for one of its own).
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, pngBytes, options } = event.data

  void (async () => {
    try {
      const result = await quantizePngBytes(new Uint8Array(pngBytes), options ?? {})
      const pngBuffer = result.pngBytes.buffer.slice(
        result.pngBytes.byteOffset,
        result.pngBytes.byteOffset + result.pngBytes.byteLength,
      ) as ArrayBuffer
      const response: WorkerResponse = {
        id,
        success: true,
        result: { ...result, pngBytes: new Uint8Array(pngBuffer) },
      }
      ;(self as DedicatedWorkerGlobalScope).postMessage(response, [pngBuffer])
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
