import type { LogEntry } from "../state";
import { getLog, onLogChange } from "../state";

function requireQuery(container: HTMLElement, selector: string): Element {
  const element = container.querySelector(selector);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

export function renderActivityLog(container: HTMLElement): void {
  container.innerHTML = `<h2>Activity Log</h2><div class="log-list"></div>`;
  const list = requireQuery(container, ".log-list");

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
