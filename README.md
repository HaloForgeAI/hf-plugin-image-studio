# HaloForge Image Studio Plugin

HaloForge Level 0 plugin for OpenAI-compatible image generation through the HaloForge enterprise gateway or a user-configured OpenAI-compatible endpoint.

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

Inside HaloForge, the plugin uses the public SDK gateway:

- `enterpriseGateway().generateImages(...)`
- `enterpriseGateway().editImages(...)`
- `enterpriseGateway().listOutputs(...)`

Enterprise base URLs and upstream API keys stay server-side. In enterprise mode the plugin only talks to `@haloforge/plugin-sdk` and requires `host_enterprise_gateway_access`.

Community installs can use the Settings dialog to set a custom OpenAI-compatible base URL such as `http://localhost:8000/v1`. That direct mode uses the plugin `network_http` permission and requires the target service to allow browser CORS.

## Package And Install

```bash
cd /Users/loyio/gitrepo/hf-plugin-image-studio
npm install
npm run plugin:check
npm run plugin:pack
cd /Users/loyio/gitRepo/HaloForge
npm run hf -- plugin install local /Users/loyio/gitrepo/hf-plugin-image-studio/dist/package/dev.haloforge.image-studio-0.2.4.hfpkg --json
```

The ordinary browser can validate the standalone plugin UI. Real enterprise image generation must be tested inside HaloForge/Tauri because a normal browser tab does not provide Tauri IPC or the HaloForge plugin host bridge.

## Release

```bash
gh workflow run "Plugin Release" \
  --repo HaloForgeAI/hf-plugin-image-studio \
  -f release_tag=v0.2.4 \
  -f release_name="Image Studio v0.2.4" \
  -f source=official
```
