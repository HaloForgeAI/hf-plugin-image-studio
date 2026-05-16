import { Image, Settings } from "lucide-react";

interface StudioHeaderProps {
  title: string;
  settingsTitle: string;
  gatewayReady: boolean;
  gatewayStatus: string;
  taskCount: number;
  onSettingsClick: () => void;
}

export function StudioHeader({ title, settingsTitle, gatewayReady, gatewayStatus, taskCount, onSettingsClick }: StudioHeaderProps) {
  return (
    <header className="hfis-header" data-no-drag-select>
      <div className="hfis-header-inner">
        <div className="hfis-title">
          <Image size={18} />
          <span>{title}</span>
        </div>
        <div className="hfis-header-actions">
          <span className={`hfis-status ${gatewayReady ? "is-ready" : "is-error"}`}>
            {gatewayStatus}
          </span>
          <span className="hfis-counter">{taskCount} tasks</span>
          <button type="button" className="hfis-icon-button" title={settingsTitle} onClick={onSettingsClick}>
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
