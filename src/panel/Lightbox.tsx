import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { saveGeneratedImage } from "../download";
import type { ImageStudioT } from "../i18n";

interface LightboxProps {
  t: ImageStudioT;
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function Lightbox({ t, images, index, onIndexChange, onClose }: LightboxProps) {
  const src = images[index];
  if (!src) return null;
  const hasMany = images.length > 1;

  return (
    <div
      className="hfis-lightbox"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button type="button" className="hfis-lightbox-close" onClick={onClose} title={t("common.close")}>
        <X size={22} />
      </button>
      {hasMany && (
        <button type="button" className="hfis-lightbox-prev" onClick={() => onIndexChange(wrap(index - 1, images.length))} title={t("lightbox.previous")}>
          <ChevronLeft size={30} />
        </button>
      )}
      <img src={src} alt="" />
      {hasMany && (
        <button type="button" className="hfis-lightbox-next" onClick={() => onIndexChange(wrap(index + 1, images.length))} title={t("lightbox.next")}>
          <ChevronRight size={30} />
        </button>
      )}
      <div className="hfis-lightbox-footer">
        <span>{index + 1} / {images.length}</span>
        <button type="button" onClick={() => void saveGeneratedImage(src, `image-studio-${index + 1}`, t)}>
          <Download size={16} />
          {t("common.download")}
        </button>
      </div>
    </div>
  );
}

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}
