import type { GraphNode, Vec2 } from "../domain/contracts";

export type GraphProjection = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  padding: number;
  width: number;
  height: number;
};

export type GraphViewportSize = {
  width: number;
  height: number;
};

export type GraphViewportState = {
  projection: GraphProjection;
  pan: Vec2;
  padding: number;
};

type ResolveGraphViewportOptions = {
  clampPan?: boolean;
  projectionPaddingRatio?: number;
  visibleMarginRatio?: number;
};

export function resolveGraphViewport(
  nodes: GraphNode[],
  viewport: GraphViewportSize,
  desiredPadding: number,
  pan: Vec2,
  options: ResolveGraphViewportOptions = {},
): GraphViewportState {
  const minViewportEdge = Math.min(viewport.width, viewport.height);
  const projectionPadding = Math.max(
    desiredPadding,
    minViewportEdge * (options.projectionPaddingRatio ?? 0.1),
  );
  const projection = computeProjection(nodes, viewport.width, viewport.height, projectionPadding);
  if (!options.clampPan || nodes.length === 0) {
    return { projection, pan, padding: projectionPadding };
  }
  const visibleMargin = Math.max(18, minViewportEdge * (options.visibleMarginRatio ?? 0.03));
  return {
    projection,
    pan: clampPanToViewport(nodes, projection, pan, visibleMargin),
    padding: projectionPadding,
  };
}

export function computeProjection(nodes: GraphNode[], width: number, height: number, padding: number): GraphProjection {
  // A single pass, deliberately not `Math.min(...nodes.map(...))`: that allocated two arrays
  // per call and passed one argument per node, which throws outright on large networks.
  // The empty case still yields the same +/-Infinity bounds the spread form produced.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const { x, y } = node.position;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const worldWidth = Math.max(maxX - minX, 1);
  const worldHeight = Math.max(maxY - minY, 1);
  const availableWidth = Math.max(width - padding * 2, 1);
  const availableHeight = Math.max(height - padding * 2, 1);
  const scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
  const contentWidth = worldWidth * scale;
  const contentHeight = worldHeight * scale;
  return {
    minX,
    minY,
    maxX,
    maxY,
    offsetX: (width - contentWidth) / 2,
    offsetY: (height - contentHeight) / 2,
    scaleX: scale,
    scaleY: scale,
    padding,
    width,
    height,
  };
}

export function projectPoint(point: Vec2, projection: GraphProjection): Vec2 {
  return {
    x: projection.offsetX + (point.x - projection.minX) * projection.scaleX,
    y: projection.offsetY + (point.y - projection.minY) * projection.scaleY,
  };
}

export function interpolateGraphViewport(
  from: GraphViewportState,
  to: GraphViewportState,
  factor: number,
): GraphViewportState {
  return {
    projection: {
      ...from.projection,
      minX: interpolateNumber(from.projection.minX, to.projection.minX, factor),
      minY: interpolateNumber(from.projection.minY, to.projection.minY, factor),
      maxX: interpolateNumber(from.projection.maxX, to.projection.maxX, factor),
      maxY: interpolateNumber(from.projection.maxY, to.projection.maxY, factor),
      offsetX: interpolateNumber(from.projection.offsetX, to.projection.offsetX, factor),
      offsetY: interpolateNumber(from.projection.offsetY, to.projection.offsetY, factor),
      scaleX: interpolateNumber(from.projection.scaleX, to.projection.scaleX, factor),
      scaleY: interpolateNumber(from.projection.scaleY, to.projection.scaleY, factor),
      padding: interpolateNumber(from.projection.padding, to.projection.padding, factor),
      width: to.projection.width,
      height: to.projection.height,
    },
    pan: {
      x: interpolateNumber(from.pan.x, to.pan.x, factor),
      y: interpolateNumber(from.pan.y, to.pan.y, factor),
    },
    padding: interpolateNumber(from.padding, to.padding, factor),
  };
}

export function graphViewportDistance(a: GraphViewportState, b: GraphViewportState): number {
  return Math.max(
    Math.abs(a.projection.scaleX - b.projection.scaleX),
    Math.abs(a.projection.offsetX - b.projection.offsetX),
    Math.abs(a.projection.offsetY - b.projection.offsetY),
    Math.abs(a.projection.minX - b.projection.minX),
    Math.abs(a.projection.minY - b.projection.minY),
    Math.abs(a.pan.x - b.pan.x),
    Math.abs(a.pan.y - b.pan.y),
  );
}

function interpolateNumber(from: number, to: number, factor: number): number {
  return from + (to - from) * factor;
}

function clampPanToViewport(nodes: GraphNode[], projection: GraphProjection, pan: Vec2, visibleMargin: number): Vec2 {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const point = projectPoint(node.position, projection);
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const panX = clampWithinBounds(pan.x, visibleMargin - minX, projection.width - visibleMargin - maxX);
  const panY = clampWithinBounds(pan.y, visibleMargin - minY, projection.height - visibleMargin - maxY);
  return { x: panX, y: panY };
}

function clampWithinBounds(value: number, lowerBound: number, upperBound: number): number {
  if (lowerBound > upperBound) {
    return (lowerBound + upperBound) / 2;
  }
  return Math.min(Math.max(value, lowerBound), upperBound);
}