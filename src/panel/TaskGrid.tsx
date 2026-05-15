import { Download, Image, Loader2, RefreshCw, Star } from "lucide-react";
import type { ImageStudioTask } from "../types";

interface TaskGridProps {
  tasks: ImageStudioTask[];
  onReuseTask: (task: ImageStudioTask) => void;
  onToggleFavorite: (taskId: string) => void;
}

export function TaskGrid({ tasks, onReuseTask, onToggleFavorite }: TaskGridProps) {
  return (
    <section className="hfis-grid">
      {tasks.length === 0 ? (
        <div className="hfis-empty">
          <Image size={28} />
          <p>Your generated images will appear here.</p>
        </div>
      ) : tasks.map((task) => (
        <article key={task.id} className="hfis-card">
          <div className="hfis-card-top">
            <span className={`hfis-pill ${task.status}`}>{task.status}</span>
            <button onClick={() => onToggleFavorite(task.id)}>
              <Star size={14} fill={task.favorite ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="hfis-output">
            {task.status === "running" ? <Loader2 className="hfis-spin" size={28} /> : task.outputs[0] ? <img src={task.outputs[0]} /> : <Image size={28} />}
          </div>
          <p>{task.prompt}</p>
          {task.revisedPrompt && <small className="hfis-muted">Revised: {task.revisedPrompt}</small>}
          {task.error && <small className="hfis-error">{task.error}</small>}
          {task.assets.length > 0 && (
            <div className="hfis-assets">
              {task.assets.map((asset, index) => (
                <a key={asset.id} href={asset.public_url} target="_blank" rel="noreferrer">
                  Enterprise asset {index + 1}
                </a>
              ))}
            </div>
          )}
          <div className="hfis-card-actions">
            <button onClick={() => onReuseTask(task)}><RefreshCw size={13} /> Reuse</button>
            {task.outputs[0] && <a href={task.outputs[0]} download><Download size={13} /> Download</a>}
          </div>
        </article>
      ))}
    </section>
  );
}
