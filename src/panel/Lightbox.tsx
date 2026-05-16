import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

interface LightboxProps {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function Lightbox({ images, index, onIndexChange, onClose }: LightboxProps) {
  const src = images[index];
  if (!src) return null;
  const hasMany = images.length > 1;

  return (
    <div className="hfis-lightbox" role="dialog" aria-modal="true">
      <button type="button" className="hfis-lightbox-close" onClick={onClose} title="Close">
        <X size={22} />
      </button>
      {hasMany && (
        <button type="button" className="hfis-lightbox-prev" onClick={() => onIndexChange(wrap(index - 1, images.length))} title="Previous image">
          <ChevronLeft size={30} />
        </button>
      )}
      <img src={src} alt="" />
      {hasMany && (
        <button type="button" className="hfis-lightbox-next" onClick={() => onIndexChange(wrap(index + 1, images.length))} title="Next image">
          <ChevronRight size={30} />
        </button>
      )}
      <div className="hfis-lightbox-footer">
        <span>{index + 1} / {images.length}</span>
        <a href={src} download={`image-studio-${index + 1}.png`}>
          <Download size={16} />
          Download
        </a>
      </div>
    </div>
  );
}

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}
