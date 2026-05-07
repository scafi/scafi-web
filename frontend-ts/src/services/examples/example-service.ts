import type { ExampleGroup } from "../../domain/contracts";
import type { KeyValueStore } from "../browser/key-value-store";
import { parseWorldDocument, serializeWorldDocument } from "../config/world-document";

export interface ExampleServiceOptions {
  fetchImpl?: typeof fetch;
  examplesUrl?: string;
  cacheKey?: string;
}

const DEFAULT_CACHE_KEY = "examples";
const DEFAULT_EXAMPLES_URL = "config/examples.json";

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return fetchImpl;
  }
  return globalThis.fetch.bind(globalThis);
}

export class ExampleService {
  private readonly fetchImpl: typeof fetch;
  private readonly examplesUrl: string;
  private readonly cacheKey: string;

  constructor(
    private readonly store: KeyValueStore,
    options: ExampleServiceOptions = {},
  ) {
    this.fetchImpl = resolveFetch(options.fetchImpl);
    this.examplesUrl = options.examplesUrl ?? DEFAULT_EXAMPLES_URL;
    this.cacheKey = options.cacheKey ?? DEFAULT_CACHE_KEY;
  }

  async loadExamples(): Promise<ExampleGroup[]> {
    try {
      return await this.loadRemote();
    } catch (error) {
      try {
        return this.loadCached();
      } catch {
        throw error;
      }
    }
  }

  async loadRemote(): Promise<ExampleGroup[]> {
    const response = await this.fetchImpl(this.examplesUrl);
    if (!response.ok) {
      throw new Error(`Examples request failed with status ${response.status}`);
    }
    const rawText = await response.text();
    const groups = normalizeExampleGroups(JSON.parse(rawText) as ExampleGroup[]);
    try {
      this.store.set(this.cacheKey, rawText);
    } catch {
      // Remote examples remain usable even when persistence is unavailable.
    }
    return groups;
  }

  loadCached(): ExampleGroup[] {
    const rawText = this.store.get(this.cacheKey);
    if (!rawText) {
      throw new Error("Examples not available in cache");
    }
    return normalizeExampleGroups(JSON.parse(rawText) as ExampleGroup[]);
  }
}

function normalizeExampleGroups(groups: ExampleGroup[]): ExampleGroup[] {
  return groups.map((group) => ({
    groupName: group.groupName,
    examples: group.examples.map((example) => ({
      ...example,
      renderer: example.renderer ?? resolveExampleRenderer(group.groupName, example),
      devices: {
        sensors: normalizeMatrixEntries(example.devices.sensors),
        initialValues: Object.fromEntries(
          Object.entries(example.devices.initialValues ?? {}).map(([nodeId, sensors]) => [
            nodeId,
            normalizeMatrixEntries(sensors),
          ]),
        ),
      },
      world:
        example.world ??
        serializeWorldDocument(
          parseWorldDocument(
            serializeWorldDocument({
              network: {
                kind: "grid",
                rows: 10,
                cols: 10,
                stepX: 60,
                stepY: 60,
                tolerance: 10,
              },
              neighbour: { range: 70 },
              deviceShape: {
                sensors: normalizeMatrixEntries(example.devices.sensors),
                initialValues: Object.fromEntries(
                  Object.entries(example.devices.initialValues ?? {}).map(([nodeId, sensors]) => [
                    nodeId,
                    normalizeMatrixEntries(sensors),
                  ]),
                ),
              },
              seed: { configSeed: 0, simulationSeed: 0, randomSensorSeed: 0 },
            }),
          ),
        ),
    })),
  }));
}

function normalizeMatrixEntries(values: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, normalizeValue(value)]),
  );
}

function normalizeValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  if ("$type" in value && "dimension" in value && "pixels" in value) {
    return {
      dimension: Number((value as { dimension: unknown }).dimension),
      pixels: Object.fromEntries(
        ((value as { pixels?: unknown }).pixels as Array<[[number, number], string]> | undefined)?.map(
          ([coords, color]) => [`${coords[0]}:${coords[1]}`, color],
        ) ?? [],
      ),
    };
  }
  return value;
}

