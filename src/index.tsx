import { definePlugin, registerPlugin } from "@haloforge/plugin-sdk";
import { ImageStudioPanel } from "./panel/ImageStudioPanel";
import "./styles.css";

registerPlugin("dev.haloforge.image-studio", definePlugin({ panel: ImageStudioPanel }));

if (import.meta.env.DEV && !window.__hf_plugin_registry) {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    void import("react-dom/client").then(({ createRoot }) => {
      createRoot(rootElement).render(<ImageStudioPanel />);
    });
  }
}
