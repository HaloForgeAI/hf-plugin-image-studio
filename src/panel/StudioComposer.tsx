import { AppSelect, AppTooltip } from "@haloforge/plugin-sdk";
import { ImagePlus, Paintbrush, Plus, SendHorizontal, SlidersHorizontal, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ImageStudioT } from "../i18n";
import type { ReferenceImage, StudioParams } from "../types";
import { IMAGE_MODEL_OPTIONS } from "../modelOptions";
import { MaskEditorModal } from "./MaskEditorModal";

interface StudioComposerProps {
  t: ImageStudioT;
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
  t,
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
  const [paramsOpen, setParamsOpen] = useState(false);
  const maskReference = maskReferenceId ? references.find((reference) => reference.id === maskReferenceId) ?? null : null;
  const modelLabel = IMAGE_MODEL_OPTIONS.find((model) => model.value === params.model)?.label ?? params.model;
  const paramSummary = [
    modelLabel,
    params.size,
    params.quality === "auto" ? null : params.quality,
    params.count > 1 ? t("task.outputs", { count: params.count }) : null,
    params.format,
    params.format !== "png" && params.compression != null ? `${params.compression}%` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="hfis-input-dock" data-input-bar data-no-drag-select>
      {selectedCount > 0 && (
        <div className="hfis-selection-toolbar">
          <button type="button" onClick={onClearSelection} title={t("composer.clearSelection")}>
            <X size={18} />
          </button>
          <span>{t("composer.selected", { count: selectedCount })}</span>
          <button type="button" onClick={onSelectVisible} title={selectedCount === totalVisibleCount ? t("composer.clearVisible") : t("composer.selectVisible")}>
            {selectedCount === totalVisibleCount ? t("composer.clearVisible") : t("composer.selectVisible")}
          </button>
          <button type="button" onClick={onFavoriteSelected} title={t("composer.favoriteSelected")}>
            <Star size={18} />
          </button>
          <button type="button" onClick={onDeleteSelected} title={t("composer.deleteSelected")}>
            <Trash2 size={18} />
          </button>
        </div>
      )}

      <section className="hfis-composer">
        <div className="hfis-composer-core">
          {references.length > 0 && (
            <div className="hfis-reference-row">
              {references.map((reference, index) => (
                <div key={reference.id} className={`hfis-reference-thumb ${reference.maskDataUrl ? "has-mask" : ""}`} title={reference.name}>
                  <img src={reference.dataUrl} alt="" />
                  <span>@{index + 1}</span>
                  <button type="button" className="hfis-reference-remove" onClick={() => onRemoveReference(reference.id)} title={t("composer.removeReference")}>
                    <X size={12} />
                  </button>
                  <button type="button" className="hfis-reference-mask" onClick={() => setMaskReferenceId(reference.id)} title={t("composer.editMask")}>
                    <Paintbrush size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder={t("composer.placeholder")}
          />
        </div>

        <div className="hfis-composer-bottom">
          <div className="hfis-param-summary" title={paramSummary}>
            <SlidersHorizontal size={14} />
            <span>{paramSummary}</span>
          </div>

          <div className="hfis-composer-actions">
            <AppTooltip content={atImageLimit ? t("composer.referenceLimit") : t("composer.addReference")} placement="top">
              <label className={`hfis-attach ${atImageLimit ? "is-disabled" : ""}`} aria-label={atImageLimit ? t("composer.referenceLimit") : t("composer.addReference")}>
                <ImagePlus size={18} />
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
            </AppTooltip>
            <div className="hfis-param-popover-wrap">
              <AppTooltip content={t("composer.adjustParams")} placement="top">
                <button
                  type="button"
                  className={`hfis-param-toggle ${paramsOpen ? "is-active" : ""}`}
                  onClick={() => setParamsOpen((value) => !value)}
                  aria-label={t("composer.adjustParams")}
                >
                  <Plus size={18} />
                </button>
              </AppTooltip>
              {paramsOpen && (
                <div className="hfis-param-popover">
                  <label>
                    <span>{t("composer.model")}</span>
                    <AppSelect className="hfis-param-select" value={params.model} onChange={(event) => onParamsChange({ ...params, model: event.target.value })} placement="top">
                      {IMAGE_MODEL_OPTIONS.map((model) => (
                        <option key={model.value} value={model.value}>{model.label}</option>
                      ))}
                    </AppSelect>
                  </label>
                  <label>
                    <span>{t("composer.size")}</span>
                    <AppSelect className="hfis-param-select" value={params.size} onChange={(event) => onParamsChange({ ...params, size: event.target.value })} placement="top">
                      <option value="auto">auto</option>
                      <option value="1024x1024">1024x1024</option>
                      <option value="1536x1024">1536x1024</option>
                      <option value="1024x1536">1024x1536</option>
                    </AppSelect>
                  </label>
                  <label>
                    <span>{t("composer.quality")}</span>
                    <AppSelect className="hfis-param-select" value={params.quality} onChange={(event) => onParamsChange({ ...params, quality: event.target.value as StudioParams["quality"] })} placement="top">
                      <option value="auto">auto</option>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </AppSelect>
                  </label>
                  <label>
                    <span>{t("composer.format")}</span>
                    <AppSelect
                      className="hfis-param-select"
                      value={params.format}
                      onChange={(event) => {
                        const format = event.target.value as StudioParams["format"];
                        onParamsChange({ ...params, format, compression: format === "png" ? null : params.compression });
                      }}
                      placement="top"
                    >
                      <option value="png">png</option>
                      <option value="jpeg">jpeg</option>
                      <option value="webp">webp</option>
                    </AppSelect>
                  </label>
                  <label>
                    <span>{t("composer.moderation")}</span>
                    <AppSelect className="hfis-param-select" value={params.moderation} onChange={(event) => onParamsChange({ ...params, moderation: event.target.value as StudioParams["moderation"] })} placement="top">
                      <option value="auto">auto</option>
                      <option value="low">low</option>
                    </AppSelect>
                  </label>
                  <label>
                    <span>{t("composer.count")}</span>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={params.count}
                      onChange={(event) => onParamsChange({ ...params, count: clampCount(Number(event.target.value)) })}
                    />
                  </label>
                  <label>
                    <span>{t("composer.compression")}</span>
                    {params.format === "png" ? (
                      <em className="hfis-param-note">{t("composer.compressionPngDisabled")}</em>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={params.compression ?? ""}
                        placeholder="auto"
                        onChange={(event) => onParamsChange({
                          ...params,
                          compression: event.target.value.trim() === "" ? null : clampPercent(Number(event.target.value)),
                        })}
                      />
                    )}
                  </label>
                </div>
              )}
            </div>
            <AppTooltip content={gatewayReady ? t("composer.generate") : t("composer.gatewayUnavailable")} placement="top">
              <button
                type="button"
                className="hfis-submit"
                disabled={!prompt.trim() || !gatewayReady}
                onClick={onSubmit}
                aria-label={gatewayReady ? t("composer.generate") : t("composer.gatewayUnavailable")}
              >
                <SendHorizontal size={18} />
              </button>
            </AppTooltip>
          </div>
        </div>
      </section>

      {maskReference && (
        <MaskEditorModal
          reference={maskReference}
          t={t}
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