function resolveExampleRenderer(groupName: string, example: ExampleGroup["examples"][number]): string {
  const sensors = Object.keys(example.devices.sensors ?? {}).filter((name) => name !== "matrix");
  const lowercaseGroup = groupName.toLowerCase();

  switch (example.name) {
    case "Hello scafi":
      return createValueRenderer({
        showIdExpr: "false",
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
        },
      });
    case "Sense":
      return createSensorRenderer(["sensor"], {
        renderNodeOptions: {
          selectedRing: true,
          sensorDots: ["sensor"],
        },
      });
    case "Neighbour count":
    case "Field Evolution":
      return createValueRenderer({
        showIdExpr: "false",
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
        },
      });
    case "Gradient":
      return createGradientRenderer(["sensor"], {
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
          sensorDots: ["sensor"],
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.8),
      });
    case "Spread across the gradient":
      return createGradientRenderer(["source"], {
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
          sensorDots: ["source"],
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.8),
      });
    case "Broadcast data":
      return createValueRenderer({
        showIdExpr: "selectedNodeIds.length > 0",
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
          sensorDots: ["source"],
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.7),
      });
    case "Channel":
      return createBooleanFieldRenderer(["source", "target"], {
        renderNodeOptions: {
          selectedRing: true,
          sensorDots: ["source", "target"],
          exportText: true,
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.9),
      });
    case "Channel with obstacles":
      return createBooleanFieldRenderer(["source", "obstacle", "target"], {
        renderNodeOptions: {
          selectedRing: true,
          sensorDots: ["source", "obstacle", "target"],
          exportText: true,
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.9),
      });
    case "Collect data":
      return createValueRenderer({
        showIdExpr: "false",
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
          sensorDots: ["source"],
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.7),
      });
    case "Block S":
      return createBooleanFieldRenderer([], {
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.6),
      });
    case "Turn on matrix with colors":
    case "Hsl colors":
    case "complex shape":
      return createMatrixRenderer([], {
        renderNodeOptions: {
          selectedRing: true,
        },
      });
    case "Sensor based colors":
      return createMatrixRenderer(["source", "obstacle", "target"], {
        renderNodeOptions: {
          selectedRing: true,
          sensorDots: ["source", "obstacle", "target"],
          renderBooleans: true,
        },
      });
    case "Change velocity":
    case "Movement with rep":
    case "Movement 2D lib: rotation":
    case "Movement 2D lib: go to":
    case "Movement 2D lib: explore":
      return createMovementRenderer(sensors, {
        renderNodeOptions: {
          selectedRing: true,
          sensorDots: sensors,
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.6),
      });
    case "Pattern SCR":
      return createValueRenderer({
        showIdExpr: "false",
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
        },
        renderEdgeSource: createNeighborhoodEdgeRendererSource(0.7),
      });
    case "Pattern SCR building areas":
      return createMatrixRenderer([], {
        renderNodeOptions: {
          selectedRing: true,
        },
      });
    default:
      break;
  }

  if (lowercaseGroup.includes("matrix")) {
    return createMatrixRenderer(sensors);
  }
  if (lowercaseGroup.includes("movement")) {
    return createMovementRenderer(sensors);
  }
  if (lowercaseGroup.includes("libraries") || lowercaseGroup.includes("high level")) {
    return createBooleanFieldRenderer(sensors);
  }
  if (sensors.length > 0) {
    return createSensorRenderer(sensors);
  }
  return createValueRenderer();
}

type ExampleRendererOptions = {
  prelude?: string;
  nodeSizeExpr: string;
  fontSizeExpr: string;
  showIdExpr: string;
  renderNodeOptions?: NodeRendererSourceOptions;
  renderEdgeSource?: string;
};

type ExampleRendererOverrides = Partial<ExampleRendererOptions>;

type NodeRendererSourceOptions = {
  selectedRing?: boolean;
  exportText?: boolean;
  sensorDots?: string[];
  renderMatrix?: boolean;
  renderBooleans?: boolean;
  renderGradient?: boolean;
  renderExportEffect?: boolean;
};

function createValueRenderer(overrides: ExampleRendererOverrides = {}): string {
  const { renderNodeOptions, renderEdgeSource, ...rest } = overrides;
  return buildRendererTemplate({
    nodeSizeExpr: "graph.nodes.length > 160 ? 8 : 12",
    fontSizeExpr: "graph.nodes.length > 160 ? 10 : 13",
    showIdExpr: "graph.nodes.length <= 100",
    ...rest,
    renderNodeOptions,
    renderEdgeSource,
  });
}

function createSensorRenderer(_sensors: string[], overrides: ExampleRendererOverrides = {}): string {
  const { renderNodeOptions, renderEdgeSource, ...rest } = overrides;
  return buildRendererTemplate({
    nodeSizeExpr: "graph.nodes.length > 180 ? 8 : 11",
    fontSizeExpr: "graph.nodes.length > 180 ? 10 : 12",
    showIdExpr: "selectedNodeIds.length > 0",
    ...rest,
    renderNodeOptions: mergeNodeRendererOptions({ renderBooleans: true }, renderNodeOptions),
    renderEdgeSource,
  });
}

function createGradientRenderer(_sensors: string[], overrides: ExampleRendererOverrides = {}): string {
  const { renderNodeOptions, renderEdgeSource, ...rest } = overrides;
  return buildRendererTemplate({
    prelude: "const dense = graph.nodes.length > 180;",
    nodeSizeExpr: "dense ? 8 : 10",
    fontSizeExpr: "dense ? 10 : 12",
    showIdExpr: "false",
    ...rest,
    renderNodeOptions: mergeNodeRendererOptions({ renderMatrix: true, renderGradient: true }, renderNodeOptions),
    renderEdgeSource,
  });
}

