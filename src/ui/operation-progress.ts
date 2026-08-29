import type { OperationProgress } from "../api";

export interface OperationProgressView {
  update(progress: OperationProgress): void;
  fail(error: string): void;
}

export function createOperationProgressView(options: {
  container: HTMLElement;
  message: HTMLElement;
  percent: HTMLElement;
  track: HTMLElement;
  bar: HTMLElement;
}): OperationProgressView {
  const { container, message, percent, track, bar } = options;

  function update(progress: OperationProgress) {
    const value = Math.max(0, Math.min(100, progress.percent));
    container.hidden = false;
    container.classList.remove("failed");
    message.textContent = progress.message;
    percent.textContent = `${value}%`;
    track.setAttribute("aria-valuenow", String(value));
    bar.style.width = `${value}%`;
  }

  return {
    update,
    fail(error) {
      container.hidden = false;
      container.classList.add("failed");
      message.textContent = error;
    }
  };
}
