import type { OverrideSessionController } from "@weaver/config-sessions";
import type { ConfigurationService } from "@weaver/config-types";
import { addLogEntry, setSessionActive } from "../state.js";

export function renderSessionPanel(
  container: HTMLElement,
  session: OverrideSessionController,
  service: ConfigurationService,
): void {
  container.innerHTML = `<h2>Override Session</h2><div class="session-body"></div>`;
  const body = container.querySelector(".session-body")!;
  let timerId: ReturnType<typeof setInterval> | null = null;

  function clearSessionOverrides(): void {
    const current = session.getSession();
    if (current === null) return;
    const keys = Object.keys(current.overrides);
    for (const key of keys) {
      service.remove(key, "session");
    }
  }

  function render(): void {
    clearTimer();
    const active = session.isActive();
    const current = session.getSession();

    if (!active || current === null) {
      body.innerHTML = `
        <div class="session-status inactive">Inactive</div>
        <div class="session-form">
          <input id="session-reason" type="text" placeholder="Reason..." />
          <label>Duration (min):
            <input id="session-duration" type="number" value="5" min="1" max="60" />
          </label>
          <button id="btn-activate" class="btn-primary">Activate Session</button>
        </div>`;
      body.querySelector("#btn-activate")?.addEventListener("click", () => {
        const reason =
          (body.querySelector("#session-reason") as HTMLInputElement).value ||
          "Demo";
        const mins =
          Number(
            (body.querySelector("#session-duration") as HTMLInputElement).value,
          ) || 5;
        session.activate({ reason, durationMs: mins * 60 * 1000 });
        setSessionActive(true);
        addLogEntry(`Session activated: "${reason}" for ${mins}min`);
        render();
      });
      return;
    }

    const expiresAt = new Date(current.expiresAt).getTime();

    body.innerHTML = `
      <div class="session-status active">Active</div>
      <div class="session-info">
        <div>ID: <code>${current.id}</code></div>
        <div>Reason: ${current.reason}</div>
        <div>Overrides: ${Object.keys(current.overrides).length}</div>
        <div class="countdown" id="countdown"></div>
      </div>
      <div class="session-actions">
        <button id="btn-extend">Extend 5min</button>
        <button id="btn-deactivate" class="btn-danger">Deactivate</button>
      </div>`;

    startCountdown(expiresAt, Object.keys(current.overrides));

    body.querySelector("#btn-extend")?.addEventListener("click", () => {
      session.extend(5 * 60 * 1000);
      addLogEntry("Session extended by 5min");
      render();
    });

    body.querySelector("#btn-deactivate")?.addEventListener("click", () => {
      clearSessionOverrides();
      session.deactivate();
      setSessionActive(false);
      addLogEntry("Session deactivated — overrides cleared");
      render();
    });
  }

  function startCountdown(expiresAt: number, capturedKeys: string[]): void {
    function update(): void {
      const remaining = Math.max(0, expiresAt - Date.now());
      const el = document.getElementById("countdown");
      if (!el) return;
      if (remaining <= 0) {
        el.textContent = "Expired";
        const current = session.getSession();
        const keysToRemove =
          current !== null ? Object.keys(current.overrides) : capturedKeys;
        for (const key of keysToRemove) {
          service.remove(key, "session");
        }
        setSessionActive(false);
        clearTimer();
        addLogEntry("Session expired — overrides cleared");
        setTimeout(() => render(), 500);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      el.textContent = `Expires in ${mins}:${secs.toString().padStart(2, "0")}`;
    }
    update();
    timerId = setInterval(update, 1000);
  }

  function clearTimer(): void {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  render();
}
