import { drawBackgroundCover } from "./background";

export function paintBoardComposite(
  mainCtx: CanvasRenderingContext2D,
  opts: {
    boardImg: HTMLImageElement | null;
    bitmapW: number;
    bitmapH: number;
    strokeCanvas: HTMLCanvasElement;
    drawPlaced: (ctx: CanvasRenderingContext2D) => void;
  },
): void {
  const { boardImg, bitmapW, bitmapH, strokeCanvas, drawPlaced } = opts;
  mainCtx.clearRect(0, 0, bitmapW, bitmapH);
  if (boardImg && bitmapW > 0 && bitmapH > 0) {
    drawBackgroundCover(mainCtx, boardImg, bitmapW, bitmapH);
  }
  if (bitmapW > 0 && bitmapH > 0) {
    mainCtx.drawImage(strokeCanvas, 0, 0);
    drawPlaced(mainCtx);
  }
}
