import { createPluginLogger, invokePlugin, notify, saveHostFile } from "@haloforge/plugin-sdk";
import type { ImageStudioT } from "./i18n";

const logger = createPluginLogger("image-studio-download");

interface WriteImageResult {
  path: string;
  bytes: number;
}

export async function saveGeneratedImage(source: string, baseName: string, t: ImageStudioT): Promise<void> {
  try {
    const payload = source.startsWith("blob:") ? await blobUrlToDataUrl(source) : source;
    const extension = imageExtension(payload) ?? imageExtension(source) ?? "png";
    const path = await saveHostFile({
      title: t("download.title"),
      defaultName: ensureExtension(sanitizeBaseName(baseName), extension),
      filters: [extension],
    });
    if (!path) return;

    const result = await invokePlugin<WriteImageResult>("image_studio_write_image_file", {
      path,
      dataUrl: payload,
    });
    notify({
      kind: "success",
      title: t("download.savedTitle"),
      message: t("download.saved", { path: result.path }),
      duration: 3600,
    });
  } catch (error) {
    await logger.error("Image Studio save failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    notify({
      kind: "error",
      title: t("download.failedTitle"),
      message: t("download.failed"),
      duration: 5000,
    });
  }
}

async function blobUrlToDataUrl(source: string): Promise<string> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image payload"));
    reader.readAsDataURL(blob);
  });
}

function imageExtension(source: string): string | null {
  const mime = source.match(/^data:(image\/[^;,]+)/)?.[1]?.toLowerCase();
  if (mime) {
    if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
  }

  try {
    const pathname = source.startsWith("http") ? new URL(source).pathname : source;
    const extension = pathname.match(/\.([a-z0-9]+)(?:$|[?#])/i)?.[1]?.toLowerCase();
    if (extension === "jpeg") return "jpg";
    if (extension === "jpg" || extension === "png" || extension === "webp") return extension;
  } catch {
    return null;
  }
  return null;
}

function ensureExtension(baseName: string, extension: string): string {
  const normalized = extension.replace(/^\./, "");
  return baseName.toLowerCase().endsWith(`.${normalized}`) ? baseName : `${baseName}.${normalized}`;
}

function sanitizeBaseName(baseName: string): string {
  const sanitized = baseName.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return sanitized || "image-studio-output";
}
