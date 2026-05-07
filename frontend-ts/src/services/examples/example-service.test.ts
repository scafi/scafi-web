import { describe, expect, it } from "vitest";
import {
  compileRendererDocument,
  createDefaultVisualizationState,
  visualizationToRendererDefaults,
} from "../../app/renderer-document";
import { MemoryKeyValueStore } from "../browser/key-value-store";
import { ExampleService } from "./example-service";
import { parseWorldDocument } from "../config/world-document";

describe("ExampleService", () => {
  it("loads examples remotely and normalizes matrix payloads", async () => {
    const service = new ExampleService(new MemoryKeyValueStore(), {
      fetchImpl: async () =>
        ({
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                groupName: "Basic",
                examples: [
                  {
                    name: "Hello",
                    body: '"hello"',
                    devices: {
                      sensors: {
                        matrix: {
                          $type: "it.unibo.scafi.js.model.MatrixLed.MatrixMap",
                          dimension: 2,
                          pixels: [
                            [[0, 1], "#fff"],
                            [[1, 0], "#000"],
                          ],
                        },
                      },
                      initialValues: {},
                    },
                    renderer: "return { renderMatrix: true, renderText: false };",
                  },
                ],
              },
            ]),
        }) as Response,
    });

    const groups = await service.loadExamples();

    expect(groups[0]?.examples[0]?.devices.sensors.matrix).toEqual({
      dimension: 2,
      pixels: {
        "0:1": "#fff",
        "1:0": "#000",
      },
    });
    expect(groups[0]?.examples[0]?.world).toContain('.grid(rows = 10, cols = 10, stepX = 60, stepY = 60, tolerance = 10)');
    expect(parseWorldDocument(groups[0]?.examples[0]?.world ?? "").deviceShape.sensors.matrix).toEqual({
      dimension: 2,
      pixels: {
        "0:0": "#fff",
        "0:1": "#fff",
        "1:0": "#fff",
        "1:1": "#fff",
      },
    });
    expect(groups[0]?.examples[0]?.renderer).toBe("return { renderMatrix: true, renderText: false };");
  });

  it("falls back to cached examples when remote loading fails", async () => {
    const store = new MemoryKeyValueStore();
    store.set(
      "examples",
      JSON.stringify([{ groupName: "Cached", examples: [{ name: "E", body: "x", devices: { sensors: {}, initialValues: {} } }] }]),
    );
    const service = new ExampleService(store, {
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });

    const groups = await service.loadExamples();

    expect(groups).toHaveLength(1);
    expect(groups[0]?.groupName).toBe("Cached");
    expect(groups[0]?.examples[0]?.name).toBe("E");
    expect(groups[0]?.examples[0]?.world).toContain("world");
    expect(groups[0]?.examples[0]?.renderer).toContain("nodeSize");
  });

  it("returns remote examples even when cache persistence fails", async () => {
    const store = {
      get: () => null,
      set: () => {
        throw new Error("quota exceeded");
      },
      remove: () => undefined,
    };
    const service = new ExampleService(store, {
      fetchImpl: async () =>
        ({
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                groupName: "Basic",
                examples: [{ name: "Hello", body: '"hello"', devices: { sensors: {}, initialValues: {} } }],
              },
            ]),
        }) as Response,
    });

    const groups = await service.loadExamples();

    expect(groups).toHaveLength(1);
    expect(groups[0]?.groupName).toBe("Basic");
    expect(groups[0]?.examples[0]?.name).toBe("Hello");
    expect(groups[0]?.examples[0]?.world).toContain('.radius(70)');
    expect(groups[0]?.examples[0]?.renderer).toContain("nodeSize");
  });

  it("assigns tailored renderers to known example names", async () => {
    const service = new ExampleService(new MemoryKeyValueStore(), {
      fetchImpl: async () =>
        ({
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                groupName: "Basic",
                examples: [
                  { name: "Hello scafi", body: '"hello scafi"', devices: { sensors: {}, initialValues: {} } },
                  {
                    name: "Sense",
                    body: 'sense[Boolean]("sensor")',
                    devices: { sensors: { sensor: false }, initialValues: {} },
                  },
                ],
              },
              {
                groupName: "Libraries",
                examples: [
                  {
                    name: "Channel with obstacles",
                    body: 'sense("obstacle")',
                    devices: { sensors: { source: false, obstacle: false, target: false }, initialValues: {} },
                  },
                ],
              },
              {
                groupName: "Matrix led",
                examples: [
                  {
                    name: "Sensor based colors",
                    body: 'sense("source")',
                    devices: { sensors: { source: false, obstacle: false, target: false, matrix: { $type: "it.unibo.scafi.js.model.MatrixLed.MatrixMap", dimension: 2, pixels: [[[0, 0], "#fff"]] } }, initialValues: {} },
                  },
                ],
              },
            ]),
        }) as Response,
    });

    const groups = await service.loadExamples();
    const examples = groups.flatMap((group) => group.examples);

    expect(examples.find((example) => example.name === "Hello scafi")?.renderer).not.toContain("fixedLabel");
    expect(examples.find((example) => example.name === "Sense")?.renderer).toContain('RendererKit.node.sensorDot("sensor")');
    expect(examples.find((example) => example.name === "Channel with obstacles")?.renderer).toContain("RendererKit.edge.highlightNeighborhood(0.9)");
    expect(examples.find((example) => example.name === "Sensor based colors")?.renderer).toContain('RendererKit.node.sensorDot("obstacle")');
    expect(examples.find((example) => example.name === "Sensor based colors")?.renderer).toContain("RendererKit.node.matrix()");
  });

  it("compiles generated renderers that define both renderNode and renderEdge", async () => {
    const service = new ExampleService(new MemoryKeyValueStore(), {
      fetchImpl: async () =>
        ({
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                groupName: "Libraries",
                examples: [
                  {
                    name: "Channel with obstacles",
                    body: 'sense("obstacle")',
                    devices: { sensors: { source: false, obstacle: false, target: false }, initialValues: {} },
                  },
                ],
              },
            ]),
        }) as Response,
    });

    const groups = await service.loadExamples();
    const renderer = groups[0]?.examples[0]?.renderer;
    expect(renderer).toBeTruthy();

    const evaluator = compileRendererDocument(renderer ?? "");
    const graph = {
      nodes: [
        { id: "1", position: { x: 0, y: 0 }, labels: { source: true, export: true } },
        { id: "2", position: { x: 1, y: 0 }, labels: { obstacle: true } },
      ],
      edges: [{ from: "1", to: "2" }],
    };
    const output = evaluator({
      graph,
      execution: { status: "ready", generation: 0, warnings: [] },
      selectedNodeIds: ["1"],
      availableSensors: ["source", "obstacle", "target"],
      defaults: visualizationToRendererDefaults(createDefaultVisualizationState()),
    });

    const nodeOutput = output?.renderNode?.({
      node: graph.nodes[0],
      graph,
      execution: { status: "ready", generation: 0, warnings: [] },
      selected: true,
      nodeIndex: 0,
      totalNodes: 2,
      incidentEdges: graph.edges,
      availableSensors: ["source", "obstacle", "target"],
      defaults: {
        fill: "#7db5ff",
        fillOpacity: 1,
        stroke: "#000",
        strokeWidth: 3,
        nodeSize: 10,
        fontSize: 12,
        labels: [],
        renderMatrix: true,
        renderBooleans: true,
        renderGradient: false,
        renderExportEffect: false,
        overlays: [],
      },
    });
    const highlightedEdge = output?.renderEdge?.({
      edge: graph.edges[0],
      fromNode: graph.nodes[0],
      toNode: graph.nodes[1],
      graph,
      execution: { status: "ready", generation: 0, warnings: [] },
      selectedNodeIds: ["1"],
      isNeighborhood: true,
      defaults: { hidden: false, className: "graph-edge", strokeWidth: 1.8 },
    });
    const mutedEdge = output?.renderEdge?.({
      edge: graph.edges[0],
      fromNode: graph.nodes[0],
      toNode: graph.nodes[1],
      graph,
      execution: { status: "ready", generation: 0, warnings: [] },
      selectedNodeIds: ["1"],
      isNeighborhood: false,
      defaults: { hidden: false, className: "graph-edge", strokeWidth: 1.8 },
    });

    expect(typeof output?.renderNode).toBe("function");
    expect(typeof output?.renderEdge).toBe("function");
    expect(nodeOutput?.overlays).toHaveLength(3);
    expect(nodeOutput?.renderMatrix).toBe(true);
    expect(nodeOutput?.renderBooleans).toBe(true);
    expect(nodeOutput?.renderGradient).toBe(true);
    expect(highlightedEdge?.className).toContain("graph-edge is-neighborhood");
    expect(mutedEdge?.className).toContain("graph-edge is-muted");
  });

  it("uses movement defaults for movement groups without explicit example mappings", async () => {
    const service = new ExampleService(new MemoryKeyValueStore(), {
      fetchImpl: async () =>
        ({
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                groupName: "Movement experiments",
                examples: [
                  {
                    name: "Custom movement",
                    body: 'sense("target")',
                    devices: { sensors: { target: false }, initialValues: {} },
                  },
                ],
              },
            ]),
        }) as Response,
    });

    const groups = await service.loadExamples();
    const renderer = groups[0]?.examples[0]?.renderer;
    const evaluator = compileRendererDocument(renderer ?? "");
    const output = evaluator({
      graph: { nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: {} }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [] },
      selectedNodeIds: [],
      availableSensors: ["target"],
      defaults: visualizationToRendererDefaults(createDefaultVisualizationState()),
    });
    const nodeOutput = output?.renderNode?.({
      node: { id: "1", position: { x: 0, y: 0 }, labels: {} },
      graph: { nodes: [{ id: "1", position: { x: 0, y: 0 }, labels: {} }], edges: [] },
      execution: { status: "ready", generation: 0, warnings: [] },
      selected: false,
      nodeIndex: 0,
      totalNodes: 1,
      incidentEdges: [],
      availableSensors: ["target"],
      defaults: {
        fill: "#7db5ff",
        fillOpacity: 1,
        stroke: "#000",
        strokeWidth: 3,
        nodeSize: 10,
        fontSize: 12,
        labels: [],
        renderMatrix: false,
        renderBooleans: false,
        renderGradient: false,
        renderExportEffect: false,
        overlays: [],
      },
    });

    expect(output?.showId).toBe(false);
    expect(nodeOutput?.renderMatrix).toBe(true);
    expect(nodeOutput?.renderBooleans).toBe(true);
  });
});