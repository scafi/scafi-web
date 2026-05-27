// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LightweightSimulationRenderer } from "./lightweight-simulation-renderer";
import type { AppState } from "../../state/app-store";
import type { VisualizationState } from "../renderer-document";

describe("LightweightSimulationRenderer", () => {
  let parent: HTMLElement;
  let mockState: AppState;
  let mockVisualization: VisualizationState;
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    };

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type) => {
      if (type === "2d") {
        return mockCtx;
      }
      return null;
    });

    parent = document.createElement("div");
    parent.style.width = "800px";
    parent.style.height = "600px";
    document.body.appendChild(parent);

    mockState = {
      graph: {
        nodes: [
          { id: "node-1", position: { x: 10, y: 10 }, labels: {} },
          { id: "node-2", position: { x: 50, y: 50 }, labels: {} },
        ],
        edges: [
          { from: "node-1", to: "node-2" },
        ],
      },
      execution: {
        status: "ready",
        daemonIntervalMs: 30,
      },
    } as unknown as AppState;

    mockVisualization = {
      nodeSize: 10,
      gradientEnabled: false,
      outlineEnabled: true,
      selectionColor: "red",
    } as unknown as VisualizationState;
  });

  it("can be instantiated and mounts lightweight container markup", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

    const container = parent.querySelector<HTMLElement>(".graph-workspace-container.lightweight-renderer");
    expect(container).not.toBeNull();
    expect(container?.style.width).toBe("100%");

    renderer.destroy();
    expect(parent.querySelector(".graph-workspace-container")).toBeNull();
  });

  it("renders startup overlay when execution state is not ready/daemon", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

    const idleState = { ...mockState, execution: { status: "idle" } } as AppState;
    renderer.update(idleState, [], "pan", { x: 0, y: 0 }, mockVisualization);

    const container = parent.querySelector(".graph-workspace-container");
    expect(container?.innerHTML).toContain("Press <strong>Load</strong> to start the simulation");

    renderer.destroy();
  });

  it("renders empty graph text when there are no nodes", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

    const emptyState = { ...mockState, graph: { nodes: [], edges: [] } } as AppState;
    renderer.update(emptyState, [], "pan", { x: 0, y: 0 }, mockVisualization);

    const container = parent.querySelector(".graph-workspace-container");
    expect(container?.innerHTML).toContain("No nodes available for the current configuration.");

    renderer.destroy();
  });

  it("renders nodes and edges in the Canvas graph viewport when loaded", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

    renderer.update(mockState, ["node-1"], "pan", { x: 10, y: 20 }, mockVisualization);

    const canvas = parent.querySelector("canvas");
    expect(canvas).not.toBeNull();

    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();

    renderer.destroy();
  });

  it("manages and exposes viewport pan updates correctly", () => {
    const renderer = new LightweightSimulationRenderer();
    expect(renderer.getGraphPan()).toEqual({ x: 0, y: 0 });

    renderer.setGraphPan({ x: -100, y: 250 });
    expect(renderer.getGraphPan()).toEqual({ x: -100, y: 250 });
  });

  it("maps nodes dynamically onto HSL rainbow scale when renderGradient is active", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

    const setColors: string[] = [];
    Object.defineProperty(mockCtx, "fillStyle", {
      set(val) {
        setColors.push(String(val));
      },
      get() {
        return setColors[setColors.length - 1] || "";
      },
      configurable: true,
    });

    const gradVisualization = {
      ...mockVisualization,
      renderGradient: true,
    } as unknown as VisualizationState;

    const gradState = {
      graph: {
        nodes: [
          { id: "node-1", position: { x: 10, y: 10 }, labels: { export: 10 } },
          { id: "node-2", position: { x: 50, y: 50 }, labels: { export: 110 } },
        ],
        edges: [],
      },
      execution: {
        status: "ready",
        daemonIntervalMs: 30,
      },
    } as unknown as AppState;

    renderer.update(gradState, [], "pan", { x: 0, y: 0 }, gradVisualization);

    expect(setColors.length).toBeGreaterThan(0);
    expect(setColors.some((val) => val.includes("hsl(240"))).toBe(true);
    expect(setColors.some((val) => val.includes("hsl(0"))).toBe(true);

    renderer.destroy();
  });

  it("overrides node fill color if node.labels.ledAll is specified", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

    const setColors: string[] = [];
    Object.defineProperty(mockCtx, "fillStyle", {
      set(val) {
        setColors.push(String(val));
      },
      get() {
        return setColors[setColors.length - 1] || "";
      },
      configurable: true,
    });

    const coloredState = {
      graph: {
        nodes: [
          { id: "node-1", position: { x: 10, y: 10 }, labels: { ledAll: "#00ff00" } },
        ],
        edges: [],
      },
      execution: {
        status: "ready",
      },
    } as unknown as AppState;

    renderer.update(coloredState, [], "pan", { x: 0, y: 0 }, mockVisualization);

    expect(setColors).toContain("#00ff00");

    renderer.destroy();
  });
});
