export const IMAGE_MODEL_OPTIONS = [
  { value: "gpt-image-2", label: "GPT Image 2" },
  { value: "gpt-image-1.5", label: "Image 1.5" },
  { value: "gpt-image-2.0", label: "Image 2.0" },
  { value: "gpt-5.5", label: "GPT-5.5 Responses" },
] as const;

export const DEFAULT_IMAGE_MODEL = "gpt-image-2.0";

export function isImageModel(value: string): value is (typeof IMAGE_MODEL_OPTIONS)[number]["value"] {
  return IMAGE_MODEL_OPTIONS.some((model) => model.value === value);
}
