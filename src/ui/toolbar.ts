/** Стартовый режим канваса до первого выбора пользователя. */
export const defaultCanvasToolMode: "finger" | "draw" = "finger";

export async function saveCanvasPng(canvas: HTMLCanvasElement): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (!blob) throw new Error("toBlob вернул null");

  const name = `tactical-board-${Date.now()}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

export function mountClearSave(opts: {
  clearButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  onClear: () => void;
  onSave: () => void | Promise<void>;
}): () => void {
  const { clearButton, saveButton, onClear, onSave } = opts;

  const onClearClick = () => onClear();
  const onSaveClick = () => {
    void Promise.resolve(onSave()).catch((err: unknown) => {
      console.error(err);
    });
  };

  clearButton.addEventListener("click", onClearClick);
  saveButton.addEventListener("click", onSaveClick);

  return () => {
    clearButton.removeEventListener("click", onClearClick);
    saveButton.removeEventListener("click", onSaveClick);
  };
}
