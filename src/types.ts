export type TaskStatus = "running" | "done" | "error";

export interface StudioParams {
  model: string;
  size: string;
  quality: "auto" | "low" | "medium" | "high";
  count: number;
}

export interface ReferenceImage {
  id: string;
  name: string;
  contentType: string;
  dataUrl: string;
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
  status: TaskStatus;
  error: string | null;
  favorite: boolean;
  createdAt: number;
  finishedAt: number | null;
}
