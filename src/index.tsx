import { definePlugin, registerPlugin } from "@haloforge/plugin-sdk";
import { ImageStudioPanel } from "./panel/ImageStudioPanel";
import "./styles.css";

registerPlugin("dev.haloforge.image-studio", definePlugin({ panel: ImageStudioPanel }));

if (import.meta.env.DEV && !window.__hf_plugin_registry) {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    void Promise.all([
      import("@tauri-apps/api/mocks"),
      import("react-dom/client"),
    ]).then(([{ mockIPC, mockWindows }, { createRoot }]) => {
      mockWindows("main");
      mockIPC((command) => {
        if (command === "plugin:event|listen") return crypto.randomUUID();
        if (command === "plugin:event|unlisten") return undefined;
        return undefined;
      }, { shouldMockEvents: true });
      createRoot(rootElement).render(<ImageStudioPanel />);
    });
  }
}
