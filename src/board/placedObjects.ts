import basketBallUrl from "../assets/basket-ball.svg";
import playerIconSvgRaw from "../assets/player-icon.svg?raw";

export type Team = "red" | "blue";

export type PlacedKind = "ball" | "player";

export type PlacedEntity = {
  id: string;
  kind: PlacedKind;
  team?: Team;
  /** 0..4 — слот расстановки; номер на майке = slotIndex + 1 */
  slotIndex?: number;
  /** @deprecated дублирует slotIndex+1; оставлено для отрисовки старых сущностей без slotIndex */
  jersey?: number;
  /** 0..1 относительно bitmap width */
  xn: number;
  /** 0..1 относительно bitmap height */
  yn: number;
};

export type PlacedImages = {
  ball: HTMLImageElement;
  playerRed: HTMLImageElement;
  playerBlue: HTMLImageElement;
};

const PLAYER_COLORS: Record<Team, string> = {
  red: "#E73C61",
  blue: "#3498db",
};

/** Слоты norm01 для 5 синих игроков по порядку добавления (1-й клик → [0], …). */
export const BLUE_PLAYER_SPAWN_NORM: ReadonlyArray<{ xn: number; yn: number }> = [
  { xn: 0.207, yn: 0.344 },
  { xn: 0.337, yn: 0.344 },
  { xn: 0.481, yn: 0.494 },
  { xn: 0.342, yn: 0.646 },
  { xn: 0.205, yn: 0.646 },
];

/** Слоты norm01 для 5 красных игроков по порядку добавления. */
export const RED_PLAYER_SPAWN_NORM: ReadonlyArray<{ xn: number; yn: number }> = [
  { xn: 0.156, yn: 0.077 },
  { xn: 0.58, yn: 0.199 },
  { xn: 0.728, yn: 0.494 },
  { xn: 0.58, yn: 0.789 },
  { xn: 0.156, yn: 0.913 },
];

const OBJECT_RADIUS_CSS = 22;

function bitmapHalfSize(canvas: HTMLCanvasElement): number {
  return OBJECT_RADIUS_CSS * (canvas.width / Math.max(1, canvas.clientWidth));
}

