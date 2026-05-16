import { X } from "lucide-react";
import type { StudioSettings } from "../types";

interface SettingsModalProps {
  settings: StudioSettings;
  onChange: (settings: StudioSettings) => void;
  onClose: () => void;
  onClearHistory: () => void;
}

export function SettingsModal({ settings, onChange, onClose, onClearHistory }: SettingsModalProps) {
  return (
    <div className="hfis-modal-backdrop" role="dialog" aria-modal="true">
      <section className="hfis-settings">
        <header className="hfis-detail-header">
          <div>
            <h2>Image Studio settings</h2>
            <p>Use the host gateway when available, or point community installs at an OpenAI-compatible endpoint.</p>
          </div>
          <button type="button" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </header>
        <div className="hfis-settings-grid">
          <label>
            <span>Default model</span>
            <input value={settings.defaultModel} onChange={(event) => onChange({ ...settings, defaultModel: event.target.value })} />
          </label>
          <label>
            <span>Default size</span>
            <select value={settings.defaultSize} onChange={(event) => onChange({ ...settings, defaultSize: event.target.value })}>
              <option value="auto">auto</option>
              <option value="1024x1024">1024x1024</option>
              <option value="1536x1024">1536x1024</option>
              <option value="1024x1536">1024x1536</option>
            </select>
          </label>
          <label>
            <span>Gateway</span>
            <select value={settings.gatewayMode} onChange={(event) => onChange({ ...settings, gatewayMode: event.target.value as StudioSettings["gatewayMode"] })}>
              <option value="auto">auto</option>
              <option value="enterprise">enterprise</option>
              <option value="custom">custom endpoint</option>
            </select>
          </label>
          <label>
            <span>Custom base URL</span>
            <input
              value={settings.customBaseUrl}
              placeholder="http://localhost:8000/v1"
              onChange={(event) => onChange({ ...settings, customBaseUrl: event.target.value })}
            />
          </label>
          <label>
            <span>Custom API key</span>
            <input
              type="password"
              autoComplete="off"
              value={settings.customApiKey}
              placeholder="Optional for local endpoints"
              onChange={(event) => onChange({ ...settings, customApiKey: event.target.value })}
            />
          </label>
          <label className="hfis-check-row">
            <input
              type="checkbox"
              checked={settings.clearPromptAfterSubmit}
              onChange={(event) => onChange({ ...settings, clearPromptAfterSubmit: event.target.checked })}
            />
            <span>Clear prompt after successful submit</span>
          </label>
          <label className="hfis-check-row">
            <input
              type="checkbox"
              checked={settings.persistHistory}
              onChange={(event) => onChange({ ...settings, persistHistory: event.target.checked })}
            />
            <span>Persist generated task history in this browser</span>
          </label>
          <button type="button" className="hfis-danger-button" onClick={onClearHistory}>
            Clear local history
          </button>
        </div>
      </section>
    </div>
  );
}
