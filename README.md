# pngquant Web

纯前端 PNG 调色盘压缩工具，默认参数对齐：

```bash
pngquant --quality=0-20 --nofs input.png -o output.png
```

生产环境：<https://pngquant.sdcb.ai>
仓库：<https://github.com/sdcb/pngquant-web>

## 特点

- 纯前端静态站，图片只在浏览器本地处理，不上传服务器
- 基于 [Sdcb.SimdCodecs.Png](https://github.com/sdcb/SimdCodecs) 的有损调色板量化（MIT，纯托管 .NET，编译成 WebAssembly + SIMD 在浏览器里运行）
- 默认参数：`quality 0-20`、关闭抖动（`--nofs`），可在参数面板调整并一键恢复，等价 pngquant 命令实时显示
- 可调：质量区间、最大颜色数（2–256）、Floyd–Steinberg 抖动、压缩强度、是否保留色彩元数据（关闭相当于 `--strip`）；参数保存在本地浏览器
- 选图或改参数后自动压缩
- 前后对比滑块，支持 1×–8× 像素级缩放（Ctrl+滚轮）、拖动平移、透明棋盘格背景
- 调色板色块展示，点击复制色值；结果可下载或直接复制到剪贴板
- 不改图片宽高，只做调色盘压缩
- 输入支持 PNG，以及浏览器能解码的 JPEG / WebP / AVIF / GIF（首帧）等格式，输出统一为调色板 PNG。PNG 由 SimdCodecs 解码并保留色彩元数据；其他格式由浏览器解码成 sRGB 后再量化
- 拖到页面任意位置、Ctrl+V 粘贴或点击选择都能载入图片；也能直接从其他网页拖入图片（需对方允许跨域）
- 适合 Cloudflare Pages 静态托管

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- .NET 10 WebAssembly（Mono AOT）+ Sdcb.SimdCodecs.Png

## 本地运行

需要 Node.js 和 .NET 10 SDK（含 wasm-tools workload）：

```bash
dotnet workload install wasm-tools
npm install
npm run build:wasm   # 把 wasm/ 下的 .NET 量化器发布到 public/dotnet（改了 wasm/ 才需要重跑）
npm run dev
```

`Sdcb.SimdCodecs.Png` 的预览版发布在 `https://proget.starworks.cc:88/nuget/test/v3/index.json`（见 `wasm/nuget.config`），正式版会发布到 nuget.org。

默认开发地址：<http://localhost:5173/>

## 构建

```bash
npm run build:wasm
npm run build
```

产物输出到 `dist/`，可直接部署到 Cloudflare Pages 等静态托管。

本地预览构建结果：

```bash
npm run preview
```

## Cloudflare Pages

本仓库已配置 GitHub Actions：推送到 `main` 后自动 `npm run build:wasm` 和 `npm run build`，并用 `wrangler pages deploy dist` 发布。

需要在 GitHub 仓库 Secrets 中配置：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `CLOUDFLARE_PAGES_PROJECT` | Pages 项目名（例如 `pngquant-web`） |

自定义域名在 Cloudflare Pages 项目里绑定：`pngquant.sdcb.ai`。

## 默认压缩参数

| 参数 | 值 | 对应 CLI |
|------|----|----------|
| MinQuality | 0 | `--quality=0-20` |
| MaxQuality | 20 | `--quality=0-20` |
| Dither | false | `--nofs` |
| MaxColors | 256 | 默认 |
| CompressionLevel | SmallestSize | 无（只影响 deflate，像素不变） |
| 保留色彩元数据 | 是（ICC / sRGB / gAMA / cHRM / cICP） | 不加 `--strip` |

质量是 Sdcb.SimdCodecs 自己定义的 0–100 刻度（预乘 OKLab 的 RMS 误差），校准到与 pngquant 同一数值的 `--quality` 误差相近；调色板和文件是本库自己的结果，不追求与 pngquant 逐字节一致。

## License

本项目使用 [MIT License](./LICENSE)。

量化器 [Sdcb.SimdCodecs](https://github.com/sdcb/SimdCodecs) 同为 MIT。本站不包含 pngquant / libimagequant 的代码，“pngquant”仅指参数习惯与用途。
