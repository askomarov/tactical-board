const cssLineWidth = 4;

function pointerToBitmap(canvas: HTMLCanvasElement, e: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  return [x, y];
}

export type StrokeControllerOptions = {
  getColor: () => string;
  isDrawingEnabled: () => boolean;
  /** Вызывать после изменения слоя штрихов (нужен композит на основной canvas). */
  onStrokeChange?: () => void;
};

export function mountStrokeController(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  { getColor, isDrawingEnabled, onStrokeChange }: StrokeControllerOptions,
): () => void {
  let drawing = false;

  const lineWidthPx = () => cssLineWidth * (canvas.width / Math.max(1, canvas.clientWidth));

  const onPointerDown = (e: PointerEvent) => {
    if (!isDrawingEnabled()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = pointerToBitmap(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drawing) return;
    const [x, y] = pointerToBitmap(canvas, e);
    ctx.lineTo(x, y);
    ctx.lineWidth = lineWidthPx();
    ctx.strokeStyle = getColor();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    onStrokeChange?.();
  };

  const endStroke = () => {
    drawing = false;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    endStroke();
    onStrokeChange?.();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
  };
}
