import type { GraphEdge, GraphNode, GraphSnapshot } from "../domain/contracts";
import type { AppState } from "../state/app-store";

export type VisualizationState = {
  nodeSize: number;
  fontSize: number;
  showId: boolean;
  showNeighborhood: boolean;
  showExport: boolean;
  visibleSensors: Set<string>;
  renderText: boolean;
  renderMatrix: boolean;
  renderBooleans: boolean;
  renderGradient: boolean;
  renderExportEffect: boolean;
};

export type RendererDocumentDefaults = Omit<VisualizationState, "visibleSensors"> & {
  visibleSensors: string[];
};

export type RendererDocumentContext = {
  graph: GraphSnapshot;
  execution: AppState["execution"];
  selectedNodeIds: string[];
  availableSensors: string[];
  defaults: RendererDocumentDefaults;
};

export type NodeRenderDefaults = {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  nodeSize: number;
  fontSize: number;
  labels: string[];
  renderMatrix: boolean;
  renderBooleans: boolean;
  renderGradient: boolean;
  renderExportEffect: boolean;
  overlays: NodeRenderOverlay[];
};

export type NodeTextOverlay = {
  kind: "text";
  text: string;
  x?: number;
  y: number;
  fill?: string;
  fontSize?: number;
  className?: string;
  anchor?: "start" | "middle" | "end";
};

export type NodeRingOverlay = {
  kind: "ring";
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
  className?: string;
};

export type NodeDotOverlay = {
  kind: "dot";
  x: number;
  y: number;
  radius?: number;
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
};

export type NodeArrowOverlay = {
  kind: "arrow";
  dx: number;
  dy: number;
  length?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
};

export type NodeRenderOverlay = NodeTextOverlay | NodeRingOverlay | NodeDotOverlay | NodeArrowOverlay;

export type NodeRendererContext = {
  node: GraphNode;
  graph: GraphSnapshot;
  execution: AppState["execution"];
  selected: boolean;
  nodeIndex: number;
  totalNodes: number;
  incidentEdges: GraphEdge[];
  availableSensors: string[];
  defaults: NodeRenderDefaults;
};

export type NodeRenderOutput = Partial<Omit<NodeRenderDefaults, "labels">> & {
  hidden?: boolean;
  labels?: string[] | string;
  className?: string;
  overlays?: NodeRenderOverlay[];
};

export type EdgeRenderDefaults = {
  hidden: boolean;
  className: string;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
};

export type EdgeRendererContext = {
  edge: GraphEdge;
  fromNode: GraphNode;
  toNode: GraphNode;
  graph: GraphSnapshot;
  execution: AppState["execution"];
  selectedNodeIds: string[];
  isNeighborhood: boolean;
  defaults: EdgeRenderDefaults;
};

export type EdgeRenderOutput = Partial<EdgeRenderDefaults>;

export type NodeRendererEvaluator = (context: NodeRendererContext) => NodeRenderOutput | void;

export type EdgeRendererEvaluator = (context: EdgeRendererContext) => EdgeRenderOutput | void;

export type RendererDocumentOutput = Partial<RendererDocumentDefaults> & {
  rendererType?: "standard" | "lightweight" | "pixi";
  visibleSensors?: string[] | "all";
  renderNode?: NodeRendererEvaluator;
  renderEdge?: EdgeRendererEvaluator;
};

export type RendererDocumentEvaluator = (context: RendererDocumentContext) => RendererDocumentOutput | void;

