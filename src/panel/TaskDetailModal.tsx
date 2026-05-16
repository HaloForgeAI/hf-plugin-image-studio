import { Copy, Download, Edit3, RefreshCw, Star, Trash2, X } from "lucide-react";
import type { ImageStudioT } from "../i18n";
import type { ImageStudioTask } from "../types";

interface TaskDetailModalProps {
  t: ImageStudioT;
  task: ImageStudioTask;
  onClose: () => void;
  onReuse: (task: ImageStudioTask) => void;
  onEdit: (task: ImageStudioTask) => void;
  onDelete: (taskId: string) => void;
  onToggleFavorite: (taskId: string) => void;
  onOpenLightbox: (images: string[], index: number) => void;
}

export function TaskDetailModal({
  t,
  task,
  onClose,
  onReuse,
  onEdit,
  onDelete,
  onToggleFavorite,
  onOpenLightbox,
}: TaskDetailModalProps) {
  return (
    <div className="hfis-modal-backdrop" role="dialog" aria-modal="true">
      <section className="hfis-detail">
        <header className="hfis-detail-header">
          <div>
            <h2>{t("detail.title")}</h2>
            <p>{formatDate(task.createdAt)}{task.finishedAt ? ` · ${formatDuration(task.createdAt, task.finishedAt)}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} title={t("common.close")}>
            <X size={20} />
          </button>
        </header>

        <div className="hfis-detail-grid">
          <div className="hfis-detail-images">
            {task.outputs.length > 0 ? task.outputs.map((output, index) => (
              <button key={`${task.id}-${index}`} type="button" onClick={() => onOpenLightbox(task.outputs, index)}>
                <img src={output} alt="" />
                <span>{task.outputSizes[index] || task.params.size}</span>
              </button>
            )) : (
              <div className="hfis-detail-placeholder">{task.status}</div>
            )}
          </div>

          <aside className="hfis-detail-meta">
            <label>
              <span>{t("detail.prompt")}</span>
              <textarea readOnly value={task.prompt} />
            </label>
            {task.revisedPrompt && (
              <label>
                <span>{t("detail.revisedPrompt")}</span>
                <textarea readOnly value={task.revisedPrompt} />
              </label>
            )}
            {task.error && <p className="hfis-detail-error">{task.error}</p>}
            <div className="hfis-detail-tags">
              <span>{task.params.model}</span>
              <span>{task.params.size}</span>
              <span>{task.params.quality}</span>
              <span>{task.params.format}</span>
              <span>{t(task.params.count > 1 ? "detail.outputs" : "detail.output", { count: task.params.count })}</span>
              <span>{task.params.moderation}</span>
              {task.params.compression != null && <span>{task.params.compression}%</span>}
              {task.references.some((reference) => reference.maskDataUrl) && <span>{t("task.mask")}</span>}
            </div>
            {task.references.length > 0 && (
              <div className="hfis-detail-refs">
                {task.references.map((reference, index) => (
                  <div key={reference.id} className={reference.maskDataUrl ? "has-mask" : ""} title={reference.name}>
                    <img src={reference.dataUrl} alt={`Reference ${index + 1}`} />
                    {reference.maskDataUrl && <img src={reference.maskDataUrl} alt="" />}
                  </div>
                ))}
              </div>
            )}
            {task.assets.length > 0 && (
              <div className="hfis-detail-assets">
                {task.assets.map((asset, index) => (
                  <a key={asset.id} href={asset.public_url} target="_blank" rel="noreferrer">
                    {t("detail.asset", { index: index + 1 })}
                  </a>
                ))}
              </div>
            )}
            <div className="hfis-detail-actions">
              <button type="button" onClick={() => navigator.clipboard?.writeText(task.prompt)} title={t("detail.copyPrompt")}>
                <Copy size={16} />
              </button>
              <button type="button" onClick={() => onToggleFavorite(task.id)} title={task.favorite ? t("task.unfavorite") : t("task.favorite")}>
                <Star size={16} fill={task.favorite ? "currentColor" : "none"} />
              </button>
              <button type="button" onClick={() => onReuse(task)} title={t("task.reuse")}>
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={() => onEdit(task)} disabled={task.outputs.length === 0} title={t("task.edit")}>
                <Edit3 size={16} />
              </button>
              {task.outputs[0] && (
                <a href={task.outputs[0]} download={`image-studio-${task.id}.png`} title={t("task.download")}>
                  <Download size={16} />
                </a>
              )}
              <button type="button" onClick={() => onDelete(task.id)} title={t("task.delete")}>
                <Trash2 size={16} />
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString();
}

function formatDuration(start: number, end: number): string {
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}
