// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppState } from "../../state/app-store";
import type { VisualizationState } from "../renderer-document";

// Mock pixi.js
const mockInit = vi.fn().mockResolvedValue(undefined);
const mockResize = vi.fn();
const mockDestroy = vi.fn();
const mockAddChild = vi.fn();

const mockGraphicsInstance = {
  clear: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  circle: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
};

const mockTextInstance = {
  position: {
    set: vi.fn(),
  },
  anchor: {
    set: vi.fn(),
  },
  visible: true,
  text: "",
  style: {},
};

vi.mock("pixi.js", () => {
  return {
    Application: vi.fn().mockImplementation(() => {
      return {
        init: mockInit,
        canvas: document.createElement("canvas"),
        stage: {
          addChild: mockAddChild,
        },
        renderer: {
          resize: mockResize,
        },
        destroy: mockDestroy,
      };
    }),
    Graphics: vi.fn().mockImplementation(() => mockGraphicsInstance),
    Container: vi.fn().mockImplementation(() => {
      return {
        addChild: vi.fn(),
      };
    }),
    Text: vi.fn().mockImplementation(() => mockTextInstance),
    TextStyle: vi.fn(),
  };
});

// Import renderer after mock is established
import { PixiSimulationRenderer } from "./pixi-simulation-renderer";

describe("PixiSimulationRenderer", () => {
  let parent: HTMLElement;
  let mockState: AppState;
  let mockVisualization: VisualizationState;

  beforeEach(() => {
    vi.clearAllMocks();

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
      showId: true,
      showNeighborhood: false,
    } as unknown as VisualizationState;
  });

  it("can be instantiated and mounts canvas element after async initialization", async () => {
    const renderer = new PixiSimulationRenderer();
    const mountPromise = renderer.mount(parent);
    
    // Mount is async in PixiJS v8
    await mountPromise;

    const container = parent.querySelector(".graph-workspace-container.pixi-renderer");
    expect(container).not.toBeNull();
    
    const canvas = parent.querySelector("canvas");
    expect(canvas).not.toBeNull();

    renderer.destroy();
    expect(parent.querySelector(".graph-workspace-container")).toBeNull();
  });

  it("triggers canvas redraw on update", async () => {
    const renderer = new PixiSimulationRenderer();
    await renderer.mount(parent);

    renderer.update(mockState, ["node-1"], "pan", { x: 10, y: 20 }, mockVisualization);

    expect(mockGraphicsInstance.clear).toHaveBeenCalled();
    expect(mockGraphicsInstance.circle).toHaveBeenCalled();
    expect(mockGraphicsInstance.fill).toHaveBeenCalled();

    renderer.destroy();
  });

  it("manages and exposes viewport pan updates correctly", () => {
    const renderer = new PixiSimulationRenderer();
    expect(renderer.getGraphPan()).toEqual({ x: 0, y: 0 });

    renderer.setGraphPan({ x: -100, y: 250 });
    expect(renderer.getGraphPan()).toEqual({ x: -100, y: 250 });
  });
});