const RENDERER_KIT_SOURCE = String.raw`const RendererKit = (() => {
  const sensorDotColors = {
    source: "#ff8a65",
    target: "#ffd54f",
    obstacle: "#ef5350",
    sensor: "#81c784",
  };

  const mergeClassName = (current, next) => {
    if (!next) {
      return current;
    }
    if (!current) {
      return next;
    }
    return Array.from(new Set((current + " " + next).split(/\s+/).filter(Boolean))).join(" ");
  };

  const mergeRenderOutput = (current, fragment) => {
    if (!fragment) {
      return current;
    }
    const next = current ? { ...current } : {};
    for (const [key, value] of Object.entries(fragment)) {
      if (value === undefined || key === "className" || key === "labels" || key === "overlays") {
        continue;
      }
      next[key] = value;
    }
    if (fragment.className) {
      next.className = mergeClassName(next.className, fragment.className);
    }
    if (fragment.labels !== undefined) {
      next.labels = fragment.labels;
    }
    if (Array.isArray(fragment.overlays) && fragment.overlays.length > 0) {
      next.overlays = [...(next.overlays ?? []), ...fragment.overlays];
    }
    return next;
  };

  const resolveFragment = (part, context) => {
    if (!part) {
      return undefined;
    }
    return typeof part === "function" ? part(context) : part;
  };

  return {
    composeNode(context, ...parts) {
      let merged;
      for (const part of parts) {
        merged = mergeRenderOutput(merged, resolveFragment(part, context));
      }
      return merged;
    },
    composeEdge(context, ...parts) {
      let merged;
      for (const part of parts) {
        merged = mergeRenderOutput(merged, resolveFragment(part, context));
      }
      return merged;
    },
    node: {
      selectedRing(options = {}) {
        return ({ selected, defaults }) => {
          if (!selected) {
            return undefined;
          }
          return {
            overlays: [
              {
                kind: "ring",
                radius: options.radius ?? defaults.nodeSize + 5,
                stroke: options.stroke ?? "#ffe082",
                strokeWidth: options.strokeWidth ?? defaults.strokeWidth + 1,
                fill: options.fill,
                fillOpacity: options.fillOpacity,
                className: options.className,
              },
            ],
          };
        };
      },
      exportText(options = {}) {
        return ({ node, defaults }) => {
          const label = options.label ?? "export";
          const value = node.labels[label];
          if (value === undefined || value === null) {
            return undefined;
          }
          const text =
            typeof options.format === "function"
              ? options.format(value, node)
              : typeof value === "number"
                ? value.toFixed(options.digits ?? 1)
                : String(value);
          return {
            overlays: [
              {
                kind: "text",
                text,
                x: options.x,
                y: options.y ?? -(defaults.nodeSize + defaults.fontSize + 4),
                fill: options.fill ?? "#ffe082",
                fontSize: options.fontSize ?? Math.max(10, defaults.fontSize - 1),
                className: options.className,
                anchor: options.anchor,
              },
            ],
          };
        };
      },
      sensorDot(sensor, options = {}) {
        return ({ node, defaults }) => {
          if (node.labels[sensor] !== true) {
            return undefined;
          }
          return {
            overlays: [
              {
                kind: "dot",
                x: options.x ?? defaults.nodeSize * 0.8,
                y: options.y ?? -defaults.nodeSize * 0.8,
                radius: options.radius ?? 3.4,
                fill: options.fill ?? sensorDotColors[sensor] ?? "#7db5ff",
                fillOpacity: options.fillOpacity,
                stroke: options.stroke,
                strokeWidth: options.strokeWidth,
                className: options.className,
              },
            ],
          };
        };
      },
      matrix() {
        return () => ({ renderMatrix: true });
      },
      booleans() {
        return () => ({ renderBooleans: true });
      },
      gradient() {
        return () => ({ renderGradient: true });
      },
      exportEffect() {
        return () => ({ renderExportEffect: true });
      },
      velocityArrow(options = {}) {
        return ({ node }) => {
          const vx = typeof node.labels.vx === "number" ? node.labels.vx : 0;
          const vy = typeof node.labels.vy === "number" ? node.labels.vy : 0;
          if (vx === 0 && vy === 0) {
            return undefined;
          }
          return {
            overlays: [
              {
                kind: "arrow",
                dx: vx,
                dy: vy,
                length: options.length,
                stroke: options.stroke ?? "#a5d6ff",
                strokeWidth: options.strokeWidth ?? 2.5,
                className: options.className,
              },
            ],
          };
        };
      },
      sizeRange(minInput, maxInput, minOutput, maxOutput, label) {
        return ({ node, defaults }) => {
          const value = node.labels[label ?? "export"];
          const num =
            typeof value === "number"
              ? value
              : typeof value === "string" && value.length > 0
                ? parseFloat(value)
                : NaN;
          if (isNaN(num)) return undefined;
          const t = Math.max(0, Math.min(1, (num - minInput) / (maxInput - minInput)));
          return { nodeSize: minOutput + t * (maxOutput - minOutput) };
        };
      },
    },
    edge: {
      highlightNeighborhood(widthDelta = 0.6, options = {}) {
        return ({ isNeighborhood, defaults }) => {
          if (!isNeighborhood) {
            return undefined;
          }
          return {
            className: options.className ?? "graph-edge is-neighborhood",
            stroke: options.stroke,
            strokeWidth: options.strokeWidth ?? (defaults.strokeWidth ?? 1.8) + widthDelta,
            strokeOpacity: options.strokeOpacity ?? 1,
          };
        };
      },
      muteNonNeighborhood(opacity = 0.24, options = {}) {
        return ({ isNeighborhood }) => {
          if (isNeighborhood) {
            return undefined;
          }
          return {
            hidden: options.hidden,
            className: options.className ?? "graph-edge is-muted",
            stroke: options.stroke,
            strokeWidth: options.strokeWidth,
            strokeOpacity: options.strokeOpacity ?? opacity,
          };
        };
      },
    },
  };
})();`;

