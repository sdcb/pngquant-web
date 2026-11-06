# pngquant Web

纯前端 PNG 调色盘压缩工具，默认参数对齐：

```bash
pngquant --quality=0-20 --nofs input.png -o output.png
```

生产环境：<https://pngquant.sdcb.ai>
仓库：<https://github.com/sdcb/pngquant-web>

## 特点

- 纯前端静态站，图片只在浏览器本地处理，不上传服务器
- 基于 `libimagequant-wasm`（pngquant 同源量化库）
- 固定默认参数：`quality 0-20`、关闭抖动（`--nofs`）
- 不改图片宽高，只做调色盘压缩
- 支持拖拽 / 粘贴 / 点击选择 PNG，前后预览与一键下载
- 适合 Cloudflare Pages 静态托管

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- libimagequant-wasm

## 本地运行

```bash
npm install
npm run dev
```

默认开发地址：<http://localhost:5173/>

## 构建

```bash
npm run build
```

产物输出到 `dist/`，可直接部署到 Cloudflare Pages 等静态托管。

本地预览构建结果：

```bash
npm run preview
```

## Cloudflare Pages

本仓库已配置 GitHub Actions：推送到 `main` 后自动 `npm run build`，并用 `wrangler pages deploy dist` 发布。

需要在 GitHub 仓库 Secrets 中配置：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `CLOUDFLARE_PAGES_PROJECT` | Pages 项目名（例如 `pngquant-web`） |

自定义域名在 Cloudflare Pages 项目里绑定：`pngquant.sdcb.ai`。

也可在 Cloudflare 控制台直接接入本仓库，构建设置：

- Build command: `npm run build`
- Build output directory: `dist`

## 默认压缩参数

| 参数 | 值 | 对应 CLI |
|------|----|----------|
| quality.min | 0 | `--quality=0-20` |
| quality.target | 20 | `--quality=0-20` |
| dithering | 0 | `--nofs` |
| maxColors | 256 | 默认 |
| speed | 3 | 库默认附近 |

## License

本项目使用 [MIT License](./LICENSE)。

底层量化能力来自 [libimagequant](https://github.com/ImageOptim/libimagequant)（GPL-3.0 / 商业双许可）。本站包装层为 MIT；若你将 libimagequant 用于闭源商用产品，请自行确认其许可证要求。
