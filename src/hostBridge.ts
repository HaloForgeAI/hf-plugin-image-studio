import { enterpriseGateway } from "@haloforge/plugin-sdk";
import type {
  EnterpriseGatewayApi,
  GatewayImageGenerationResult,
  GatewayOutputAsset,
  PluginGatewayImageEditRequest,
  PluginGatewayImageRequest,
} from "@haloforge/plugin-sdk";
import type { ImageStudioTask, ReferenceImage, StudioParams, StudioSettings } from "./types";

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

export function getGatewayState(settings: StudioSettings): { ready: boolean; label: string } {
  const enterpriseReady = hasEnterpriseGateway();
  const customReady = hasCustomGateway(settings);
  const mockReady = isUsingMockGateway();

  if (settings.gatewayMode === "enterprise") {
    return enterpriseReady
      ? { ready: true, label: "Enterprise gateway" }
      : { ready: mockReady, label: mockReady ? "Mock gateway" : "Enterprise unavailable" };
  }

  if (settings.gatewayMode === "custom") {
    return customReady
      ? { ready: true, label: "Custom gateway" }
      : { ready: false, label: "Custom URL required" };
  }

  if (enterpriseReady) return { ready: true, label: "Enterprise gateway" };
  if (customReady) return { ready: true, label: "Custom gateway" };
  if (mockReady) return { ready: true, label: "Mock gateway" };
  return { ready: false, label: "Gateway unavailable" };
}

export async function generateImageTask(input: {
  prompt: string;
  params: StudioParams;
  references: ReferenceImage[];
  settings: StudioSettings;
}): Promise<Pick<ImageStudioTask, "outputs" | "assets" | "revisedPrompt">> {
  const gateway = getGateway(input.settings);

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

  const response = orderedReferences.length > 0 && gateway.editImages
    ? await gateway.editImages({
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
    : await gateway.generateImages(baseRequest);

  return {
    outputs: normalizeImages(response, input.params.format),
    assets: response.hf_output_assets ?? [],
    revisedPrompt: response.data?.find((item) => item.revised_prompt)?.revised_prompt ?? null,
  };
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

function getGateway(settings: StudioSettings): EnterpriseGatewayApi {
  const enterprise = getEnterpriseGateway();
  const custom = hasCustomGateway(settings) ? createCustomGateway(settings) : null;

  if (settings.gatewayMode === "enterprise") return enterprise ?? createDevMockOrThrow();
  if (settings.gatewayMode === "custom") {
    if (custom) return custom;
    throw new Error("Custom image gateway base URL is required.");
  }

  return enterprise ?? custom ?? createDevMockOrThrow();
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
  throw new Error("Image gateway is unavailable. Configure a custom endpoint or use HaloForge Enterprise.");
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
    generateImages: (request) => customJsonRequest(baseUrl, apiKey, "images/generations", request),
    editImages: (request) => customEditRequest(baseUrl, apiKey, request),
    listOutputs: async () => ({ outputs: [] }),
  };
}

async function customJsonRequest(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: PluginGatewayImageRequest,
): Promise<GatewayImageGenerationResult> {
  const response = await fetch(resolveEndpoint(baseUrl, path), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(apiKey),
    },
    body: JSON.stringify(body),
  });
  return parseGatewayResponse(response);
}

async function customEditRequest(
  baseUrl: string,
  apiKey: string,
  request: PluginGatewayImageEditRequest,
): Promise<GatewayImageGenerationResult> {
  const form = new FormData();
  appendFormValue(form, "model", request.model);
  appendFormValue(form, "prompt", request.prompt);
  appendFormValue(form, "size", request.size);
  appendFormValue(form, "n", request.n);
  appendFormValue(form, "quality", request.quality);
  appendFormValue(form, "output_format", request.output_format);
  appendFormValue(form, "output_compression", request.output_compression);
  appendFormValue(form, "moderation", request.moderation);
  appendFormValue(form, "response_format", request.response_format);
  appendFormValue(form, "user", request.user);

  for (const image of request.images) {
    form.append(image.field_name ?? "image", b64ToBlob(image.b64_json, image.content_type), image.file_name);
  }
  if (request.mask) {
    form.append(request.mask.field_name ?? "mask", b64ToBlob(request.mask.b64_json, request.mask.content_type), request.mask.file_name);
  }

  const response = await fetch(resolveEndpoint(baseUrl, "images/edits"), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: form,
  });
  return parseGatewayResponse(response);
}

async function parseGatewayResponse(response: Response): Promise<GatewayImageGenerationResult> {
  const text = await response.text();
  const json = text ? parseJson(text) : {};
  if (!response.ok) {
    throw new Error(json.error?.message || `Image gateway request failed (${response.status})`);
  }
  return json;
}

function parseJson(text: string): GatewayImageGenerationResult & { error?: { message?: string } } {
  try {
    return JSON.parse(text) as GatewayImageGenerationResult & { error?: { message?: string } };
  } catch {
    return { error: { message: text } };
  }
}

function resolveEndpoint(baseUrl: string, path: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (/\/images\/(?:generations|edits)$/.test(trimmed)) return trimmed;
  return `${trimmed}/${path}`;
}

function authHeaders(apiKey: string): Record<string, string> {
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

function appendFormValue(form: FormData, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "") form.append(key, String(value));
}

function b64ToBlob(b64Json: string, contentType = "image/png"): Blob {
  const binary = atob(b64Json);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType });
}

function createMockGateway(): EnterpriseGatewayApi {
  return {
    generateImages: async (request) => createMockResponse(request),
    editImages: async (request) => createMockResponse(request),
    listOutputs: async () => ({ outputs: [] }),
  };
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
