import { AppTooltip } from "@haloforge/plugin-sdk";
import { CopyPlus, Download, Edit3, Image, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { saveGeneratedImage } from "../download";
import type { ImageStudioT } from "../i18n";
import type { ImageStudioTask } from "../types";

interface TaskGridProps {
  t: ImageStudioT;
  tasks: ImageStudioTask[];
  galleryColumns: number;
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
  galleryColumns,
  selectedTaskIds,
  onReuseTask,
  onEditTask,
  onDeleteTask,
  onToggleFavorite,
  onToggleSelection,
  onOpenTask,
  onOpenLightbox,
}: TaskGridProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!tasks.some((task) => task.status === "running")) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [tasks]);

  return (
    <section className="hfis-grid" style={{ "--hfis-gallery-columns": galleryColumns } as CSSProperties}>
      {tasks.length === 0 ? (
        <div className="hfis-empty">
          <Image size={30} />
          <p>{t("task.empty")}</p>
        </div>
      ) : tasks.map((task) => {
        const selected = selectedTaskIds.includes(task.id);
        const duration = formatDuration(task.createdAt, task.finishedAt ?? now);
        const firstSize = task.outputSizes[0];
        return (
          <article key={task.id} className={`hfis-card ${selected ? "is-selected" : ""}`}>
            <button
              type="button"
              className="hfis-select-dot"
              onClick={() => onToggleSelection(task.id)}
              aria-label={selected ? t("task.unselect") : t("task.select")}
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
                  <span className="hfis-running-clock">{duration}</span>
                  <div className="hfis-generation-stage" aria-hidden="true">
                    <Loader2 className="hfis-spin" size={28} />
                    <span className="hfis-generation-spark" />
                    <span className="hfis-generation-spark" />
                    <span className="hfis-generation-spark" />
                    <div className="hfis-generation-progress">
                      <span />
                    </div>
                  </div>
                  <span className="hfis-running-title">{t("task.generating")}</span>
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
              {task.status !== "running" && (
                <div className="hfis-card-badges">
                  {task.status === "done" && firstSize && <span>{firstSize}</span>}
                  {task.references.length > 0 && <span>{t("task.referenceShort", { count: task.references.length })}</span>}
                </div>
              )}
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
                  <ActionTooltip label={t("task.retry")}>
                    <button type="button" onClick={() => onReuseTask(task)} aria-label={t("task.retry")}>
                      <RefreshCw size={16} />
                    </button>
                  </ActionTooltip>
                )}
                <ActionTooltip label={task.favorite ? t("task.unfavorite") : t("task.favorite")}>
                  <button type="button" onClick={() => onToggleFavorite(task.id)} aria-label={task.favorite ? t("task.unfavorite") : t("task.favorite")}>
                    <Star size={16} fill={task.favorite ? "currentColor" : "none"} />
                  </button>
                </ActionTooltip>
                <ActionTooltip label={t("task.reuse")}>
                  <button type="button" onClick={() => onReuseTask(task)} aria-label={t("task.reuse")}>
                    <CopyPlus size={16} />
                  </button>
                </ActionTooltip>
                <ActionTooltip label={t("task.edit")}>
                  <button type="button" onClick={() => onEditTask(task)} disabled={task.outputs.length === 0} aria-label={t("task.edit")}>
                    <Edit3 size={16} />
                  </button>
                </ActionTooltip>
                {task.outputs[0] && (
                  <ActionTooltip label={t("task.download")}>
                    <button type="button" onClick={() => void saveGeneratedImage(task.outputs[0], `image-studio-${task.id}`, t)} aria-label={t("task.download")}>
                      <Download size={16} />
                    </button>
                  </ActionTooltip>
                )}
                <ActionTooltip label={t("task.delete")}>
                  <button type="button" onClick={() => onDeleteTask(task.id)} aria-label={t("task.delete")}>
                    <Trash2 size={16} />
                  </button>
                </ActionTooltip>
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

function ActionTooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <AppTooltip content={label} placement="top">
      {children}
    </AppTooltip>
  );
}
