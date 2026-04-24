export type CanvasLayout = {
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  dpr: number;
};

const maxDpr = 3;

export function observeCanvasLayout(
  canvas: HTMLCanvasElement,
  onLayout: (layout: CanvasLayout) => void,
): () => void {
  let ro: ResizeObserver | undefined;

  const measure = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 1 || h < 1) return;

    const dpr = Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1));
    const bitmapWidth = Math.round(w * dpr);
    const bitmapHeight = Math.round(h * dpr);

    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;

    onLayout({
      cssWidth: w,
      cssHeight: h,
      bitmapWidth,
      bitmapHeight,
      dpr,
    });
  };

  ro = new ResizeObserver(() => {
    measure();
  });
  ro.observe(canvas);
  queueMicrotask(measure);

  return () => {
    ro?.disconnect();
  };
}
