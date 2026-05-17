import { createPluginLogger, enterpriseGateway, invokePlugin } from "@haloforge/plugin-sdk";
import type {
  EnterpriseGatewayApi,
  GatewayImageGenerationResult,
  GatewayOutputAsset,
  PluginGatewayImageEditRequest,
  PluginGatewayImageRequest,
} from "@haloforge/plugin-sdk";
import type { ImageStudioTranslationKey } from "./i18n";
import type { ImageStudioTask, ReferenceImage, StudioParams, StudioSettings } from "./types";

let logger: ReturnType<typeof createPluginLogger> | null = null;

function imageStudioLogger(): ReturnType<typeof createPluginLogger> {
  logger ??= createPluginLogger("image-studio");
  return logger;
}

declare global {
  interface Window {
    __HFIS_FORCE_HOST_GATEWAY__?: boolean;
  }
}

export function hasEnterpriseGateway(): boolean {
  return getEnterpriseGateway() !== null;
}

export function isUsingMockGateway(): boolean {
  return isDevGatewayEnabled() && getEnterpriseGateway() === null;
}

export function getGatewayState(settings: StudioSettings): { ready: boolean; labelKey: ImageStudioTranslationKey } {
  const enterpriseReady = hasEnterpriseGateway();
  const customReady = hasCustomGateway(settings);
  const mockReady = isUsingMockGateway();

  if (settings.gatewayMode === "cloud") {
    return enterpriseReady
      ? { ready: true, labelKey: "gateway.haloforgeCloud" }
      : { ready: mockReady, labelKey: mockReady ? "gateway.mock" : "gateway.cloudUnavailable" };
  }

  if (settings.gatewayMode === "custom") {
    return customReady
      ? { ready: true, labelKey: "gateway.custom" }
      : { ready: false, labelKey: "gateway.customRequired" };
  }

  if (enterpriseReady) return { ready: true, labelKey: "gateway.haloforgeCloud" };
  if (customReady) return { ready: true, labelKey: "gateway.custom" };
  if (mockReady) return { ready: true, labelKey: "gateway.mock" };
  return { ready: false, labelKey: "gateway.unavailable" };
}

export async function generateImageTask(input: {
  taskId?: string;
  prompt: string;
  params: StudioParams;
  references: ReferenceImage[];
  settings: StudioSettings;
}): Promise<Pick<ImageStudioTask, "outputs" | "assets" | "revisedPrompt">> {
  const baseRequest = {
    model: input.params.model,
    prompt: input.prompt,
    size: input.params.size,
    quality: input.params.quality,
    n: input.params.count,
    output_format: input.params.format,
    moderation: input.params.moderation,
    ...(input.params.compression == null ? {} : { output_compression: input.params.compression }),
    response_format: "b64_json" as const,
  };

  const maskedReference = input.references.find((reference) => reference.maskDataUrl);
  const orderedReferences = maskedReference
    ? [maskedReference, ...input.references.filter((reference) => reference.id !== maskedReference.id)]
    : input.references;
  const startedAt = performance.now();
  let resolvedGateway: ReturnType<typeof getGateway>;
  try {
    resolvedGateway = getGateway(input.settings);
  } catch (error) {
    await imageStudioLogger().error("Image Studio gateway unavailable", {
      taskId: input.taskId ?? null,
      gatewayMode: input.settings.gatewayMode,
      promptChars: input.prompt.length,
      referenceCount: orderedReferences.length,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: errorMessage(error),
    });
    throw error;
  }

  const operation = orderedReferences.length > 0 ? "edit" : "generation";
  const diagnosticDetails = {
    taskId: input.taskId ?? null,
    gateway: resolvedGateway.kind,
    operation,
    model: input.params.model,
    size: input.params.size,
    count: input.params.count,
    quality: input.params.quality,
    format: input.params.format,
    moderation: input.params.moderation,
    promptChars: input.prompt.length,
    referenceCount: orderedReferences.length,
    maskPresent: Boolean(maskedReference?.maskDataUrl),
  };

  await imageStudioLogger().info("Image Studio generation started", diagnosticDetails);

  try {
    const response = operation === "edit"
      ? await resolvedGateway.gateway.editImages({
        ...baseRequest,
        images: orderedReferences.map((reference) => ({
          field_name: "image",
          file_name: reference.name,
          content_type: reference.contentType,
          b64_json: stripDataUrl(reference.dataUrl),
        })),
        ...(maskedReference?.maskDataUrl
          ? {
            mask: {
              field_name: "mask",
              file_name: `${fileNameStem(maskedReference.name)}-mask.png`,
              content_type: "image/png",
              b64_json: stripDataUrl(maskedReference.maskDataUrl),
            },
          }
          : {}),
      })
      : await resolvedGateway.gateway.generateImages(baseRequest);

    const outputs = normalizeImages(response, input.params.format);
    const assets = response.hf_output_assets ?? [];
    await imageStudioLogger().info("Image Studio generation succeeded", {
      ...diagnosticDetails,
      elapsedMs: Math.round(performance.now() - startedAt),
      outputCount: outputs.length,
      assetCount: assets.length,
    });

    return {
      outputs,
      assets,
      revisedPrompt: response.data?.find((item) => item.revised_prompt)?.revised_prompt ?? null,
    };
  } catch (error) {
    await imageStudioLogger().error("Image Studio generation failed", {
      ...diagnosticDetails,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: errorMessage(error),
    });
    throw error;
  }
}

function normalizeImages(response: GatewayImageGenerationResult, format: StudioParams["format"]): string[] {
  return (response.data ?? [])
    .map((item) => {
      if (item.b64_json) return `data:${imageMime(format)};base64,${item.b64_json}`;
      return item.url ?? null;
    })
    .filter((value): value is string => Boolean(value));
}

