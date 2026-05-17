# HaloForge Image Studio Plugin

HaloForge Level 0 plugin for OpenAI-compatible image generation through the HaloForge Cloud managed gateway or a user-configured OpenAI-compatible endpoint.

The UI/workflow is intentionally modeled after [CookSleep/gpt_image_playground](https://github.com/CookSleep/gpt_image_playground): top toolbar, search/status/favorite filters, generated-task cards, reference-image editing, mask-based image edits, IndexedDB-backed local history, and a bottom floating input bar.

## Development

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5176
npm run typecheck
npm run build
```

The standalone Vite dev page runs in mock gateway mode when HaloForge has not injected the plugin host bridge. This is useful for browser smoke tests of layout, task flow, and request-shape logic.

## Host API

Inside HaloForge, the plugin uses the public SDK managed gateway:

- `enterpriseGateway().generateImages(...)`
- `enterpriseGateway().editImages(...)`
- `enterpriseGateway().listOutputs(...)`

Cloud or enterprise base URLs and upstream API keys stay server-side. In managed gateway mode the plugin only talks to `@haloforge/plugin-sdk` and requires `host_enterprise_gateway_access`.

Community installs can use the Settings dialog to set a custom OpenAI-compatible base URL such as `http://localhost:8000/v1`. That custom endpoint path runs through the Rust backend with the plugin `network_http` permission, so it can avoid browser CORS issues and keep the API key out of React component state.

## Generation Logs

Image Studio logs generation diagnostics into HaloForge's application log at `~/.haloforge/logs/haloforge.log.YYYY-MM-DD`.

- Frontend gateway calls log `Image Studio generation started`, `Image Studio generation succeeded`, and `Image Studio generation failed` through `createPluginLogger()`.
- Custom endpoint backend calls log `image request started`, `image request succeeded`, and `image request failed` through `ctx.log(...)`.
- Logged fields include task ID, gateway type, operation, model, size, count, quality, format, reference count, status, elapsed time, output count, asset count, and a short error summary.
- Logs intentionally do not include API keys, bearer tokens, prompt text, raw image data, or base64 payloads.

For a live verification run:

```bash
tail -f ~/.haloforge/logs/haloforge.log.$(date +%F)
```

## Package And Install

Use `hf-pack` to build the package, then use the HaloForge `hf` CLI to install it into the local workspace. In a HaloForge source checkout, run `npm run hf -- ...`; on Windows installed builds, reopen the terminal and run `hf ...` directly. On macOS, run `command -v hf` first because automatic PATH linking is not implemented yet.

```bash
cd /path/to/hf-plugin-image-studio
npm install
npm run plugin:check
npm run plugin:pack

cd /path/to/HaloForge
npm run hf -- plugin install local /path/to/hf-plugin-image-studio/dist/package/dev.haloforge.image-studio-0.1.3.hfpkg --json
npm run hf -- plugin list --json
```

The ordinary browser can validate the standalone plugin UI. Real managed-gateway image generation must be tested inside HaloForge/Tauri because a normal browser tab does not provide Tauri IPC or the HaloForge plugin host bridge.

## Release

```bash
gh workflow run "Plugin Release" \
  --repo HaloForgeAI/hf-plugin-image-studio \
  -f release_tag=v0.1.3 \
  -f release_name="Image Studio v0.1.3" \
  -f source=official
```
