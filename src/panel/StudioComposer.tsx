import { Upload, WandSparkles } from "lucide-react";
import type { ReferenceImage, StudioParams } from "../types";

interface StudioComposerProps {
  prompt: string;
  params: StudioParams;
  references: ReferenceImage[];
  gatewayReady: boolean;
  onPromptChange: (prompt: string) => void;
  onParamsChange: (params: StudioParams) => void;
  onAttachReferences: (files: FileList | null) => void;
  onSubmit: () => void;
}

export function StudioComposer({
  prompt,
  params,
  references,
  gatewayReady,
  onPromptChange,
  onParamsChange,
  onAttachReferences,
  onSubmit,
}: StudioComposerProps) {
  return (
    <section className="hfis-composer">
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="Describe the icon, asset, reference edit, or visual style you want..."
      />
      <div className="hfis-controls">
        <input value={params.model} onChange={(event) => onParamsChange({ ...params, model: event.target.value })} />
        <select value={params.size} onChange={(event) => onParamsChange({ ...params, size: event.target.value })}>
          <option>1024x1024</option>
          <option>1536x1024</option>
          <option>1024x1536</option>
          <option>auto</option>
        </select>
        <select value={params.quality} onChange={(event) => onParamsChange({ ...params, quality: event.target.value as StudioParams["quality"] })}>
          <option value="auto">Auto quality</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={params.count} onChange={(event) => onParamsChange({ ...params, count: Number(event.target.value) })}>
          <option value={1}>1 output</option>
          <option value={2}>2 outputs</option>
          <option value={4}>4 outputs</option>
        </select>
      </div>
      <div className="hfis-composer-footer">
        <label className="hfis-upload">
          <Upload size={14} />
          Reference images
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => onAttachReferences(event.target.files)} />
        </label>
        <button disabled={!prompt.trim() || !gatewayReady} onClick={onSubmit}>
          <WandSparkles size={15} />
          Generate
        </button>
      </div>
      {references.length > 0 && (
        <div className="hfis-reference-row">
          {references.map((reference) => (
            <img key={reference.id} src={reference.dataUrl} title={reference.name} />
          ))}
        </div>
      )}
    </section>
  );
}
