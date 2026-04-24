const activeClass = "toolbar-color--active";

export function mountColorBar(
  container: HTMLElement,
  onPick: (hex: string) => void,
): { getColor: () => string; setFingerMode: (on: boolean) => void; dispose: () => void } {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>("button[data-color]")];
  if (buttons.length === 0) {
    throw new Error("mountColorBar: нет кнопок с data-color");
  }

  let fingerMode = false;

  let selected =
    buttons.find((b) => b.classList.contains(activeClass))?.dataset.color ??
    buttons[0]?.dataset.color ??
    "#000000";

  const updateActive = () => {
    for (const btn of buttons) {
      const hex = btn.dataset.color ?? "";
      const isOn = !fingerMode && hex === selected;
      btn.classList.toggle(activeClass, isOn);
      btn.setAttribute("aria-pressed", isOn ? "true" : "false");
    }
  };

  const handlers: Array<{ btn: HTMLButtonElement; fn: () => void }> = [];

  for (const btn of buttons) {
    const hex = btn.dataset.color;
    if (!hex) continue;
    const fn = () => {
      fingerMode = false;
      selected = hex;
      onPick(hex);
      updateActive();
    };
    btn.addEventListener("click", fn);
    handlers.push({ btn, fn });
  }

  updateActive();

  return {
    getColor: () => selected,
    setFingerMode: (on: boolean) => {
      fingerMode = on;
      updateActive();
    },
    dispose: () => {
      for (const { btn, fn } of handlers) {
        btn.removeEventListener("click", fn);
      }
    },
  };
}
