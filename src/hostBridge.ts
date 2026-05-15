import type { ImageStudioTask, ReferenceImage, StudioParams } from "./types";

const PLUGIN_ID = "dev.haloforge.image-studio";

export interface HostGatewayAsset {
  id: string;
  public_url: string;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
}

export interface HostImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  hf_output_assets?: HostGatewayAsset[];
}

interface HaloForgePluginHostBridge {
  enterpriseGateway?: {
    generateImages?: (pluginId: string, request: Record<string, unknown>) => Promise<HostImageResponse>;
    editImages?: (pluginId: string, request: Record<string, unknown>) => Promise<HostImageResponse>;
    listOutputs?: (pluginId: string, limit?: number) => Promise<{ outputs: HostGatewayAsset[] }>;
  };
}

declare global {
  interface Window {
    __HALOFORGE_PLUGIN_HOST__?: HaloForgePluginHostBridge;
  }
}

export function hasEnterpriseGateway(): boolean {
  return Boolean(window.__HALOFORGE_PLUGIN_HOST__?.enterpriseGateway?.generateImages);
}

export async function generateImageTask(input: {
  prompt: string;
  params: StudioParams;
  references: ReferenceImage[];
}): Promise<Pick<ImageStudioTask, "outputs" | "assets" | "revisedPrompt">> {
  const gateway = window.__HALOFORGE_PLUGIN_HOST__?.enterpriseGateway;
  if (!gateway?.generateImages) {
    throw new Error("HaloForge enterprise gateway bridge is not available.");
  }

  const baseRequest = {
    model: input.params.model,
    prompt: input.prompt,
    size: input.params.size,
    quality: input.params.quality,
    n: input.params.count,
    response_format: "b64_json",
  };

  const response = input.references.length > 0 && gateway.editImages
    ? await gateway.editImages(PLUGIN_ID, {
      ...baseRequest,
      images: input.references.map((reference) => ({
        field_name: "image",
        file_name: reference.name,
        content_type: reference.contentType,
        b64_json: stripDataUrl(reference.dataUrl),
      })),
    })
    : await gateway.generateImages(PLUGIN_ID, baseRequest);

  return {
    outputs: normalizeImages(response),
    assets: response.hf_output_assets ?? [],
    revisedPrompt: response.data?.find((item) => item.revised_prompt)?.revised_prompt ?? null,
  };
}

function normalizeImages(response: HostImageResponse): string[] {
  return (response.data ?? [])
    .map((item) => {
      if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
      return item.url ?? null;
    })
    .filter((value): value is string => Boolean(value));
}

function stripDataUrl(dataUrl: string): string {
  const marker = ";base64,";
  const index = dataUrl.indexOf(marker);
  return index >= 0 ? dataUrl.slice(index + marker.length) : dataUrl;
}
