import { Download, ImagePlus, Paintbrush, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ReferenceImage, StudioParams } from "../types";
import { MaskEditorModal } from "./MaskEditorModal";

interface StudioComposerProps {
  prompt: string;
  params: StudioParams;
  references: ReferenceImage[];
  gatewayReady: boolean;
  selectedCount: number;
  totalVisibleCount: number;
  onPromptChange: (prompt: string) => void;
  onParamsChange: (params: StudioParams) => void;
  onAttachReferences: (files: FileList | null) => void;
  onRemoveReference: (id: string) => void;
  onUpdateReferenceMask: (id: string, maskDataUrl: string | null) => void;
  onSubmit: () => void;
  onClearSelection: () => void;
  onSelectVisible: () => void;
  onFavoriteSelected: () => void;
  onDeleteSelected: () => void;
}

export function StudioComposer({
  prompt,
  params,
  references,
  gatewayReady,
  selectedCount,
  totalVisibleCount,
  onPromptChange,
  onParamsChange,
  onAttachReferences,
  onRemoveReference,
  onUpdateReferenceMask,
  onSubmit,
  onClearSelection,
  onSelectVisible,
  onFavoriteSelected,
  onDeleteSelected,
}: StudioComposerProps) {
  const atImageLimit = references.length >= 16;
  const [maskReferenceId, setMaskReferenceId] = useState<string | null>(null);
  const maskReference = maskReferenceId ? references.find((reference) => reference.id === maskReferenceId) ?? null : null;

  return (
    <div className="hfis-input-dock" data-input-bar data-no-drag-select>
      {selectedCount > 0 && (
        <div className="hfis-selection-toolbar">
          <button type="button" onClick={onClearSelection} title="Clear selection">
            <X size={18} />
          </button>
          <span>{selectedCount} selected</span>
          <button type="button" onClick={onSelectVisible} title={selectedCount === totalVisibleCount ? "Clear visible" : "Select visible"}>
            {selectedCount === totalVisibleCount ? "Clear visible" : "Select visible"}
          </button>
          <button type="button" onClick={onFavoriteSelected} title="Favorite selected">
            <Star size={18} />
          </button>
          <button type="button" onClick={onDeleteSelected} title="Delete selected">
            <Trash2 size={18} />
          </button>
        </div>
      )}

      <section className="hfis-composer">
        {references.length > 0 && (
          <div className="hfis-reference-row">
            {references.map((reference, index) => (
              <div key={reference.id} className={`hfis-reference-thumb ${reference.maskDataUrl ? "has-mask" : ""}`} title={reference.name}>
                <img src={reference.dataUrl} alt="" />
                <span>@{index + 1}</span>
                <button type="button" className="hfis-reference-remove" onClick={() => onRemoveReference(reference.id)} title="Remove reference">
                  <X size={12} />
                </button>
                <button type="button" className="hfis-reference-mask" onClick={() => setMaskReferenceId(reference.id)} title="Edit mask">
                  <Paintbrush size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe the image. Add references, then use @1, @2 in the prompt to call out specific images..."
        />

        <div className="hfis-composer-bottom">
          <div className="hfis-params">
            <label>
              <span>Model</span>
              <input value={params.model} onChange={(event) => onParamsChange({ ...params, model: event.target.value })} />
            </label>
            <label>
              <span>Size</span>
              <select value={params.size} onChange={(event) => onParamsChange({ ...params, size: event.target.value })}>
                <option value="auto">auto</option>
                <option value="1024x1024">1024x1024</option>
                <option value="1536x1024">1536x1024</option>
                <option value="1024x1536">1024x1536</option>
              </select>
            </label>
            <label>
              <span>Quality</span>
              <select value={params.quality} onChange={(event) => onParamsChange({ ...params, quality: event.target.value as StudioParams["quality"] })}>
                <option value="auto">auto</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <label>
              <span>Format</span>
              <select value={params.format} onChange={(event) => onParamsChange({ ...params, format: event.target.value as StudioParams["format"] })}>
                <option value="png">png</option>
                <option value="jpeg">jpeg</option>
                <option value="webp">webp</option>
              </select>
            </label>
            <label>
              <span>Moderation</span>
              <select value={params.moderation} onChange={(event) => onParamsChange({ ...params, moderation: event.target.value as StudioParams["moderation"] })}>
                <option value="auto">auto</option>
                <option value="low">low</option>
              </select>
            </label>
            <label>
              <span>Count</span>
              <input
                type="number"
                min={1}
                max={4}
                value={params.count}
                onChange={(event) => onParamsChange({ ...params, count: clampCount(Number(event.target.value)) })}
              />
            </label>
            <label>
              <span>Compression</span>
              <input
                type="number"
                min={0}
                max={100}
                disabled={params.format === "png"}
                value={params.compression ?? ""}
                placeholder={params.format === "png" ? "n/a" : "auto"}
                onChange={(event) => onParamsChange({
                  ...params,
                  compression: event.target.value.trim() === "" ? null : clampPercent(Number(event.target.value)),
                })}
              />
            </label>
          </div>

          <div className="hfis-composer-actions">
            <label className={`hfis-attach ${atImageLimit ? "is-disabled" : ""}`} title={atImageLimit ? "Reference image limit reached" : "Add reference images"}>
              <ImagePlus size={20} />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={atImageLimit}
                onChange={(event) => {
                  onAttachReferences(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="hfis-submit"
              disabled={!prompt.trim() || !gatewayReady}
              onClick={onSubmit}
              title={gatewayReady ? "Generate" : "Gateway unavailable"}
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      </section>

      {maskReference && (
        <MaskEditorModal
          reference={maskReference}
          onClose={() => setMaskReferenceId(null)}
          onSave={(maskDataUrl) => {
            onUpdateReferenceMask(maskReference.id, maskDataUrl);
            setMaskReferenceId(null);
          }}
          onRemove={() => {
            onUpdateReferenceMask(maskReference.id, null);
            setMaskReferenceId(null);
          }}
        />
      )}
    </div>
  );
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(4, Math.round(value)));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}
