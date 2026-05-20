// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LightweightSimulationRenderer } from "./lightweight-simulation-renderer";
import type { AppState } from "../../state/app-store";
import type { VisualizationState } from "../renderer-document";

describe("LightweightSimulationRenderer", () => {
  let parent: HTMLElement;
  let mockState: AppState;
  let mockVisualization: VisualizationState;

  beforeEach(() => {
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

  it("renders nodes and edges in the SVG graph viewport when loaded", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

    renderer.update(mockState, ["node-1"], "pan", { x: 10, y: 20 }, mockVisualization);

    const svg = parent.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).not.toBeNull();

    const nodes = parent.querySelectorAll(".graph-node");
    expect(nodes.length).toBe(2);
    expect(nodes[0].getAttribute("data-node-id")).toBe("node-1");
    expect(nodes[0].classList.contains("is-selected")).toBe(true);
    expect(nodes[1].getAttribute("data-node-id")).toBe("node-2");
    expect(nodes[1].classList.contains("is-selected")).toBe(false);

    const edges = parent.querySelectorAll("line.graph-edge");
    expect(edges.length).toBe(1);
    expect(edges[0].getAttribute("data-edge-index")).toBe("0");

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

    const nodes = parent.querySelectorAll(".graph-node circle");
    expect(nodes.length).toBe(2);

    const style1 = nodes[0].getAttribute("style");
    const style2 = nodes[1].getAttribute("style");

    expect(style1).toContain("fill:hsl(240 70% 58%)");
    expect(style2).toContain("fill:hsl(0 70% 58%)");

    renderer.destroy();
  });

  it("overrides node fill color if node.labels.ledAll is specified", () => {
    const renderer = new LightweightSimulationRenderer();
    renderer.mount(parent);

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

    const circle = parent.querySelector(".graph-node circle");
    expect(circle).not.toBeNull();
    expect(circle?.getAttribute("style")).toContain("fill:#00ff00");

    renderer.destroy();
  });
});
