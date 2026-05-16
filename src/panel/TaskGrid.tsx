import { CopyPlus, Download, Edit3, Image, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import type { ImageStudioT } from "../i18n";
import type { ImageStudioTask } from "../types";

interface TaskGridProps {
  t: ImageStudioT;
  tasks: ImageStudioTask[];
  selectedTaskIds: string[];
  onReuseTask: (task: ImageStudioTask) => void;
  onEditTask: (task: ImageStudioTask) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleFavorite: (taskId: string) => void;
  onToggleSelection: (taskId: string) => void;
  onOpenTask: (task: ImageStudioTask) => void;
  onOpenLightbox: (images: string[], index: number) => void;
}

export function TaskGrid({
  t,
  tasks,
  selectedTaskIds,
  onReuseTask,
  onEditTask,
  onDeleteTask,
  onToggleFavorite,
  onToggleSelection,
  onOpenTask,
  onOpenLightbox,
}: TaskGridProps) {
  return (
    <section className="hfis-grid">
      {tasks.length === 0 ? (
        <div className="hfis-empty">
          <Image size={30} />
          <p>{t("task.empty")}</p>
        </div>
      ) : tasks.map((task) => {
        const selected = selectedTaskIds.includes(task.id);
        const duration = formatDuration(task.createdAt, task.finishedAt ?? Date.now());
        const firstSize = task.outputSizes[0];
        return (
          <article key={task.id} className={`hfis-card ${selected ? "is-selected" : ""}`}>
            <button
              type="button"
              className="hfis-select-dot"
              onClick={() => onToggleSelection(task.id)}
              title={selected ? t("task.unselect") : t("task.select")}
            >
              {selected ? "✓" : ""}
            </button>

            <button
              type="button"
              className="hfis-card-media"
              onClick={() => task.outputs.length > 0 ? onOpenLightbox(task.outputs, 0) : onOpenTask(task)}
            >
              {task.status === "running" && (
                <div className="hfis-running">
                  <Loader2 className="hfis-spin" size={32} />
                  <span>{t("task.generating")}</span>
                </div>
              )}
              {task.status === "error" && (
                <div className="hfis-error-state">
                  <Image size={30} />
                  <span>{t("task.failed")}</span>
                </div>
              )}
              {task.status === "done" && task.outputs[0] && (
                <>
                  <img className="saveable-image" src={task.outputs[0]} alt="" loading="lazy" />
                  {task.outputs.length > 1 && <span className="hfis-output-count">{task.outputs.length}</span>}
                </>
              )}
              <div className="hfis-card-badges">
                <span>{task.status === "done" && firstSize ? firstSize : duration}</span>
                {task.references.length > 0 && <span>{t("task.referenceShort", { count: task.references.length })}</span>}
              </div>
            </button>

            <div className="hfis-card-body" onDoubleClick={() => onOpenTask(task)}>
              <p>{task.prompt || t("task.emptyPrompt")}</p>
              {task.error && <small className="hfis-error">{task.error}</small>}
              {task.revisedPrompt && <small className="hfis-muted">{t("task.revised", { prompt: task.revisedPrompt })}</small>}
              <div className="hfis-param-tags">
                <span>{task.params.model}</span>
                <span>{task.params.size}</span>
                {task.params.quality !== "auto" && <span>{task.params.quality}</span>}
                {task.params.count > 1 && <span>{t("task.outputs", { count: task.params.count })}</span>}
                {task.references.some((reference) => reference.maskDataUrl) && <span>{t("task.mask")}</span>}
              </div>
              {task.assets.length > 0 && (
                <div className="hfis-assets">
                  {task.assets.map((asset, index) => (
                    <a key={asset.id} href={asset.public_url} target="_blank" rel="noreferrer">
                      {t("task.asset", { index: index + 1 })}
                    </a>
                  ))}
                </div>
              )}
              <div className="hfis-card-actions">
                {task.status === "error" && (
                  <button type="button" onClick={() => onReuseTask(task)} title={t("task.retry")}>
                    <RefreshCw size={16} />
                  </button>
                )}
                <button type="button" onClick={() => onToggleFavorite(task.id)} title={task.favorite ? t("task.unfavorite") : t("task.favorite")}>
                  <Star size={16} fill={task.favorite ? "currentColor" : "none"} />
                </button>
                <button type="button" onClick={() => onReuseTask(task)} title={t("task.reuse")}>
                  <CopyPlus size={16} />
                </button>
                <button type="button" onClick={() => onEditTask(task)} disabled={task.outputs.length === 0} title={t("task.edit")}>
                  <Edit3 size={16} />
                </button>
                {task.outputs[0] && (
                  <a href={task.outputs[0]} download={`image-studio-${task.id}.png`} title={t("task.download")}>
                    <Download size={16} />
                  </a>
                )}
                <button type="button" onClick={() => onDeleteTask(task.id)} title={t("task.delete")}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function formatDuration(start: number, end: number): string {
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}
