# HaloForge Image Studio Plugin

Official HaloForge Level 0 plugin for OpenAI-compatible image generation through the HaloForge host enterprise gateway.

## Development

```bash
npm install
npm run typecheck
npm run build
```

The plugin expects HaloForge host API v1:

- `window.__HALOFORGE_PLUGIN_HOST__.enterpriseGateway.generateImages`
- `window.__HALOFORGE_PLUGIN_HOST__.enterpriseGateway.editImages`
- `window.__HALOFORGE_PLUGIN_HOST__.enterpriseGateway.listOutputs`

Enterprise base URLs and upstream API keys stay server-side. The plugin only talks to the HaloForge host bridge with its plugin id.
