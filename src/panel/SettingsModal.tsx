import { X } from "lucide-react";
import type { ImageStudioT } from "../i18n";
import type { StudioSettings } from "../types";
import { IMAGE_MODEL_OPTIONS } from "../modelOptions";
import { ClosingAppSelect as AppSelect } from "./ClosingAppSelect";

interface SettingsModalProps {
  t: ImageStudioT;
  settings: StudioSettings;
  onChange: (settings: StudioSettings) => void;
  onClose: () => void;
  onClearHistory: () => void;
}

export function SettingsModal({ t, settings, onChange, onClose, onClearHistory }: SettingsModalProps) {
  return (
    <div className="hfis-modal-backdrop" role="dialog" aria-modal="true">
      <section className="hfis-settings">
        <header className="hfis-detail-header">
          <div>
            <h2>{t("settings.title")}</h2>
            <p>{t("settings.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} title={t("common.close")}>
            <X size={20} />
          </button>
        </header>
        <div className="hfis-settings-grid">
          <label>
            <span>{t("settings.defaultModel")}</span>
            <AppSelect className="hfis-settings-select" value={settings.defaultModel} onChange={(event) => onChange({ ...settings, defaultModel: event.target.value })}>
              {IMAGE_MODEL_OPTIONS.map((model) => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </AppSelect>
          </label>
          <label>
            <span>{t("settings.defaultSize")}</span>
            <AppSelect className="hfis-settings-select" value={settings.defaultSize} onChange={(event) => onChange({ ...settings, defaultSize: event.target.value })}>
              <option value="auto">auto</option>
              <option value="1024x1024">1024x1024</option>
              <option value="1536x1024">1536x1024</option>
              <option value="1024x1536">1024x1536</option>
            </AppSelect>
          </label>
          <label>
            <span>{t("settings.gateway")}</span>
            <AppSelect className="hfis-settings-select" value={settings.gatewayMode} onChange={(event) => onChange({ ...settings, gatewayMode: event.target.value as StudioSettings["gatewayMode"] })}>
              <option value="auto">{t("settings.gatewayAuto")}</option>
              <option value="cloud">{t("settings.gatewayCloud")}</option>
              <option value="custom">{t("settings.gatewayCustom")}</option>
            </AppSelect>
          </label>
          <label>
            <span>{t("settings.apiMode")}</span>
            <AppSelect className="hfis-settings-select" value={settings.apiMode} onChange={(event) => onChange({ ...settings, apiMode: event.target.value as StudioSettings["apiMode"] })}>
              <option value="images">{t("settings.apiModeImages")}</option>
              <option value="responses">{t("settings.apiModeResponses")}</option>
            </AppSelect>
          </label>
          <label>
            <span>{t("settings.customBaseUrl")}</span>
            <input
              value={settings.customBaseUrl}
              placeholder={t("settings.localEndpointPlaceholder")}
              onChange={(event) => onChange({ ...settings, customBaseUrl: event.target.value })}
            />
          </label>
          <label>
            <span>{t("settings.customApiKey")}</span>
            <input
              type="password"
              autoComplete="off"
              value={settings.customApiKey}
              placeholder={t("settings.customApiKeyPlaceholder")}
              onChange={(event) => onChange({ ...settings, customApiKey: event.target.value })}
            />
          </label>
          <label className="hfis-check-row">
            <input
              type="checkbox"
              checked={settings.codexCli}
              onChange={(event) => onChange({ ...settings, codexCli: event.target.checked })}
            />
            <span>{t("settings.codexCli")}</span>
          </label>
          <label className="hfis-check-row">
            <input
              type="checkbox"
              checked={settings.responseFormatB64Json}
              onChange={(event) => onChange({ ...settings, responseFormatB64Json: event.target.checked })}
            />
            <span>{t("settings.responseFormatB64Json")}</span>
          </label>
          <label className="hfis-check-row">
            <input
              type="checkbox"
              checked={settings.clearPromptAfterSubmit}
              onChange={(event) => onChange({ ...settings, clearPromptAfterSubmit: event.target.checked })}
            />
            <span>{t("settings.clearPrompt")}</span>
          </label>
          <label>
            <span>{t("settings.galleryColumns")}</span>
            <input
              type="number"
              min={2}
              max={8}
              value={settings.galleryColumns}
              onChange={(event) => onChange({ ...settings, galleryColumns: clampGalleryColumns(Number(event.target.value)) })}
            />
          </label>
          <label className="hfis-check-row">
            <input
              type="checkbox"
              checked={settings.persistHistory}
              onChange={(event) => onChange({ ...settings, persistHistory: event.target.checked })}
            />
            <span>{t("settings.persistHistory")}</span>
          </label>
          <button type="button" className="hfis-danger-button" onClick={onClearHistory}>
            {t("settings.clearHistory")}
          </button>
        </div>
      </section>
    </div>
  );
}

function clampGalleryColumns(value: number) {
  if (!Number.isFinite(value)) return 4;
  return Math.min(8, Math.max(2, Math.round(value)));
}
