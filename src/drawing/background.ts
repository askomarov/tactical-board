import boardUrl from "../assets/half-board.jpg";

export function loadBoardImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load half-board.jpg"));
    img.src = boardUrl;
  });
}

export function drawBackgroundCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destW: number,
  destH: number,
): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (iw === 0 || ih === 0) return;

  const scale = Math.max(destW / iw, destH / ih);
  const nw = iw * scale;
  const nh = ih * scale;
  const dx = (destW - nw) / 2;
  const dy = (destH - nh) / 2;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(img, 0, 0, iw, ih, dx, dy, nw, nh);
  ctx.restore();
}
