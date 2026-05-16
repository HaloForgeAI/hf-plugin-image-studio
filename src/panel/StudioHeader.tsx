import { HelpCircle, Image, Settings } from "lucide-react";

interface StudioHeaderProps {
  gatewayReady: boolean;
  gatewayStatus: string;
  taskCount: number;
  onSettingsClick: () => void;
}

export function StudioHeader({ gatewayReady, gatewayStatus, taskCount, onSettingsClick }: StudioHeaderProps) {
  return (
    <header className="hfis-header" data-no-drag-select>
      <div className="hfis-header-inner">
        <a
          href="https://github.com/CookSleep/gpt_image_playground"
          target="_blank"
          rel="noreferrer"
          className="hfis-title"
          title="Reference workflow: GPT Image Playground"
        >
          <Image size={18} />
          <span>Image Studio</span>
        </a>
        <div className="hfis-header-actions">
          <span className={`hfis-status ${gatewayReady ? "is-ready" : "is-error"}`}>
            {gatewayStatus}
          </span>
          <span className="hfis-counter">{taskCount} tasks</span>
          <button type="button" className="hfis-icon-button" title="Guide">
            <HelpCircle size={18} />
          </button>
          <button type="button" className="hfis-icon-button" title="Settings" onClick={onSettingsClick}>
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
