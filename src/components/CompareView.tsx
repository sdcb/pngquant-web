import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'

type Props = {
  beforeUrl: string
  afterUrl: string | null
  width: number
  height: number
  processing: boolean
}

type Size = { w: number; h: number }
type Point = { x: number; y: number }

const ZOOM_STEPS = [1, 2, 4, 8] as const
const MIN_SCALE = 0.05
const MAX_SCALE = 32

/**
 * Original and result stacked in the same box; the result is clipped to the right of a draggable divider.
 * Zoom (fit / 1× / 2× / 4× / 8×, Ctrl+wheel) and pan apply to both layers alike.
 */
export function CompareView({ beforeUrl, afterUrl, width, height, processing }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  const [box, setBox] = useState<Size>({ w: 0, h: 0 })
  /** null: fit the box. */
  const [zoom, setZoom] = useState<number | null>(null)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [split, setSplit] = useState(0.5)
  const drag = useRef<{ kind: 'split' | 'pan'; start: Point; pan: Point } | null>(null)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const fitScale = box.w > 0 && width > 0 ? Math.min(box.w / width, box.h / height, 1) : 1
  const scale = zoom ?? fitScale

  const clampPan = useCallback(
    (p: Point, s: number): Point => {
      const limX = Math.max(0, (width * s - box.w) / 2)
      const limY = Math.max(0, (height * s - box.h) / 2)
      return {
        x: Math.min(limX, Math.max(-limX, p.x)),
        y: Math.min(limY, Math.max(-limY, p.y)),
      }
    },
    [box.h, box.w, height, width],
  )

  /** Zooms to `next`, keeping the image point under `anchor` (box coordinates) where it is. */
  const zoomTo = useCallback(
    (next: number | null, anchor?: Point) => {
      const s1 = next ?? fitScale
      if (next === null) {
        setZoom(null)
        setPan({ x: 0, y: 0 })
        return
      }
      const a = anchor ?? { x: box.w / 2, y: box.h / 2 }
      const cx = box.w / 2 + pan.x
      const cy = box.h / 2 + pan.y
      const px = (a.x - cx) / scale
      const py = (a.y - cy) / scale
      const newPan = { x: a.x - px * s1 - box.w / 2, y: a.y - py * s1 - box.h / 2 }
      setZoom(s1)
      setPan(clampPan(newPan, s1))
    },
    [box.h, box.w, clampPan, fitScale, pan.x, pan.y, scale],
  )

  // Ctrl/⌘ + wheel zoom; needs a non-passive listener to stop the page from zooming.
  const zoomRef = useRef(zoomTo)
  zoomRef.current = zoomTo
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * 0.0025)
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * factor))
      zoomRef.current(next, { x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keep the pan legal when the box or scale changes.
  useEffect(() => {
    setPan((p) => {
      const c = clampPan(p, scale)
      return c.x === p.x && c.y === p.y ? p : c
    })
  }, [clampPan, scale])

  const canPan = width * scale > box.w + 0.5 || height * scale > box.h + 0.5

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    const kind = target.closest('[data-divider]') ? 'split' : canPan ? 'pan' : afterUrl ? 'split' : null
    if (!kind) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { kind, start: { x: event.clientX, y: event.clientY }, pan }
    if (kind === 'split') moveSplit(event.clientX)
  }

  const moveSplit = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setSplit(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)))
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    if (d.kind === 'split') {
      moveSplit(event.clientX)
    } else {
      setPan(clampPan({ x: d.pan.x + event.clientX - d.start.x, y: d.pan.y + event.clientY - d.start.y }, scale))
    }
  }

  const endDrag = () => {
    drag.current = null
  }

  const imgW = width * scale
  const imgH = height * scale
  const imgStyle: CSSProperties = {
    position: 'absolute',
    left: box.w / 2 - imgW / 2 + pan.x,
    top: box.h / 2 - imgH / 2 + pan.y,
    width: imgW,
    height: imgH,
    maxWidth: 'none',
    imageRendering: scale >= 2 ? 'pixelated' : 'auto',
    userSelect: 'none',
    pointerEvents: 'none',
  }
  const splitPct = `${split * 100}%`

  return (
    <div className="flex flex-col">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => zoomTo(zoom === null ? 1 : null)}
        className={[
          'checker relative h-[min(62vh,620px)] min-h-[300px] touch-none overflow-hidden rounded-t-[15px] select-none',
          canPan ? 'cursor-grab active:cursor-grabbing' : afterUrl ? 'cursor-ew-resize' : '',
        ].join(' ')}
      >
        <img src={beforeUrl} alt={t.original} draggable={false} style={imgStyle} />
        {afterUrl ? (
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${splitPct})` }}>
            <img src={afterUrl} alt={t.compressed} draggable={false} style={imgStyle} />
          </div>
        ) : null}

        {afterUrl ? (
          <>
            <div
              data-divider
              role="slider"
              tabIndex={0}
              aria-label={t.divider}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(split * 100)}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.1 : 0.02
                if (event.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - step))
                else if (event.key === 'ArrowRight') setSplit((s) => Math.min(1, s + step))
                else if (event.key === 'Home') setSplit(0)
                else if (event.key === 'End') setSplit(1)
                else return
                event.preventDefault()
              }}
              className="group absolute top-0 bottom-0 z-10 w-6 -translate-x-1/2 cursor-ew-resize outline-none"
              style={{ left: splitPct }}
            >
              <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-white/80 shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" />
              <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/55 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-gold">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M6 4 2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <Badge className="left-3">{t.original}</Badge>
            <Badge className="right-3">{t.compressed}</Badge>
          </>
        ) : (
          <Badge className="left-3">{t.original}</Badge>
        )}

        {processing ? <div className="sweep" /> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label={t.zoom}>
          <ZoomButton active={zoom === null} onClick={() => zoomTo(null)}>
            {t.zoomFit}
          </ZoomButton>
          {ZOOM_STEPS.map((z) => (
            <ZoomButton key={z} active={zoom === z} onClick={() => zoomTo(z)}>
              {z}×
            </ZoomButton>
          ))}
        </div>
        <div className="tabular font-mono text-[11px] text-muted">
          {Math.round(scale * 100)}%
          <span className="ml-3 hidden sm:inline">{t.zoomHelp}</span>
        </div>
      </div>
    </div>
  )
}

function Badge({ className, children }: { className: string; children: string }) {
  return (
    <span
      className={`pointer-events-none absolute top-3 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm ${className}`}
    >
      {children}
    </span>
  )
}

function ZoomButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'tabular rounded-md px-2 py-1 font-mono text-[11px] transition',
        active ? 'bg-surface-2 text-gold-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-fg-2 hover:bg-white/5 hover:text-fg',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
