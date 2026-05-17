import { Brush, Eraser, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { ImageStudioT } from "../i18n";
import type { ReferenceImage } from "../types";

type MaskTool = "brush" | "eraser";

interface MaskEditorModalProps {
  t: ImageStudioT;
  reference: ReferenceImage;
  onClose: () => void;
  onSave: (maskDataUrl: string) => void;
  onRemove: () => void;
}

export function MaskEditorModal({ t, reference, onClose, onSave, onRemove }: MaskEditorModalProps) {
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<MaskTool>("brush");
  const [brushSize, setBrushSize] = useState(56);
  const [cursor, setCursor] = useState<{ x: number; y: number; size: number; visible: boolean }>({
    x: 0,
    y: 0,
    size: 0,
    visible: false,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    loadImage(reference.dataUrl)
      .then(async (image) => {
        if (cancelled) return;
        const prepared = initializeCanvases(image, maskCanvasRef.current, overlayCanvasRef.current);
        if (!prepared) throw new Error("Canvas is unavailable.");
        if (reference.maskDataUrl) {
          const maskImage = await loadImage(reference.maskDataUrl);
          const maskCanvas = maskCanvasRef.current;
          const ctx = maskCanvas?.getContext("2d", { willReadFrequently: true });
          if (maskCanvas && ctx) {
            ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            ctx.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
          }
        } else {
          resetMask();
        }
        redrawOverlay();
        setReady(true);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : String(loadError)));
    return () => {
      cancelled = true;
    };
  }, [reference.dataUrl, reference.maskDataUrl]);

  function resetMask() {
    const maskCanvas = maskCanvasRef.current;
    const ctx = maskCanvas?.getContext("2d", { willReadFrequently: true });
    if (!maskCanvas || !ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    redrawOverlay();
  }

  function redrawOverlay() {
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext("2d", { willReadFrequently: true });
    const maskCtx = maskCanvas?.getContext("2d", { willReadFrequently: true });
    if (!maskCanvas || !overlayCanvas || !overlayCtx || !maskCtx) return;

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const mask = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const overlay = overlayCtx.createImageData(overlayCanvas.width, overlayCanvas.height);
    for (let index = 0; index < mask.data.length; index += 4) {
      const alpha = mask.data[index + 3];
      if (alpha < 255) {
        overlay.data[index] = 37;
        overlay.data[index + 1] = 99;
        overlay.data[index + 2] = 235;
        overlay.data[index + 3] = Math.round((1 - alpha / 255) * 155);
      }
    }
    overlayCtx.putImageData(overlay, 0, 0);
  }

  function beginDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCursor(event);
    drawingRef.current = true;
    const point = getCanvasPoint(event.currentTarget, event);
    lastPointRef.current = point;
    drawStroke(point, point);
  }

  function continueDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    updateCursor(event);
    if (!drawingRef.current) return;
    const point = getCanvasPoint(event.currentTarget, event);
    drawStroke(lastPointRef.current ?? point, point);
    lastPointRef.current = point;
  }

  function endDraw() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function updateCursor(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stage = stageRef.current;
    const canvas = event.currentTarget;
    if (!stage || !canvas) return;
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const displayedBrushSize = (brushSize / Math.max(1, canvas.width)) * canvasRect.width;
    setCursor({
      x: event.clientX - stageRect.left + stage.scrollLeft,
      y: event.clientY - stageRect.top + stage.scrollTop,
      size: Math.max(8, displayedBrushSize),
      visible: true,
    });
  }

  function drawStroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const maskCanvas = maskCanvasRef.current;
    const ctx = maskCanvas?.getContext("2d", { willReadFrequently: true });
    if (!maskCanvas || !ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = tool === "brush" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
    redrawOverlay();
  }

  function saveMask() {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    onSave(maskCanvas.toDataURL("image/png"));
  }

  return (
    <div className="hfis-modal-backdrop" role="dialog" aria-modal="true">
      <section className="hfis-mask-editor">
        <header className="hfis-detail-header">
          <div>
            <h2>{t("mask.title")}</h2>
            <p>{reference.name}</p>
          </div>
          <button type="button" onClick={onClose} title={t("common.close")}>
            <X size={20} />
          </button>
        </header>

        <div className="hfis-mask-toolbar">
          <button type="button" className={tool === "brush" ? "is-active" : ""} onClick={() => setTool("brush")} title={t("mask.paint")}>
            <Brush size={17} />
            {t("mask.brush")}
            <span className="hfis-mask-tool-size" style={{ "--hfis-tool-size": `${toolPreviewSize(brushSize)}px` } as CSSProperties} />
            <small>{brushSize}px</small>
          </button>
          <button type="button" className={tool === "eraser" ? "is-active" : ""} onClick={() => setTool("eraser")} title={t("mask.erase")}>
            <Eraser size={17} />
            {t("mask.eraser")}
            <span className="hfis-mask-tool-size" style={{ "--hfis-tool-size": `${toolPreviewSize(brushSize)}px` } as CSSProperties} />
            <small>{brushSize}px</small>
          </button>
          <label>
            <span>{t("mask.size")}</span>
            <input type="range" min={8} max={180} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            <output>{brushSize}px</output>
          </label>
          <button type="button" onClick={resetMask} title={t("mask.reset")}>
            <RotateCcw size={17} />
          </button>
          <button type="button" onClick={onRemove} title={t("mask.remove")}>
            <Trash2 size={17} />
          </button>
          <button type="button" className="hfis-mask-save" onClick={saveMask} disabled={!ready} title={t("mask.save")}>
            <Save size={17} />
            {t("mask.save")}
          </button>
        </div>

        <div ref={stageRef} className="hfis-mask-stage">
          {error && <p className="hfis-detail-error">{error}</p>}
          <img className="hfis-mask-image" src={reference.dataUrl} alt="" />
          <canvas ref={maskCanvasRef} hidden />
          <canvas
            ref={overlayCanvasRef}
            data-tool={tool}
            onPointerEnter={updateCursor}
            onPointerDown={beginDraw}
            onPointerMove={continueDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
            onPointerLeave={() => {
              endDraw();
              setCursor((value) => ({ ...value, visible: false }));
            }}
          />
          {cursor.visible && (
            <div
              className={`hfis-mask-cursor is-${tool}`}
              style={{
                left: cursor.x,
                top: cursor.y,
                width: cursor.size,
                height: cursor.size,
                marginLeft: -cursor.size / 2,
                marginTop: -cursor.size / 2,
              }}
            >
              {tool === "brush" ? <Brush size={12} /> : <Eraser size={12} />}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function toolPreviewSize(value: number): number {
  return Math.max(8, Math.min(22, Math.round(value / 7)));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load reference image."));
    image.src = src;
  });
}

function initializeCanvases(
  image: HTMLImageElement,
  maskCanvas: HTMLCanvasElement | null,
  overlayCanvas: HTMLCanvasElement | null,
): boolean {
  if (!maskCanvas || !overlayCanvas) return false;
  const width = Math.max(1, image.naturalWidth);
  const height = Math.max(1, image.naturalHeight);
  for (const canvas of [maskCanvas, overlayCanvas]) {
    canvas.width = width;
    canvas.height = height;
  }
  return true;
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}