export const defaultRendererDocument = `const dense = graph.nodes.length > 180;

return {
  nodeSize: dense ? 8 : defaults.nodeSize,
  fontSize: dense ? 10 : defaults.fontSize,
  showId: defaults.showId && !dense,
  rendererType: "standard",
  renderNode(context) {
    return RendererKit.composeNode(
      context,
      ...(context.defaults.renderMatrix ? [RendererKit.node.matrix()] : []),
      RendererKit.node.selectedRing(),
      RendererKit.node.exportText(),
      RendererKit.node.sensorDot("source"),
      RendererKit.node.sensorDot("obstacle", { x: -context.defaults.nodeSize * 0.8 }),
    );
  },
  renderEdge(context) {
    return RendererKit.composeEdge(
      context,
      RendererKit.edge.highlightNeighborhood(0.6),
    );
  },
};
`;

export function createDefaultVisualizationState(): VisualizationState {
  return {
    nodeSize: 10,
    fontSize: 12,
    showId: true,
    showNeighborhood: false,
    showExport: true,
    visibleSensors: new Set(),
    renderText: true,
    renderMatrix: true,
    renderBooleans: false,
    renderGradient: false,
    renderExportEffect: false,
  };
}

export function visualizationToRendererDefaults(visualization: VisualizationState): RendererDocumentDefaults {
  return {
    nodeSize: visualization.nodeSize,
    fontSize: visualization.fontSize,
    showId: visualization.showId,
    showNeighborhood: visualization.showNeighborhood,
    showExport: visualization.showExport,
    visibleSensors: Array.from(visualization.visibleSensors),
    renderText: visualization.renderText,
    renderMatrix: visualization.renderMatrix,
    renderBooleans: visualization.renderBooleans,
    renderGradient: visualization.renderGradient,
    renderExportEffect: visualization.renderExportEffect,
  };
}

export function compileRendererDocument(document: string): RendererDocumentEvaluator {
  return new Function(
    "context",
    `"use strict";
const { graph, execution, selectedNodeIds, availableSensors, defaults } = context;
${RENDERER_KIT_SOURCE}
${document}`,
  ) as RendererDocumentEvaluator;
}

