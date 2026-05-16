export type TaskStatus = "running" | "done" | "error";

export interface StudioParams {
  model: string;
  size: string;
  quality: "auto" | "low" | "medium" | "high";
  count: number;
  format: "png" | "jpeg" | "webp";
  moderation: "auto" | "low";
  compression: number | null;
}

export interface ReferenceImage {
  id: string;
  name: string;
  contentType: string;
  dataUrl: string;
  maskDataUrl?: string | null;
}

export interface ImageStudioTask {
  id: string;
  prompt: string;
  params: StudioParams;
  references: ReferenceImage[];
  outputs: string[];
  assets: Array<{
    id: string;
    public_url: string;
    content_type: string;
    size_bytes: number;
    checksum_sha256: string;
  }>;
  revisedPrompt: string | null;
  outputSizes: string[];
  status: TaskStatus;
  error: string | null;
  favorite: boolean;
  selected: boolean;
  createdAt: number;
  finishedAt: number | null;
}

export type TaskStatusFilter = "all" | TaskStatus;
export type GatewayMode = "auto" | "enterprise" | "custom";

export interface StudioSettings {
  defaultModel: string;
  defaultSize: string;
  gatewayMode: GatewayMode;
  customBaseUrl: string;
  customApiKey: string;
  clearPromptAfterSubmit: boolean;
  persistHistory: boolean;
}
