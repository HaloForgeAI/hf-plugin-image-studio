import clsx from "clsx";
import { Image } from "lucide-react";
import type { ImageStudioTask } from "../types";

interface StudioSidebarProps {
  gatewayReady: boolean;
  filter: "all" | "favorites";
  tasks: ImageStudioTask[];
  onFilterChange: (filter: "all" | "favorites") => void;
  onReuseTask: (task: ImageStudioTask) => void;
}

export function StudioSidebar({
  gatewayReady,
  filter,
  tasks,
  onFilterChange,
  onReuseTask,
}: StudioSidebarProps) {
  return (
    <aside className="hfis-sidebar">
      <div className="hfis-brand">
        <div className="hfis-brand-icon"><Image size={20} /></div>
        <div>
          <h1>Image Studio</h1>
          <p>OpenAI-compatible image workspace</p>
        </div>
      </div>
      <div className={clsx("hfis-status", gatewayReady ? "is-ready" : "is-error")}>
        {gatewayReady ? "Enterprise gateway ready" : "Host gateway unavailable"}
      </div>
      <div className="hfis-filter">
        <button className={filter === "all" ? "active" : ""} onClick={() => onFilterChange("all")}>All tasks</button>
        <button className={filter === "favorites" ? "active" : ""} onClick={() => onFilterChange("favorites")}>Favorites</button>
      </div>
      <div className="hfis-history">
        {tasks.slice(0, 12).map((task) => (
          <button key={task.id} onClick={() => onReuseTask(task)} className="hfis-history-item">
            <span>{task.prompt}</span>
            <small>{task.status}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
