import { definePlugin, registerPlugin } from "@haloforge/plugin-sdk";
import { ImageStudioPanel } from "./panel/ImageStudioPanel";
import "./styles.css";

registerPlugin("dev.haloforge.image-studio", definePlugin({ panel: ImageStudioPanel }));
