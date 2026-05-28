import type { ExampleGroup, ExampleDefinition } from "../../domain/contracts";
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
    examples: group.examples.map((example) => {
      let world = example.world;
      if (!world) {
        const deviceShape = (example as any).devices ?? { sensors: {}, initialValues: {} };
        world = serializeWorldDocument(
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
                sensors: normalizeMatrixEntries(deviceShape.sensors),
                initialValues: Object.fromEntries(
                  Object.entries(deviceShape.initialValues ?? {}).map(([nodeId, sensors]) => [
                    nodeId,
                    normalizeMatrixEntries(sensors as Record<string, unknown>),
                  ]),
                ),
              },
              seed: { configSeed: 0, simulationSeed: 0, randomSensorSeed: 0 },
            }),
          ),
        );
      }

      const parsedWorld = parseWorldDocument(world);
      const sensors = Object.keys(parsedWorld.deviceShape.sensors).filter((name) => name !== "matrix");

      const normalizedExample = {
        ...example,
        world,
      };

      const renderer = example.renderer ?? resolveExampleRenderer(group.groupName, normalizedExample, sensors);

      return {
        ...normalizedExample,
        renderer,
      };
    }),
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

function resolveExampleRenderer(groupName: string, example: ExampleDefinition, sensors: string[]): string {
  const lowercaseGroup = groupName.toLowerCase();

  switch (example.name) {
    case "Hello scafi": {
      const baseRenderer = createValueRenderer({
        showIdExpr: "false",
        renderNodeOptions: {
          selectedRing: true,
          exportText: true,
        },
      });
      const comment = [
        "/**",
        " * ==========================================",
        " * SUPPORTED RENDERING CONFIGURATION OPTIONS",
        " * ==========================================",
        " * ",
        " * You can customize the look and feel of the simulation using the options below:",
        " * ",
        " * 1. BASIC STYLING PROPERTIES",
        " *    - nodeSize: number | (context) => number",
        " *      The size of the nodes (e.g., 12 or graph.nodes.length > 160 ? 8 : 12)",
        " *    - fontSize: number | (context) => number",
        " *      The font size for labels (e.g., 10 or graph.nodes.length > 160 ? 10 : 13)",
        " *    - showId: boolean | (context) => boolean",
        " *      Whether to show node IDs (e.g., false or graph.nodes.length <= 100)",
        " *    - rendererType: \"standard\" | \"lightweight\"",
        " *      \"standard\" renders full details; \"lightweight\" offers optimized performance for large networks.",
        " * ",
        " * 2. CUSTOM RENDERING HOOKS",
        " *    - renderNode(context): Custom draw logic for each node.",
        " *      Use RendererKit.composeNode(context, ...plugins) to layer visual effects.",
        " *    - renderEdge(context): Custom draw logic for each communication link.",
        " *      Use RendererKit.composeEdge(context, ...plugins) to style connections.",
        " * ",
        " * 3. RENDERER_KIT NODE PLUGINS (RendererKit.node)",
        " *    - selectedRing(options)",
        " *      Draws a ring around the currently selected node(s).",
        " *      Options: { radius, stroke, strokeWidth, fill, fillOpacity, className }",
        " *    - exportText(options)",
        " *      Displays the current export value or a custom label above/below the node.",
        " *      Options: { label, format, digits, x, y, fill, fontSize, className, anchor }",
        " *    - sensorDot(sensorName, options)",
        " *      Draws a colored indicator dot on the node if a boolean sensor is active.",
        " *      Options: { x, y, radius, fill, fillOpacity, stroke, strokeWidth, className }",
        " *    - matrix()",
        " *      Enables rendering of node LED matrix grids if present.",
        " *    - booleans()",
        " *      Enables the generic rendering of boolean sensor values on nodes.",
        " *    - gradient()",
        " *      Enables node background gradient/coloration based on local fields.",
        " *      (e.g. used in \"Collect data\" or \"Gradient\" to display temperature/colors)",
        " *    - exportEffect()",
        " *      Enables visualization of the export value.",
        " *    - velocityArrow(options)",
        " *      Draws a directional arrow on nodes based on their vx and vy velocities.",
        " *      Options: { length, stroke, strokeWidth, className }",
        " *    - sizeRange(minInput, maxInput, minOutput, maxOutput, label)",
        " *      Proportionally scales the size of each node based on a specific label value.",
        " * ",
        " * 4. RENDERER_KIT EDGE PLUGINS (RendererKit.edge)",
        " *    - highlightNeighborhood(widthDelta, options)",
        " *      Highlights lines connected to the selected neighborhood nodes.",
        " *      Options: { className, stroke, strokeWidth, strokeOpacity }",
        " *    - muteNonNeighborhood(opacity, options)",
        " *      Dims or hides lines that do not belong to the selected neighborhood.",
        " *      Options: { hidden, className, stroke, strokeWidth, strokeOpacity }",
        " */",
        "",
      ].join("\n");
      return comment + baseRenderer;
    }
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
        rendererType: "lightweight",
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
    case "Movement: repulsion":
    case "Movement: going to leader":
    case "Movement: flocking":
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
  rendererType?: "standard" | "lightweight";
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
  velocityArrow?: boolean;
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
      { renderMatrix: true, renderBooleans: sensors.length > 0, velocityArrow: true },
      renderNodeOptions,
    ),
    renderEdgeSource,
  });
}

function buildRendererTemplate(options: ExampleRendererOptions): string {
  const rendererType = options.rendererType ?? "standard";
  const sections = [
    `  nodeSize: ${options.nodeSizeExpr},`,
    `  fontSize: ${options.fontSizeExpr},`,
    `  showId: ${options.showIdExpr},`,
    `  rendererType: "${rendererType}",`,
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
    velocityArrow: override.velocityArrow ?? base.velocityArrow,
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
  if (options.velocityArrow) {
    parts.push("RendererKit.node.velocityArrow()");
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
  );
}`;
}