export function resolveVisualizationState(
  fallback: VisualizationState,
  output: RendererDocumentOutput | void,
  availableSensors: string[],
): VisualizationState {
  const customRendererActive = Boolean(output?.renderNode || output?.renderEdge);
  const managedBooleanFallback = (value: boolean) => (customRendererActive ? false : value);
  const managedVisibleSensorFallback = customRendererActive ? new Set<string>() : fallback.visibleSensors;
  return {
    nodeSize: readPositiveNumber(output?.nodeSize, fallback.nodeSize),
    fontSize: readPositiveNumber(output?.fontSize, fallback.fontSize),
    showId: readBoolean(output?.showId, fallback.showId),
    showNeighborhood: readBoolean(output?.showNeighborhood, managedBooleanFallback(fallback.showNeighborhood)),
    showExport: readBoolean(output?.showExport, managedBooleanFallback(fallback.showExport)),
    visibleSensors: resolveVisibleSensors(output?.visibleSensors, managedVisibleSensorFallback, availableSensors),
    renderText: readBoolean(output?.renderText, managedBooleanFallback(fallback.renderText)),
    renderMatrix: readBoolean(output?.renderMatrix, managedBooleanFallback(fallback.renderMatrix)),
    renderBooleans: readBoolean(output?.renderBooleans, managedBooleanFallback(fallback.renderBooleans)),
    renderGradient: readBoolean(output?.renderGradient, managedBooleanFallback(fallback.renderGradient)),
    renderExportEffect: readBoolean(output?.renderExportEffect, managedBooleanFallback(fallback.renderExportEffect)),
  };
}

export function summarizeActiveRenderers(visualization: VisualizationState): string {
  const active = [] as string[];
  if (visualization.renderText) {
    active.push("text");
  }
  if (visualization.renderMatrix) {
    active.push("matrix");
  }
  if (visualization.renderBooleans) {
    active.push("boolean");
  }
  if (visualization.renderGradient) {
    active.push("gradient");
  }
  if (visualization.renderExportEffect) {
    active.push("effect");
  }
  return active.length > 0 ? active.join(", ") : "none";
}

export function normalizeNodeRenderLabels(labels: NodeRenderOutput["labels"], fallback: string[]): string[] {
  if (typeof labels === "string") {
    return labels.length > 0 ? [labels] : [];
  }
  if (Array.isArray(labels)) {
    return labels.filter((label): label is string => typeof label === "string" && label.length > 0);
  }
  return fallback;
}

export function normalizeNodeRenderOverlays(
  overlays: NodeRenderOutput["overlays"],
  fallback: NodeRenderOverlay[],
): NodeRenderOverlay[] {
  if (!Array.isArray(overlays)) {
    return fallback;
  }
  return overlays.filter(isNodeRenderOverlay);
}

function isNodeRenderOverlay(value: unknown): value is NodeRenderOverlay {
  if (!value || typeof value !== "object" || !("kind" in value)) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "text") {
    return typeof (value as { text?: unknown }).text === "string" && typeof (value as { y?: unknown }).y === "number";
  }
  if (kind === "ring") {
    return true;
  }
  if (kind === "dot") {
    return typeof (value as { x?: unknown }).x === "number" && typeof (value as { y?: unknown }).y === "number";
  }
  if (kind === "arrow") {
    return typeof (value as { dx?: unknown }).dx === "number" && typeof (value as { dy?: unknown }).dy === "number";
  }
  return false;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function resolveVisibleSensors(
  value: RendererDocumentOutput["visibleSensors"],
  fallback: Set<string>,
  availableSensors: string[],
): Set<string> {
  const allowed = new Set(availableSensors);
  if (value === "all") {
    return new Set(availableSensors);
  }
  if (Array.isArray(value)) {
    return new Set(value.filter((sensor): sensor is string => typeof sensor === "string" && allowed.has(sensor)));
  }
  return new Set([...fallback].filter((sensor) => allowed.has(sensor)));
}