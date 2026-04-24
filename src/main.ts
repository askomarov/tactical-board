import "./style.css";
import {
  createPlacedObjectsState,
  loadPlacedImages,
  mountPlacedObjectsInteraction,
} from "./board/placedObjects";
import { loadBoardImage } from "./drawing/background";
import { observeCanvasLayout } from "./drawing/canvasSetup";
import { paintBoardComposite } from "./drawing/compositePaint";
import { mountStrokeController } from "./drawing/strokeController";
import { mountColorBar } from "./ui/colors";
import { defaultCanvasToolMode, mountClearSave, saveCanvasPng } from "./ui/toolbar";

const canvas = document.querySelector<HTMLCanvasElement>("#tactical-canvas");
const colorsContainer = document.querySelector<HTMLElement>("#toolbar-colors");
const btnDefaultLineup = document.querySelector<HTMLButtonElement>("#btn-default-lineup");
const btnClearFigures = document.querySelector<HTMLButtonElement>("#btn-clear-figures");
const btnClear = document.querySelector<HTMLButtonElement>("#btn-clear");
const btnSave = document.querySelector<HTMLButtonElement>("#btn-save");
const btnFinger = document.querySelector<HTMLButtonElement>("#btn-finger");
const btnAddBall = document.querySelector<HTMLButtonElement>("#btn-add-ball");
const btnAddPlayerRed = document.querySelector<HTMLButtonElement>("#btn-add-player-red");
const btnAddPlayerBlue = document.querySelector<HTMLButtonElement>("#btn-add-player-blue");

if (
  !canvas ||
  !colorsContainer ||
  !btnDefaultLineup ||
  !btnClearFigures ||
  !btnClear ||
  !btnSave ||
  !btnFinger ||
  !btnAddBall ||
  !btnAddPlayerRed ||
  !btnAddPlayerBlue
) {
  throw new Error("Разметка Tactical Board не найдена (canvas / toolbar)");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2d context");

/** Лог в консоль при каждом pointerdown по canvas (bitmap + нормализованные). Выключи в `false`. */
const DEBUG_LOG_CANVAS_CLICK = true;
if (DEBUG_LOG_CANVAS_CLICK) {
  canvas.addEventListener("pointerdown", (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const xb = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const yb = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const xn = xb / Math.max(1, canvas.width);
    const yn = yb / Math.max(1, canvas.height);
    console.log("[canvas pointerdown]", {
      pointerType: e.pointerType,
      clientCss: { x: e.clientX, y: e.clientY },
      relativeCss: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      },
      bitmap: { x: xb, y: yb },
      norm01: { xn, yn },
      bitmapLayout: { w: lastBitmapW, h: lastBitmapH },
    });
  });
}

const strokeCanvas = document.createElement("canvas");
const strokeCtx = strokeCanvas.getContext("2d");
if (!strokeCtx) throw new Error("stroke 2d context");

let boardImg: HTMLImageElement | null = null;
let placedImages: Awaited<ReturnType<typeof loadPlacedImages>> | null = null;
let lastBitmapW = 0;
let lastBitmapH = 0;

let tool: "finger" | "draw" = defaultCanvasToolMode;

const placed = createPlacedObjectsState();

const syncSpawnButtons = () => {
  const c = placed.counts();
  btnAddBall.disabled = c.ball >= 1;
  btnAddPlayerRed.disabled = c.red >= 5;
  btnAddPlayerBlue.disabled = c.blue >= 5;
};

const paint = () => {
  paintBoardComposite(ctx, {
    boardImg,
    bitmapW: lastBitmapW,
    bitmapH: lastBitmapH,
    strokeCanvas,
    drawPlaced: (c) => {
      if (placedImages && lastBitmapW > 0 && lastBitmapH > 0) {
        placed.draw(c, placedImages, canvas, lastBitmapW, lastBitmapH);
      }
    },
  });
};

const paintAndSyncSpawn = () => {
  paint();
  syncSpawnButtons();
};

observeCanvasLayout(canvas, (layout) => {
  lastBitmapW = layout.bitmapWidth;
  lastBitmapH = layout.bitmapHeight;
  strokeCanvas.width = layout.bitmapWidth;
  strokeCanvas.height = layout.bitmapHeight;
  paint();
});

void loadBoardImage()
  .then((img) => {
    boardImg = img;
    paint();
  })
  .catch((err: unknown) => {
    console.error(err);
  });

void loadPlacedImages()
  .then((imgs) => {
    placedImages = imgs;
    paintAndSyncSpawn();
  })
  .catch((err: unknown) => {
    console.error(err);
  });

const { getColor, setFingerMode } = mountColorBar(colorsContainer, () => {
  tool = "draw";
  btnFinger.classList.remove("toolbar-finger--active");
  btnFinger.setAttribute("aria-pressed", "false");
});

const applyFingerTool = () => {
  tool = "finger";
  setFingerMode(true);
  btnFinger.classList.add("toolbar-finger--active");
  btnFinger.setAttribute("aria-pressed", "true");
};

if (defaultCanvasToolMode === "finger") {
  applyFingerTool();
}

btnFinger.addEventListener("click", applyFingerTool);

mountStrokeController(canvas, strokeCtx, {
  getColor,
  isDrawingEnabled: () => tool === "draw",
  onStrokeChange: paint,
});

mountPlacedObjectsInteraction({
  canvas,
  getMode: () => tool,
  getBitmapSize: () => ({ bw: lastBitmapW, bh: lastBitmapH }),
  placed,
  paint: paintAndSyncSpawn,
});

btnAddBall.addEventListener("click", () => {
  if (placed.tryAddBall()) paintAndSyncSpawn();
});

btnAddPlayerRed.addEventListener("click", () => {
  if (placed.tryAddPlayer("red")) paintAndSyncSpawn();
});

btnAddPlayerBlue.addEventListener("click", () => {
  if (placed.tryAddPlayer("blue")) paintAndSyncSpawn();
});

btnDefaultLineup.addEventListener("click", () => {
  placed.resetFieldToLayout();
  paintAndSyncSpawn();
});

btnClearFigures.addEventListener("click", () => {
  placed.clearAllFigures();
  paintAndSyncSpawn();
});

syncSpawnButtons();

mountClearSave({
  clearButton: btnClear,
  saveButton: btnSave,
  onClear: () => {
    strokeCtx.clearRect(0, 0, Math.max(1, lastBitmapW), Math.max(1, lastBitmapH));
    paint();
  },
  onSave: async () => {
    await saveCanvasPng(canvas);
  },
});