function imageMime(format: StudioParams["format"]): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

function stripDataUrl(dataUrl: string): string {
  const marker = ";base64,";
  const index = dataUrl.indexOf(marker);
  return index >= 0 ? dataUrl.slice(index + marker.length) : dataUrl;
}

function fileNameStem(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf(".");
  return dot > 0 ? trimmed.slice(0, dot) : trimmed || "image";
}

type GatewayKind = "cloud" | "custom" | "mock";

function getGateway(settings: StudioSettings): { gateway: EnterpriseGatewayApi; kind: GatewayKind } {
  const enterprise = getEnterpriseGateway();
  const custom = hasCustomGateway(settings) ? createCustomGateway(settings) : null;

  if (settings.gatewayMode === "cloud") {
    if (enterprise) return { gateway: enterprise, kind: "cloud" };
    return { gateway: createDevMockOrThrow(), kind: "mock" };
  }
  if (settings.gatewayMode === "custom") {
    if (custom) return { gateway: custom, kind: "custom" };
    throw new Error("Custom image gateway base URL is required.");
  }

  if (enterprise) return { gateway: enterprise, kind: "cloud" };
  if (custom) return { gateway: custom, kind: "custom" };
  return { gateway: createDevMockOrThrow(), kind: "mock" };
}

function getEnterpriseGateway(): EnterpriseGatewayApi | null {
  try {
    return enterpriseGateway();
  } catch {
    return null;
  }
}

function createDevMockOrThrow(): EnterpriseGatewayApi {
  if (isDevGatewayEnabled()) return createMockGateway();
  throw new Error("Image gateway is unavailable. Configure a custom endpoint or sign in to HaloForge Cloud.");
}

function isDevGatewayEnabled(): boolean {
  return !window.__HFIS_FORCE_HOST_GATEWAY__ && import.meta.env.DEV;
}

function hasCustomGateway(settings: StudioSettings): boolean {
  return Boolean(settings.customBaseUrl.trim());
}

function createCustomGateway(settings: StudioSettings): EnterpriseGatewayApi {
  const baseUrl = settings.customBaseUrl.trim();
  const apiKey = settings.customApiKey.trim();
  return {
    generateImages: (request) => invokePlugin<GatewayImageGenerationResult>(
      "image_studio_generate_images",
      { baseUrl, apiKey, request },
    ),
    editImages: (request) => invokePlugin<GatewayImageGenerationResult>(
      "image_studio_edit_images",
      { baseUrl, apiKey, request },
    ),
    listOutputs: async () => ({ outputs: [] }),
  };
}

function createMockGateway(): EnterpriseGatewayApi {
  return {
    generateImages: async (request) => createMockResponse(request),
    editImages: async (request) => createMockResponse(request),
    listOutputs: async () => ({ outputs: [] }),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function createMockResponse(
  request: PluginGatewayImageRequest | PluginGatewayImageEditRequest,
): Promise<GatewayImageGenerationResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  const count = clampCount(Number(request.n ?? 1));
  const size = typeof request.size === "string" ? request.size : "1024x1024";
  const prompt = typeof request.prompt === "string" ? request.prompt : "HaloForge image";
  return {
    data: Array.from({ length: count }, (_, index) => ({
      url: `data:image/svg+xml;base64,${svgToBase64(createMockSvg({ prompt, size, index }))}`,
      revised_prompt: index === 0 ? prompt : undefined,
    })),
    hf_output_assets: Array.from({ length: count }, (_, index): GatewayOutputAsset => ({
      id: `mock-${Date.now()}-${index}`,
      public_url: "#",
      content_type: "image/svg+xml",
      size_bytes: 0,
      checksum_sha256: "mock",
      endpoint: "/v1/images/generations",
      object_ref: "mock",
    })),
  };
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(4, Math.round(value)));
}

function createMockSvg({ prompt, size, index }: { prompt: string; size: string; index: number }): string {
  const [width, height] = parseSize(size);
  const hue = (hashString(prompt) + index * 47) % 360;
  const title = escapeXml(prompt.slice(0, 72));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue},78%,56%)"/>
        <stop offset="0.52" stop-color="hsl(${(hue + 74) % 360},74%,50%)"/>
        <stop offset="1" stop-color="hsl(${(hue + 146) % 360},68%,42%)"/>
      </linearGradient>
      <pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M0 64L64 0M-16 16L16-16M48 80L80 48" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#p)"/>
    <circle cx="${width * 0.78}" cy="${height * 0.22}" r="${Math.min(width, height) * 0.14}" fill="rgba(255,255,255,.18)"/>
    <rect x="${width * 0.08}" y="${height * 0.68}" width="${width * 0.84}" height="${height * 0.18}" rx="22" fill="rgba(15,23,42,.62)"/>
    <text x="${width * 0.12}" y="${height * 0.77}" fill="white" font-size="${Math.max(24, Math.round(width / 28))}" font-family="Inter, Arial, sans-serif" font-weight="700">Image Studio Mock</text>
    <text x="${width * 0.12}" y="${height * 0.83}" fill="rgba(255,255,255,.78)" font-size="${Math.max(16, Math.round(width / 44))}" font-family="Inter, Arial, sans-serif">${title}</text>
  </svg>`;
}

function parseSize(size: string): [number, number] {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return [1024, 1024];
  return [Number(match[1]), Number(match[2])];
}

function svgToBase64(svg: string): string {
  return btoa(unescape(encodeURIComponent(svg)));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return Math.abs(hash);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
