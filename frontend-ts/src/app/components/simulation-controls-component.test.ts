// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SimulationControlsComponent } from "./simulation-controls-component";
import type { AppState } from "../../state/app-store";

describe("SimulationControlsComponent", () => {
  let root: HTMLElement;
  let mockApp: any;

  beforeEach(() => {
    root = document.createElement("div");
    root.innerHTML = `
      <button id="load-script"></button>
      <button id="tick-once"></button>
      <button id="start-daemon"></button>
      <button id="stop-daemon"></button>
      <button class="speed-pill" data-speed="100"></button>
      <button class="speed-pill is-active" data-speed="30"></button>
    `;
    document.body.appendChild(root);
    mockApp = {};
  });

  describe("renderStatusStrip", () => {
    it("renders idle status badge correctly", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const mockState = { execution: { status: "idle" } } as AppState;
      const html = component.renderStatusStrip(mockState);

      expect(html).toContain("badge-neutral");
      expect(html).toContain("Idle");
    });

    it("renders compiling status badge with spin-icon", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const mockState = { execution: { status: "compiling" } } as AppState;
      const html = component.renderStatusStrip(mockState);

      expect(html).toContain("badge-progress");
      expect(html).toContain("Compiling");
      expect(html).toContain("spin-icon");
    });

    it("renders ready status badge", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const mockState = { execution: { status: "ready" } } as AppState;
      const html = component.renderStatusStrip(mockState);

      expect(html).toContain("badge-success");
      expect(html).toContain("Ready");
    });

    it("renders daemon status badge with active interval rate and pulse-dot", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const mockState = { execution: { status: "daemon", daemonIntervalMs: 500 } } as AppState;
      const html = component.renderStatusStrip(mockState);

      expect(html).toContain("badge-success");
      expect(html).toContain("Daemon (500ms)");
      expect(html).toContain("pulse-dot");
    });
  });

  describe("renderSpeedOption", () => {
    it("renders active speed options", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const html = component.renderSpeedOption("Fast", 30, true);

      expect(html).toContain("speed-pill");
      expect(html).toContain("is-active");
      expect(html).toContain('data-speed="30"');
      expect(html).toContain("Fast");
    });
  });

  describe("callbacks and events", () => {
    it("triggers onLoadScript callback", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const callbacks = { onLoadScript: vi.fn() };
      component.setCallbacks(callbacks);
      component.attachListeners();

      root.querySelector<HTMLButtonElement>("#load-script")?.click();
      expect(callbacks.onLoadScript).toHaveBeenCalled();
    });

    it("triggers onTick callback", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const callbacks = { onTick: vi.fn() };
      component.setCallbacks(callbacks);
      component.attachListeners();

      root.querySelector<HTMLButtonElement>("#tick-once")?.click();
      expect(callbacks.onTick).toHaveBeenCalled();
    });

    it("triggers onStartDaemon callback with correct selected speed", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const callbacks = { onStartDaemon: vi.fn() };
      component.setCallbacks(callbacks);
      component.attachListeners();

      root.querySelector<HTMLButtonElement>("#start-daemon")?.click();
      expect(callbacks.onStartDaemon).toHaveBeenCalledWith(30);
    });

    it("triggers onStopDaemon callback", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const callbacks = { onStopDaemon: vi.fn() };
      component.setCallbacks(callbacks);
      component.attachListeners();

      root.querySelector<HTMLButtonElement>("#stop-daemon")?.click();
      expect(callbacks.onStopDaemon).toHaveBeenCalled();
    });

    it("handles speed changing clicks and updates active pill", () => {
      const component = new SimulationControlsComponent(root, mockApp);
      const callbacks = { onSpeedChanged: vi.fn() };
      component.setCallbacks(callbacks);
      component.attachListeners();

      const speedBtn100 = root.querySelector<HTMLButtonElement>('[data-speed="100"]');
      const speedBtn30 = root.querySelector<HTMLButtonElement>('[data-speed="30"]');

      speedBtn100?.click();

      expect(callbacks.onSpeedChanged).toHaveBeenCalledWith(100);
      expect(speedBtn100?.classList.contains("is-active")).toBe(true);
      expect(speedBtn30?.classList.contains("is-active")).toBe(false);
    });
  });
});
