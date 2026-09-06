import { describe, expect, it } from "vitest";

import {
  compileRendererDocument,
  defaultRendererDocument,
  createDefaultVisualizationState,
  normalizeNodeRenderLabels,
  normalizeNodeRenderOverlays,
  resolveVisualizationState,
  summarizeActiveRenderers,
  visualizationToRendererDefaults,
} from "./renderer-document";

describe("renderer-document", () => {
  it("compiles renderer JavaScript and resolves visualization output", () => {
    const fallback = createDefaultVisualizationState();
    fallback.visibleSensors = new Set(["source"]);
    const evaluator = compileRendererDocument(`
      const dense = graph.nodes.length > 2;
      return {
        nodeSize: dense ? 6 : defaults.nodeSize,
        renderMatrix: false,
        visibleSensors: "all",
      };
    `);

    const output = evaluator({
      graph: { nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: {} }, { id: "2", position: { x: 1, y: 0 }, labels: {} }, { id: "3", position: { x: 2, y: 0 }, labels: {} }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: [],
      availableSensors: ["source", "obstacle"],
      defaults: visualizationToRendererDefaults(fallback),
    });

    const resolved = resolveVisualizationState(fallback, output, ["source", "obstacle"]);

    expect(resolved.nodeSize).toBe(6);
    expect(resolved.renderMatrix).toBe(false);
    expect(Array.from(resolved.visibleSensors)).toEqual(["source", "obstacle"]);
  });

  it("disables non-showId global renderers by default when custom renderers are present", () => {
    const fallback = createDefaultVisualizationState();
    fallback.showId = true;
    fallback.showNeighborhood = true;
    fallback.showExport = true;
    fallback.visibleSensors = new Set(["source"]);
    fallback.renderText = true;
    fallback.renderMatrix = true;
    fallback.renderBooleans = true;
    fallback.renderGradient = true;
    fallback.renderExportEffect = true;

    const evaluator = compileRendererDocument(`
      return {
        renderNode(context) {
          return RendererKit.composeNode(context, RendererKit.node.selectedRing());
        },
        renderEdge(context) {
          return RendererKit.composeEdge(context, RendererKit.edge.highlightNeighborhood(0.8));
        },
      };
    `);

    const output = evaluator({
      graph: { nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: {} }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: [],
      availableSensors: ["source", "obstacle"],
      defaults: visualizationToRendererDefaults(fallback),
    });

    const resolved = resolveVisualizationState(fallback, output, ["source", "obstacle"]);

    expect(resolved.showId).toBe(true);
    expect(resolved.showNeighborhood).toBe(false);
    expect(resolved.showExport).toBe(false);
    expect(Array.from(resolved.visibleSensors)).toEqual([]);
    expect(resolved.renderText).toBe(false);
    expect(resolved.renderMatrix).toBe(false);
    expect(resolved.renderBooleans).toBe(false);
    expect(resolved.renderGradient).toBe(false);
    expect(resolved.renderExportEffect).toBe(false);
  });

  it("summarizes the active renderers", () => {
    const visualization = createDefaultVisualizationState();
    visualization.renderBooleans = true;

    expect(summarizeActiveRenderers(visualization)).toContain("text");
    expect(summarizeActiveRenderers(visualization)).toContain("matrix");
    expect(summarizeActiveRenderers(visualization)).toContain("boolean");
  });

  it("supports node and edge callback renderers", () => {
    const evaluator = compileRendererDocument(`
      return {
        showId: false,
        renderNode({ node, selected, defaults }) {
          return {
            fill: selected ? "#ff0" : defaults.fill,
            labels: [node.id, String(node.labels.export ?? "none")],
            overlays: [
              { kind: "ring", radius: defaults.nodeSize + 4, stroke: "#ff0" },
              { kind: "text", text: "halo", y: -18 },
            ],
          };
        },
        renderEdge({ isNeighborhood, defaults }) {
          return {
            className: isNeighborhood ? "graph-edge is-neighborhood custom" : defaults.className,
            strokeWidth: isNeighborhood ? 4 : defaults.strokeWidth,
          };
        },
      };
    `);

    const output = evaluator({
      graph: {
        nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: { export: 42 } }],
        edges: [{ from: "1", to: "2" }],
      },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: ["1"],
      availableSensors: [],
      defaults: visualizationToRendererDefaults(createDefaultVisualizationState()),
    });

    expect(output?.showId).toBe(false);
    expect(typeof output?.renderNode).toBe("function");
    expect(typeof output?.renderEdge).toBe("function");

    const nodeOutput = output?.renderNode?.({
      node: { id: "1", position: { x: 0, y: 0 }, labels: { export: 42 } },
      graph: { nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: { export: 42 } }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selected: true,
      nodeIndex: 0,
      totalNodes: 1,
      incidentEdges: [],
      availableSensors: [],
      defaults: {
        fill: "#7db5ff",
        fillOpacity: 1,
        stroke: "#000",
        strokeWidth: 3,
        nodeSize: 10,
        fontSize: 12,
        labels: [],
        renderMatrix: true,
        renderBooleans: false,
        renderGradient: false,
        renderExportEffect: false,
        overlays: [],
      },
    });
    const edgeOutput = output?.renderEdge?.({
      edge: { from: "1", to: "2" },
      fromNode: { id: "1", position: { x: 0, y: 0 }, labels: {} },
      toNode: { id: "2", position: { x: 1, y: 0 }, labels: {} },
      graph: {
        nodes: [
          { id: "1", position: { x: 0, y: 0 }, labels: {} },
          { id: "2", position: { x: 1, y: 0 }, labels: {} },
        ],
        edges: [{ from: "1", to: "2" }],
      },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: ["1"],
      isNeighborhood: true,
      defaults: { hidden: false, className: "graph-edge is-neighborhood", strokeWidth: 1.8 },
    });

    expect(nodeOutput?.fill).toBe("#ff0");
    expect(normalizeNodeRenderLabels(nodeOutput?.labels, [])).toEqual(["1", "42"]);
    expect(normalizeNodeRenderOverlays(nodeOutput?.overlays, [])).toHaveLength(2);
    expect(edgeOutput?.className).toContain("custom");
    expect(edgeOutput?.strokeWidth).toBe(4);
  });

  it("supports RendererKit composed node and edge renderers", () => {
    const evaluator = compileRendererDocument(`
      return {
        renderNode(context) {
          return RendererKit.composeNode(
            context,
            RendererKit.node.selectedRing(),
            RendererKit.node.exportText(),
            RendererKit.node.sensorDot("source"),
            RendererKit.node.matrix(),
            RendererKit.node.booleans(),
            RendererKit.node.gradient(),
          );
        },
        renderEdge(context) {
          return RendererKit.composeEdge(
            context,
            RendererKit.edge.highlightNeighborhood(0.8),
            RendererKit.edge.muteNonNeighborhood(0.2),
          );
        },
      };
    `);

    const output = evaluator({
      graph: {
        nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: { export: 42, source: true } }],
        edges: [{ from: "1", to: "2" }],
      },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: ["1"],
      availableSensors: ["source"],
      defaults: visualizationToRendererDefaults(createDefaultVisualizationState()),
    });

    const nodeOutput = output?.renderNode?.({
      node: { id: "1", position: { x: 0, y: 0 }, labels: { export: 42, source: true } },
      graph: { nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: { export: 42, source: true } }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selected: true,
      nodeIndex: 0,
      totalNodes: 1,
      incidentEdges: [],
      availableSensors: ["source"],
      defaults: {
        fill: "#7db5ff",
        fillOpacity: 1,
        stroke: "#000",
        strokeWidth: 3,
        nodeSize: 10,
        fontSize: 12,
        labels: [],
        renderMatrix: true,
        renderBooleans: false,
        renderGradient: false,
        renderExportEffect: false,
        overlays: [],
      },
    });
    const highlightedEdge = output?.renderEdge?.({
      edge: { from: "1", to: "2" },
      fromNode: { id: "1", position: { x: 0, y: 0 }, labels: {} },
      toNode: { id: "2", position: { x: 1, y: 0 }, labels: {} },
      graph: {
        nodes: [
          { id: "1", position: { x: 0, y: 0 }, labels: {} },
          { id: "2", position: { x: 1, y: 0 }, labels: {} },
        ],
        edges: [{ from: "1", to: "2" }],
      },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: ["1"],
      isNeighborhood: true,
      defaults: { hidden: false, className: "graph-edge", strokeWidth: 1.8 },
    });
    const mutedEdge = output?.renderEdge?.({
      edge: { from: "1", to: "2" },
      fromNode: { id: "1", position: { x: 0, y: 0 }, labels: {} },
      toNode: { id: "2", position: { x: 1, y: 0 }, labels: {} },
      graph: {
        nodes: [
          { id: "1", position: { x: 0, y: 0 }, labels: {} },
          { id: "2", position: { x: 1, y: 0 }, labels: {} },
        ],
        edges: [{ from: "1", to: "2" }],
      },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: ["1"],
      isNeighborhood: false,
      defaults: { hidden: false, className: "graph-edge", strokeWidth: 1.8 },
    });

    expect(normalizeNodeRenderLabels(nodeOutput?.labels, [])).toEqual([]);
    expect(normalizeNodeRenderOverlays(nodeOutput?.overlays, [])).toHaveLength(3);
    expect(nodeOutput?.renderMatrix).toBe(true);
    expect(nodeOutput?.renderBooleans).toBe(true);
    expect(nodeOutput?.renderGradient).toBe(true);
    expect(highlightedEdge?.className).toContain("graph-edge is-neighborhood");
    expect(highlightedEdge?.strokeWidth).toBe(2.6);
    expect(mutedEdge?.className).toContain("graph-edge is-muted");
    expect(mutedEdge?.strokeOpacity).toBe(0.2);
  });

  it("maps export value to node size via sizeRange renderer", () => {
    const evaluator = compileRendererDocument(`
      return {
        renderNode(context) {
          return RendererKit.composeNode(
            context,
            RendererKit.node.sizeRange(0, 100, 6, 30),
          );
        },
      };
    `);

    const output = evaluator({
      graph: {
        nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: { export: 50 } }],
        edges: [],
      },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: [],
      availableSensors: [],
      defaults: visualizationToRendererDefaults(createDefaultVisualizationState()),
    });

    const nodeOutput = output?.renderNode?.({
      node: { id: "1", position: { x: 0, y: 0 }, labels: { export: 50 } },
      graph: { nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: { export: 50 } }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selected: false,
      nodeIndex: 0,
      totalNodes: 1,
      incidentEdges: [],
      availableSensors: [],
      defaults: {
        fill: "#7db5ff", fillOpacity: 1, stroke: "#000", strokeWidth: 3,
        nodeSize: 10, fontSize: 12, labels: [],
        renderMatrix: true, renderBooleans: false,
        renderGradient: false, renderExportEffect: false, overlays: [],
      },
    });

    expect(nodeOutput?.nodeSize).toBe(18);

    const fullRange = output?.renderNode?.({
      node: { id: "2", position: { x: 1, y: 0 }, labels: { export: 100 } },
      graph: { nodes: [{ id: "2", position: { x: 1, y: 0 }, labels: { export: 100 } }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selected: false,
      nodeIndex: 1,
      totalNodes: 2,
      incidentEdges: [],
      availableSensors: [],
      defaults: {
        fill: "#7db5ff", fillOpacity: 1, stroke: "#000", strokeWidth: 3,
        nodeSize: 10, fontSize: 12, labels: [],
        renderMatrix: true, renderBooleans: false,
        renderGradient: false, renderExportEffect: false, overlays: [],
      },
    });

    expect(fullRange?.nodeSize).toBe(30);

    const stringExport = output?.renderNode?.({
      node: { id: "3", position: { x: 2, y: 0 }, labels: { export: "25.50" } },
      graph: { nodes: [{ id: "3", position: { x: 2, y: 0 }, labels: { export: "25.50" } }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selected: false,
      nodeIndex: 2,
      totalNodes: 3,
      incidentEdges: [],
      availableSensors: [],
      defaults: {
        fill: "#7db5ff", fillOpacity: 1, stroke: "#000", strokeWidth: 3,
        nodeSize: 10, fontSize: 12, labels: [],
        renderMatrix: true, renderBooleans: false,
        renderGradient: false, renderExportEffect: false, overlays: [],
      },
    });

    expect(stringExport?.nodeSize).toBeCloseTo(12.12, 1);
  });

  it("switches the default document to the canvas renderer on large networks", () => {
    const evaluator = compileRendererDocument(defaultRendererDocument);
    const evaluateWith = (nodeCount: number) =>
      evaluator({
        graph: {
          nodes: Array.from({ length: nodeCount }, (_, index) => ({
            id: String(index),
            position: { x: index, y: 0 },
            labels: {},
          })),
          edges: [],
        },
        execution: { status: "ready", generation: 0, warnings: [], problems: [] },
        selectedNodeIds: [],
        availableSensors: [],
        defaults: visualizationToRendererDefaults(createDefaultVisualizationState()),
      });

    // Small: SVG, with links and ids.
    const small = evaluateWith(50);
    expect(small?.rendererType).toBe("standard");
    expect(small?.showLinks).toBe(true);
    expect(small?.showId).toBe(true);

    // Dense but still SVG: links off, because SVG cannot afford them.
    const dense = evaluateWith(300);
    expect(dense?.rendererType).toBe("standard");
    expect(dense?.showLinks).toBe(false);
    expect(dense?.showId).toBe(false);

    // Heavy: canvas takes over, and links come back with it.
    const heavy = evaluateWith(1000);
    expect(heavy?.rendererType).toBe("lightweight");
    expect(heavy?.showLinks).toBe(true);
  });

  it("supports rendererType selection in the output", () => {
    const evaluator = compileRendererDocument(`
      return {
        rendererType: "lightweight",
      };
    `);

    const output = evaluator({
      graph: { nodes: [], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [], problems: [] },
      selectedNodeIds: [],
      availableSensors: [],
      defaults: visualizationToRendererDefaults(createDefaultVisualizationState()),
    });

    expect(output?.rendererType).toBe("lightweight");
  });
});