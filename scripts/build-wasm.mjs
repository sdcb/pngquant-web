// Publishes the .NET quantizer (wasm/) and copies its _framework into public/dotnet, where the worker loads it.
// Needs the .NET 10 SDK and its wasm-tools workload: `dotnet workload install wasm-tools`.
import { execFileSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const publish = `${root}wasm/bin/publish`
rmSync(publish, { recursive: true, force: true })
execFileSync('dotnet', ['publish', `${root}wasm/PngQuantWasm.csproj`, '-c', 'Release', '-o', publish], {
  stdio: 'inherit',
})
const target = `${root}public/dotnet`
rmSync(target, { recursive: true, force: true })
cpSync(`${publish}/wwwroot/_framework`, target, { recursive: true })
