import type { AppState } from "../../state/app-store";
import type { ScafiWebApp } from "../scafi-web-app";

export interface SimulationControlsCallbacks {
  onLoadScript?(): void;
  onTick?(): void;
  onStartDaemon?(intervalMs: number): void;
  onStopDaemon?(): void;
  onSpeedChanged?(intervalMs: number): void;
}

export class SimulationControlsComponent {
  private callbacks: SimulationControlsCallbacks = {};

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {}

  setCallbacks(callbacks: SimulationControlsCallbacks): void {
    this.callbacks = callbacks;
  }

  renderStatusStrip(state: AppState): string {
    const status = state.execution.status;
    let badgeClass = "badge-neutral";
    let text = "Unknown";
    let iconHtml = "";

    if (status === "idle") {
      badgeClass = "badge-neutral";
      text = "Idle";
    } else if (status === "compiling") {
      badgeClass = "badge-progress";
      text = "Compiling";
      iconHtml = `<svg class="spin-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    } else if (status === "ready") {
      badgeClass = "badge-success";
      text = "Ready";
    } else if (status === "daemon") {
      badgeClass = "badge-success";
      text = `Daemon (${state.execution.daemonIntervalMs}ms)`;
      iconHtml = `<span class="pulse-dot"></span>`;
    }

    return `<span class="badge ${badgeClass}">${iconHtml}${text}</span>`;
  }

  renderSpeedOption(label: string, intervalMs: number, active: boolean): string {
    return `<button class="speed-pill ${active ? "is-active" : ""}" data-speed="${intervalMs}">${label}</button>`;
  }

  attachListeners(): void {
    const loadBtn = this.root.querySelector<HTMLButtonElement>("#load-script");
    loadBtn?.addEventListener("click", () => {
      this.callbacks.onLoadScript?.();
    });

    const tickBtn = this.root.querySelector<HTMLButtonElement>("#tick-once");
    tickBtn?.addEventListener("click", () => {
      this.callbacks.onTick?.();
    });

    const startBtn = this.root.querySelector<HTMLButtonElement>("#start-daemon");
    startBtn?.addEventListener("click", () => {
      const activeSpeedBtn = this.root.querySelector<HTMLButtonElement>(".speed-pill.is-active");
      const speed = Number(activeSpeedBtn?.dataset.speed ?? 30);
      this.callbacks.onStartDaemon?.(speed);
    });

    const stopBtn = this.root.querySelector<HTMLButtonElement>("#stop-daemon");
    stopBtn?.addEventListener("click", () => {
      this.callbacks.onStopDaemon?.();
    });

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-speed]")) {
      button.addEventListener("click", () => {
        const intervalMs = Number(button.dataset.speed);
        this.root.querySelectorAll(".speed-pill").forEach((element) => element.classList.remove("is-active"));
        button.classList.add("is-active");
        this.callbacks.onSpeedChanged?.(intervalMs);
      });
    }
  }
}