function createBooleanFieldRenderer(_sensors: string[], overrides: ExampleRendererOverrides = {}): string {
  const { renderNodeOptions, renderEdgeSource, ...rest } = overrides;
  return buildRendererTemplate({
    prelude: "const dense = graph.nodes.length > 180;",
    nodeSizeExpr: "dense ? 8 : 10",
    fontSizeExpr: "dense ? 10 : 12",
    showIdExpr: "false",
    ...rest,
    renderNodeOptions: mergeNodeRendererOptions(
      { renderMatrix: true, renderBooleans: true, renderGradient: true },
      renderNodeOptions,
    ),
    renderEdgeSource,
  });
}

function createMatrixRenderer(sensors: string[], overrides: ExampleRendererOverrides = {}): string {
  const { renderNodeOptions, renderEdgeSource, ...rest } = overrides;
  return buildRendererTemplate({
    nodeSizeExpr: "defaults.nodeSize + 4",
    fontSizeExpr: "defaults.fontSize",
    showIdExpr: "false",
    ...rest,
    renderNodeOptions: mergeNodeRendererOptions(
      { renderMatrix: true, renderBooleans: sensors.length > 0 },
      renderNodeOptions,
    ),
    renderEdgeSource,
  });
}

function createMovementRenderer(sensors: string[], overrides: ExampleRendererOverrides = {}): string {
  const { renderNodeOptions, renderEdgeSource, ...rest } = overrides;
  return buildRendererTemplate({
    prelude: "const dense = graph.nodes.length > 180;",
    nodeSizeExpr: "dense ? 7 : 9",
    fontSizeExpr: "10",
    showIdExpr: "false",
    ...rest,
    renderNodeOptions: mergeNodeRendererOptions(
      { renderMatrix: true, renderBooleans: sensors.length > 0 },
      renderNodeOptions,
    ),
    renderEdgeSource,
  });
}

function buildRendererTemplate(options: ExampleRendererOptions): string {
  const sections = [
    `  nodeSize: ${options.nodeSizeExpr},`,
    `  fontSize: ${options.fontSizeExpr},`,
    `  showId: ${options.showIdExpr},`,
  ];
  const renderNodeSource = createNodeRendererSource(options.renderNodeOptions);
  if (renderNodeSource) {
    sections.push(`${indentRendererSource(renderNodeSource)},`);
  }
  if (options.renderEdgeSource) {
    sections.push(`${indentRendererSource(options.renderEdgeSource)},`);
  }
  return `${options.prelude ? `${options.prelude}\n\n` : ""}return {\n${sections.join("\n")}\n};\n`;
}

function indentRendererSource(source: string): string {
  return source
    .trim()
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function mergeNodeRendererOptions(
  base: NodeRendererSourceOptions | undefined,
  override: NodeRendererSourceOptions | undefined,
): NodeRendererSourceOptions | undefined {
  if (!base) {
    return override;
  }
  if (!override) {
    return base;
  }
  const sensorDots = Array.from(new Set([...(base.sensorDots ?? []), ...(override.sensorDots ?? [])]));
  return {
    selectedRing: override.selectedRing ?? base.selectedRing,
    exportText: override.exportText ?? base.exportText,
    sensorDots: sensorDots.length > 0 ? sensorDots : undefined,
    renderMatrix: override.renderMatrix ?? base.renderMatrix,
    renderBooleans: override.renderBooleans ?? base.renderBooleans,
    renderGradient: override.renderGradient ?? base.renderGradient,
    renderExportEffect: override.renderExportEffect ?? base.renderExportEffect,
  };
}

function createNodeRendererSource(options: NodeRendererSourceOptions | undefined): string | undefined {
  if (!options) {
    return undefined;
  }
  const parts = [] as string[];
  if (options.selectedRing) {
    parts.push("RendererKit.node.selectedRing()");
  }
  if (options.exportText) {
    parts.push("RendererKit.node.exportText()");
  }
  for (const sensor of options.sensorDots ?? []) {
    parts.push(`RendererKit.node.sensorDot(${JSON.stringify(sensor)})`);
  }
  if (options.renderMatrix) {
    parts.push("RendererKit.node.matrix()");
  }
  if (options.renderBooleans) {
    parts.push("RendererKit.node.booleans()");
  }
  if (options.renderGradient) {
    parts.push("RendererKit.node.gradient()");
  }
  if (options.renderExportEffect) {
    parts.push("RendererKit.node.exportEffect()");
  }
  if (parts.length === 0) {
    return undefined;
  }
  return [
    "renderNode(context) {",
    "  return RendererKit.composeNode(",
    "    context,",
    ...parts.map((part) => `    ${part},`),
    "  );",
    "}",
  ].join("\n");
}

function createNeighborhoodEdgeRendererSource(widthDelta: number): string {
  return `renderEdge(context) {
  return RendererKit.composeEdge(
    context,
    RendererKit.edge.highlightNeighborhood(${widthDelta}),
    RendererKit.edge.muteNonNeighborhood(0.24),
  );
}`;
}