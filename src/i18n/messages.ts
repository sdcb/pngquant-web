export type Lang = 'zh' | 'en'

/** Error codes the worker throws instead of text, so the page can show them in the current language. */
export const ERR_DECODE = 'ERR_DECODE'
export const ERR_NO_CANVAS = 'ERR_NO_CANVAS'

const zh = {
  htmlLang: 'zh-CN',
  description: '纯前端 pngquant：在浏览器本地把 PNG / JPEG / WebP / AVIF 压缩成调色板 PNG，不上传服务器。',
  tagline: '浏览器本地调色板压缩 · 图片不会离开你的设备',
  githubLabel: 'GitHub 仓库',
  langLabel: '语言',

  errNotImage: '请选择图片文件。',
  errDecode: '浏览器无法解码这张图片，请换成 PNG / JPEG / WebP / AVIF 等常见格式。',
  errNoCanvas: '当前浏览器不支持 OffscreenCanvas 2D。',
  errRemoteDrop: '无法读取拖入的网页图片（对方网站可能禁止跨域访问），请先保存到本地再拖入。',
  errQuantize: '压缩失败，请换一张图片再试。',

  replace: '更换',
  clearImage: '清除图片',
  pickImage: '选择图片文件',
  lossyHint: '源文件是有损格式（如 JPEG / WebP / AVIF），转成调色板 PNG 不一定更小；这类图更适合截图、图标、插画。',
  noPaletteHint: '输出没有调色板：可能最低质量没有达到，按无损写出；也可能结果是灰度图。',

  emptyTitle: '拖入图片，或点击选择',
  emptyPastePrefix: '也可以直接按',
  emptyPasteSuffix: '粘贴。量化在浏览器里用 WebAssembly 完成，不上传任何数据。',
  emptyTags: ['PNG / JPEG / WebP / AVIF', '前后对比', '像素级缩放', '本地处理'],
  dropTitle: '松开即可载入',
  dropHint: 'PNG、JPEG、WebP、AVIF、GIF 等浏览器能打开的图片',
  footerQuantizer: '量化器',

  original: '原图',
  compressed: '压缩后',
  divider: '对比分割线',
  zoom: '缩放',
  zoomFit: '适应',
  zoomHelp: 'Ctrl + 滚轮缩放 · 拖动平移 · 双击切换',

  palette: '调色板',
  paletteCount: (n: number) => `${n} 色 · 点击复制色值`,
  copiedValue: (v: string) => `已复制 ${v}`,

  statSize: '尺寸',
  statColors: '颜色',
  statTime: '耗时',
  noPalette: '无调色板',
  copyImage: '复制图片',
  copied: '已复制',
  copyFailed: '复制失败',
  download: '下载',

  settings: '参数',
  resetDefaults: '恢复默认',
  quality: '质量区间',
  qualityHint: 'min 达不到时按无损写出；max 越低颜色越少、文件越小',
  minQuality: '最低质量',
  maxQuality: '目标质量',
  maxColors: '最大颜色数',
  dithering: 'Floyd–Steinberg 抖动',
  ditheringHint: '平滑渐变更顺，但文件更大',
  keepMetadata: '保留色彩元数据',
  keepMetadataHint: 'ICC / sRGB / gAMA / cHRM / cICP；关闭相当于 --strip',
  compression: '压缩强度',
  compressionFast: '快速',
  compressionFastHint: 'Deflate Fastest：最快，文件稍大',
  compressionDefault: '标准',
  compressionDefaultHint: 'Deflate Optimal（zlib 6）',
  compressionSmallest: '最小',
  compressionSmallestHint: 'Deflate SmallestSize：像素不变，文件最小',
  command: '等价命令',
  copy: '复制',
}

export type Messages = typeof zh

const en: Messages = {
  htmlLang: 'en',
  description: 'pngquant in your browser: turn PNG / JPEG / WebP / AVIF into palette PNGs locally, nothing is uploaded.',
  tagline: 'Palette PNG compression in your browser · images never leave your device',
  githubLabel: 'GitHub repository',
  langLabel: 'Language',

  errNotImage: 'Please choose an image file.',
  errDecode: "Your browser can't decode this image. Try a common format such as PNG, JPEG, WebP or AVIF.",
  errNoCanvas: "This browser doesn't support OffscreenCanvas 2D.",
  errRemoteDrop: "Couldn't read the image dragged from that page (the site may block cross-origin access). Save it first, then drop the file.",
  errQuantize: 'Compression failed. Please try another image.',

  replace: 'Replace',
  clearImage: 'Clear image',
  pickImage: 'Choose an image file',
  lossyHint: "The source is a lossy format (JPEG / WebP / AVIF), so a palette PNG isn't always smaller. It works best on screenshots, icons and illustrations.",
  noPaletteHint: 'The output has no palette: either the minimum quality was not reached and the image was written losslessly, or the result is greyscale.',

  emptyTitle: 'Drop an image, or click to choose',
  emptyPastePrefix: 'You can also paste with',
  emptyPasteSuffix: '. Quantization runs in your browser with WebAssembly; nothing is uploaded.',
  emptyTags: ['PNG / JPEG / WebP / AVIF', 'Before / after', 'Pixel zoom', 'Runs locally'],
  dropTitle: 'Drop to load',
  dropHint: 'PNG, JPEG, WebP, AVIF, GIF or any image your browser can open',
  footerQuantizer: 'Quantizer',

  original: 'Original',
  compressed: 'Compressed',
  divider: 'Comparison divider',
  zoom: 'Zoom',
  zoomFit: 'Fit',
  zoomHelp: 'Ctrl + wheel to zoom · drag to pan · double-click to toggle',

  palette: 'Palette',
  paletteCount: (n: number) => `${n} colors · click to copy`,
  copiedValue: (v: string) => `Copied ${v}`,

  statSize: 'Size',
  statColors: 'Colors',
  statTime: 'Time',
  noPalette: 'No palette',
  copyImage: 'Copy image',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  download: 'Download',

  settings: 'Settings',
  resetDefaults: 'Reset',
  quality: 'Quality range',
  qualityHint: 'Below min, the image is written losslessly; a lower max means fewer colors and a smaller file',
  minQuality: 'Minimum quality',
  maxQuality: 'Target quality',
  maxColors: 'Max colors',
  dithering: 'Floyd–Steinberg dithering',
  ditheringHint: 'Smoother gradients, larger file',
  keepMetadata: 'Keep color metadata',
  keepMetadataHint: 'ICC / sRGB / gAMA / cHRM / cICP; off is like --strip',
  compression: 'Compression',
  compressionFast: 'Fast',
  compressionFastHint: 'Deflate Fastest: quickest, slightly larger file',
  compressionDefault: 'Standard',
  compressionDefaultHint: 'Deflate Optimal (zlib 6)',
  compressionSmallest: 'Smallest',
  compressionSmallestHint: 'Deflate SmallestSize: same pixels, smallest file',
  command: 'Equivalent command',
  copy: 'Copy',
}

export const MESSAGES: Record<Lang, Messages> = { zh, en }

/** Chinese for any zh-* browser language, English otherwise. */
export function detectLang(): Lang {
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  return langs.some((l) => l?.toLowerCase().startsWith('zh')) ? 'zh' : 'en'
}
