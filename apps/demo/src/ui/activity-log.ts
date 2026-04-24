import type { LogEntry } from "../state.js";
import { getLog, onLogChange } from "../state.js";

export function renderActivityLog(container: HTMLElement): void {
  container.innerHTML = `<h2>Activity Log</h2><div class="log-list"></div>`;
  const list = container.querySelector(".log-list")!;

  function render(entries: LogEntry[]): void {
    list.innerHTML = entries
      .map(
        (e) =>
          `<div class="log-entry">
            <span class="log-time">${formatTime(e.timestamp)}</span>
            <span class="log-msg">${e.message}</span>
          </div>`,
      )
      .join("");
  }

  render(getLog());
  onLogChange((entries) => render(entries));
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false });
}
