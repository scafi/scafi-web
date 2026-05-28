import type { GraphSnapshot, MatrixValue, StandaloneNodeState, StandaloneState } from "../../domain/contracts";

export interface ParseResult {
  graph: GraphSnapshot;
  warnings: string[];
}

const CORE_NODE_KEYS = new Set(["id", "x", "y"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeLabelValue(value: unknown): unknown {
  const matrix = parseMatrix(value);
  if (matrix) {
    return matrix;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeLabelValue);
  }
  return value;
}

function parseMatrix(value: unknown): MatrixValue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const dimension = parseNumber(value.dimension);
  if (dimension === undefined || !Array.isArray(value.pixels)) {
    return undefined;
  }

  const pixels: Record<string, string> = {};
  for (const pixel of value.pixels) {
    if (Array.isArray(pixel) && pixel.length >= 2 && Array.isArray(pixel[0]) && pixel[0].length >= 2) {
      const i = parseNumber(pixel[0][0]);
      const j = parseNumber(pixel[0][1]);
      if (i !== undefined && j !== undefined) {
        pixels[`${i}:${j}`] = String(pixel[1]);
      }
      continue;
    }

    if (isRecord(pixel)) {
      const i = parseNumber(pixel.i);
      const j = parseNumber(pixel.j);
      const color = pixel.color;
      if (i !== undefined && j !== undefined && color !== undefined) {
        pixels[`${i}:${j}`] = String(color);
      }
    }
  }

  return Object.keys(pixels).length > 0 ? { dimension, pixels } : undefined;
}

function parseLabels(node: Record<string, unknown>): Record<string, unknown> {
  const labelsSource = isRecord(node.labels) ? node.labels : node;
  const labels: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(labelsSource)) {
    if (!isRecord(node.labels) && CORE_NODE_KEYS.has(key)) {
      continue;
    }
    if (value !== null && value !== undefined) {
      labels[key] = normalizeLabelValue(value);
    }
  }

  return labels;
}

function parseNode(node: unknown): StandaloneNodeState | undefined {
  if (!isRecord(node)) {
    return undefined;
  }

  const id = node.id;
  const x = parseNumber(node.x);
  const y = parseNumber(node.y);
  if (typeof id !== "string" || x === undefined || y === undefined) {
    return undefined;
  }

  return {
    id,
    x,
    y,
    labels: parseLabels(node),
  };
}

function parseEdge(edge: unknown): { from: string; to: string } | undefined {
  if (Array.isArray(edge) && edge.length >= 2) {
    return { from: String(edge[0]), to: String(edge[1]) };
  }
  if (isRecord(edge) && typeof edge.from === "string" && typeof edge.to === "string") {
    return { from: edge.from, to: edge.to };
  }
  return undefined;
}

export class StandaloneStateAdapter {
  toGraph(state: unknown): ParseResult | undefined {
    if (!isRecord(state)) {
      return undefined;
    }

    if (state.compact === true) {
      const rawNodes = Array.isArray(state.nodes) ? state.nodes : [];
      const nodes: Array<{ id: string; position: { x: number; y: number }; labels: Record<string, unknown> }> = [];
      const knownIds = new Set<string>();
      const warnings: string[] = [];

      for (const n of rawNodes) {
        if (!Array.isArray(n) || n.length < 3) {
          continue;
        }
        const id = String(n[0]);
        const x = parseNumber(n[1]);
        const y = parseNumber(n[2]);
        if (x === undefined || y === undefined) {
          continue;
        }
        const labels = (n.length >= 4 && isRecord(n[3])) ? parseLabels({ labels: n[3] }) : {};
        nodes.push({ id, position: { x, y }, labels });
        knownIds.add(id);
      }

      if (nodes.length !== rawNodes.length) {
        warnings.push(`Dropped ${rawNodes.length - nodes.length} malformed standalone nodes`);
      }

      const rawEdges = Array.isArray(state.edges) ? state.edges : [];
      const edges: Array<{ from: string; to: string }> = [];

      for (let i = 0; i < rawEdges.length; i += 2) {
        if (i + 1 >= rawEdges.length) {
          break;
        }
        const from = String(rawEdges[i]);
        const to = String(rawEdges[i + 1]);
        if (knownIds.has(from) && knownIds.has(to)) {
          edges.push({ from, to });
        } else {
          warnings.push(`Dropping standalone edge ${from} -> ${to} because at least one node is missing`);
        }
      }

      return {
        graph: {
          nodes,
          edges,
        },
        warnings,
      };
    }

    const rawNodes = Array.isArray(state.nodes) ? state.nodes : [];
    const nodes = rawNodes.map(parseNode).filter((node): node is StandaloneNodeState => node !== undefined);
    const knownIds = new Set(nodes.map((node) => node.id));
    const rawEdges = Array.isArray(state.edges) ? state.edges : [];
    const warnings: string[] = [];

    if (nodes.length !== rawNodes.length) {
      warnings.push(`Dropped ${rawNodes.length - nodes.length} malformed standalone nodes`);
    }

    const edges = rawEdges
      .map(parseEdge)
      .filter((edge): edge is { from: string; to: string } => edge !== undefined)
      .filter((edge) => {
        const valid = knownIds.has(edge.from) && knownIds.has(edge.to);
        if (!valid) {
          warnings.push(
            `Dropping standalone edge ${edge.from} -> ${edge.to} because at least one node is missing`,
          );
        }
        return valid;
      });

    return {
      graph: {
        nodes: nodes.map((node) => ({
          id: node.id,
          position: { x: node.x, y: node.y },
          labels: node.labels ?? {},
        })),
        edges,
      },
      warnings,
    };
  }
}