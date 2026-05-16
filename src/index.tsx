import { definePlugin, registerPlugin } from "@haloforge/plugin-sdk";
import { createRoot } from "react-dom/client";
import { ImageStudioPanel } from "./panel/ImageStudioPanel";
import "./styles.css";

registerPlugin("dev.haloforge.image-studio", definePlugin({ panel: ImageStudioPanel }));

if (import.meta.env.DEV && !window.__hf_plugin_registry) {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<ImageStudioPanel />);
  }
}