function drawPlayerJersey(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  jersey: number,
): void {
  const label = String(jersey);
  const fontPx = Math.max(10, Math.round(size * 0.34));
  /** Ниже центра иконки на 25% её высоты; X — по центру спрайта. */
  const ty = cy + size * 0.25;
  ctx.save();
  ctx.font = `800 ${fontPx}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(2, fontPx * 0.16);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.strokeText(label, cx, ty);
  ctx.fillText(label, cx, ty);
  ctx.restore();
}

function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function svgWithColorToImage(svgText: string, color: string): Promise<HTMLImageElement> {
  const patched = svgText.replaceAll("currentColor", color);
  const blob = new Blob([patched], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode player SVG"));
    };
    img.src = url;
  });
}

export async function loadPlacedImages(): Promise<PlacedImages> {
  const [ball, playerRed, playerBlue] = await Promise.all([
    loadImageFromUrl(basketBallUrl),
    svgWithColorToImage(playerIconSvgRaw, PLAYER_COLORS.red),
    svgWithColorToImage(playerIconSvgRaw, PLAYER_COLORS.blue),
  ]);
  return { ball, playerRed, playerBlue };
}

let spawnRing = 0;

function nextSpawnNorm(): [number, number] {
  const j = spawnRing++ % 8;
  const angle = (j / 8) * Math.PI * 2;
  const d = 0.06;
  return [0.5 + Math.cos(angle) * d, 0.5 + Math.sin(angle) * d];
}

/** `randomUUID` только в secure context (https / localhost); по http://LAN — нет. */
function newEntityId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      /* ignore */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createPlacedObjectsState(): {
  entities: PlacedEntity[];
  tryAddBall: () => boolean;
  tryAddPlayer: (team: Team) => boolean;
  /** Убрать все объекты и снова выставить мяч + 5×5 игроков на штатных слотах. */
  resetFieldToLayout: () => void;
  /** Только убрать мяч и всех игроков с поля (без восстановления расстановки). */
  clearAllFigures: () => void;
  removeById: (id: string) => void;
  removeTopAtBitmap: (
    xb: number,
    yb: number,
    canvas: HTMLCanvasElement,
    bw: number,
    bh: number,
  ) => void;
  updateEntityNorm: (
    id: string,
    xn: number,
    yn: number,
    canvas: HTMLCanvasElement,
    bw: number,
    bh: number,
  ) => void;
  draw: (
    ctx: CanvasRenderingContext2D,
    images: PlacedImages,
    canvas: HTMLCanvasElement,
    bw: number,
    bh: number,
  ) => void;
  hitTestTop: (
    xb: number,
    yb: number,
    canvas: HTMLCanvasElement,
    bw: number,
    bh: number,
  ) => PlacedEntity | null;
  counts: () => { ball: number; red: number; blue: number };
} {
  const entities: PlacedEntity[] = [];

  const counts = () => ({
    ball: entities.filter((e) => e.kind === "ball").length,
    red: entities.filter((e) => e.kind === "player" && e.team === "red").length,
    blue: entities.filter((e) => e.kind === "player" && e.team === "blue").length,
  });

  const hitTestTop = (
    xb: number,
    yb: number,
    canvas: HTMLCanvasElement,
    bw: number,
    bh: number,
  ) => {
    const r = bitmapHalfSize(canvas);
    const r2 = r * r;
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i]!;
      const cx = e.xn * bw;
      const cy = e.yn * bh;
      const dx = xb - cx;
      const dy = yb - cy;
      if (dx * dx + dy * dy <= r2) return e;
    }
    return null;
  };

  const clampNorm = (
    xn: number,
    yn: number,
    canvas: HTMLCanvasElement,
    bw: number,
    bh: number,
  ): [number, number] => {
    const half = bitmapHalfSize(canvas);
    const cx = xn * bw;
    const cy = yn * bh;
    const cx2 = Math.min(Math.max(half, cx), bw - half);
    const cy2 = Math.min(Math.max(half, cy), bh - half);
    return [cx2 / bw, cy2 / bh];
  };

  const occupiedSlotForTeam = (e: PlacedEntity, team: Team): number | null => {
    if (e.kind !== "player" || e.team !== team) return null;
    if (e.slotIndex !== undefined) return e.slotIndex;
    if (e.jersey !== undefined) {
      const s = e.jersey - 1;
      if (s >= 0 && s < 5) return s;
    }
    return null;
  };

  const findFreePlayerSlot = (team: Team): number | null => {
    const used = new Set<number>();
    for (const e of entities) {
      const s = occupiedSlotForTeam(e, team);
      if (s !== null) used.add(s);
    }
    for (let i = 0; i < 5; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  };

  return {
    entities,
    tryAddBall: () => {
      if (counts().ball >= 1) return false;
      const [xn, yn] = nextSpawnNorm();
      entities.push({ id: newEntityId(), kind: "ball", xn, yn });
      return true;
    },
    tryAddPlayer: (team: Team) => {
      const c = counts();
      if (team === "red" && c.red >= 5) return false;
      if (team === "blue" && c.blue >= 5) return false;

      const slotIdx = findFreePlayerSlot(team);
      if (slotIdx === null) return false;

      const norms = team === "blue" ? BLUE_PLAYER_SPAWN_NORM : RED_PLAYER_SPAWN_NORM;
      const pos = norms[slotIdx];
      if (pos === undefined) return false;

      const jersey = slotIdx + 1;
      entities.push({
        id: newEntityId(),
        kind: "player",
        team,
        slotIndex: slotIdx,
        jersey,
        xn: pos.xn,
        yn: pos.yn,
      });
      return true;
    },
    resetFieldToLayout: () => {
      entities.length = 0;
      spawnRing = 0;
      const [bx, by] = nextSpawnNorm();
      entities.push({ id: newEntityId(), kind: "ball", xn: bx, yn: by });
      for (let i = 0; i < 5; i++) {
        const b = BLUE_PLAYER_SPAWN_NORM[i]!;
        entities.push({
          id: newEntityId(),
          kind: "player",
          team: "blue",
          slotIndex: i,
          jersey: i + 1,
          xn: b.xn,
          yn: b.yn,
        });
      }
      for (let i = 0; i < 5; i++) {
        const r = RED_PLAYER_SPAWN_NORM[i]!;
        entities.push({
          id: newEntityId(),
          kind: "player",
          team: "red",
          slotIndex: i,
          jersey: i + 1,
          xn: r.xn,
          yn: r.yn,
        });
      }
    },
    clearAllFigures: () => {
      entities.length = 0;
    },
    removeById: (id: string) => {
      const idx = entities.findIndex((e) => e.id === id);
      if (idx >= 0) entities.splice(idx, 1);
    },
    removeTopAtBitmap: (xb, yb, canvas, bw, bh) => {
      const hit = hitTestTop(xb, yb, canvas, bw, bh);
      if (hit) {
        const idx = entities.findIndex((e) => e.id === hit.id);
        if (idx >= 0) entities.splice(idx, 1);
      }
    },
    updateEntityNorm: (id, xn, yn, canvas, bw, bh) => {
      const e = entities.find((x) => x.id === id);
      if (!e) return;
      const [xn2, yn2] = clampNorm(xn, yn, canvas, bw, bh);
      e.xn = xn2;
      e.yn = yn2;
    },
    draw: (ctx, images, canvas, bw, bh) => {
      const half = bitmapHalfSize(canvas);
      const size = half * 2;
      for (const e of entities) {
        const cx = e.xn * bw;
        const cy = e.yn * bh;
        const img =
          e.kind === "ball" ? images.ball : e.team === "red" ? images.playerRed : images.playerBlue;
        ctx.drawImage(img, cx - half, cy - half, size, size);
        if (e.kind === "player") {
          const num =
            e.slotIndex !== undefined ? e.slotIndex + 1 : (e.jersey ?? undefined);
          if (num !== undefined) drawPlayerJersey(ctx, cx, cy, size, num);
        }
      }
    },
    hitTestTop,
    counts,
  };
}

export type PlacedObjectsApi = ReturnType<typeof createPlacedObjectsState>;

function bitmapPerCssPx(canvas: HTMLCanvasElement): number {
  return canvas.width / Math.max(1, canvas.clientWidth);
}

export function mountPlacedObjectsInteraction(opts: {
  canvas: HTMLCanvasElement;
  getMode: () => "finger" | "draw";
  getBitmapSize: () => { bw: number; bh: number };
  placed: PlacedObjectsApi;
  paint: () => void;
}): () => void {
  const { canvas, getMode, getBitmapSize, placed, paint } = opts;

  /** Двойной тап для удаления: dblclick на телефонах часто не приходит. */
  type TapChain = { t: number; xb: number; yb: number; entityId: string };
  let tapChain: TapChain | null = null;

  const DOUBLE_TAP_MS = 420;
  const doubleTapMaxDistBitmap = () => 44 * bitmapPerCssPx(canvas);
  const DRAG_SLOP_BITMAP = () => 12 * bitmapPerCssPx(canvas);
  const TAP_MAX_MS = 450;

  type Gesture = {
    pointerId: number;
    targetId: string;
    downT: number;
    downXb: number;
    downYb: number;
    maxSlop: number;
    dragging: boolean;
  };
  let gesture: Gesture | null = null;

  const pointerToBitmap = (e: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return [x, y];
  };

  const tryDeleteOnDoubleTap = (entityId: string, xb: number, yb: number) => {
    const now = performance.now();
    if (tapChain && tapChain.entityId === entityId && now - tapChain.t <= DOUBLE_TAP_MS) {
      const dist = Math.hypot(xb - tapChain.xb, yb - tapChain.yb);
      if (dist <= doubleTapMaxDistBitmap()) {
        placed.removeById(entityId);
        tapChain = null;
        paint();
        return;
      }
    }
    tapChain = { t: now, xb, yb, entityId };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (getMode() !== "finger") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (gesture) return;

    const { bw, bh } = getBitmapSize();
    if (bw < 1 || bh < 1) return;
    const [xb, yb] = pointerToBitmap(e);
    const hit = placed.hitTestTop(xb, yb, canvas, bw, bh);
    if (!hit) {
      tapChain = null;
      return;
    }

    gesture = {
      pointerId: e.pointerId,
      targetId: hit.id,
      downT: performance.now(),
      downXb: xb,
      downYb: yb,
      maxSlop: 0,
      dragging: false,
    };
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const { bw, bh } = getBitmapSize();
    if (bw < 1 || bh < 1) return;
    const [xb, yb] = pointerToBitmap(e);
    const slop = Math.hypot(xb - gesture.downXb, yb - gesture.downYb);
    gesture.maxSlop = Math.max(gesture.maxSlop, slop);
    if (gesture.maxSlop > DRAG_SLOP_BITMAP()) gesture.dragging = true;
    if (gesture.dragging) {
      placed.updateEntityNorm(gesture.targetId, xb / bw, yb / bh, canvas, bw, bh);
      paint();
    }
  };

  const finishGesture = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const g = gesture;
    gesture = null;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    const { bw, bh } = getBitmapSize();
    if (bw < 1 || bh < 1) return;
    const [xb, yb] = pointerToBitmap(e);
    const duration = performance.now() - g.downT;
    const slopOk = g.maxSlop <= DRAG_SLOP_BITMAP();
    const tapLike = !g.dragging && slopOk && duration < TAP_MAX_MS;
    if (tapLike) {
      tryDeleteOnDoubleTap(g.targetId, xb, yb);
    } else {
      tapChain = null;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    finishGesture(e);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    gesture = null;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    tapChain = null;
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
  };
}
