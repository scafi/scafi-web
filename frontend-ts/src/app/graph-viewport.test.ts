import { describe, expect, it } from "vitest";
import { graphViewportDistance, interpolateGraphViewport, projectPoint, resolveGraphViewport } from "./graph-viewport";

describe("resolveGraphViewport", () => {
  const viewport = { width: 800, height: 600 };
  const compactNodes = [
    { id: "1", position: { x: 0, y: 0 }, labels: {} },
    { id: "2", position: { x: 50, y: 40 }, labels: {} },
  ];
  const expandedNodes = [
    { id: "1", position: { x: -240, y: -160 }, labels: {} },
    { id: "2", position: { x: 320, y: 240 }, labels: {} },
  ];

  it("zooms out as node bounds grow", () => {
    const compact = resolveGraphViewport(compactNodes, viewport, 40, { x: 0, y: 0 });
    const expanded = resolveGraphViewport(expandedNodes, viewport, 40, { x: 0, y: 0 });

    expect(expanded.projection.scaleX).toBeLessThan(compact.projection.scaleX);
    expect(expanded.projection.scaleY).toBeLessThan(compact.projection.scaleY);
    expect(compact.projection.scaleX).toBe(compact.projection.scaleY);
    expect(expanded.projection.scaleX).toBe(expanded.projection.scaleY);
  });

  it("preserves world proportions with a centered uniform fit", () => {
    const state = resolveGraphViewport(compactNodes, viewport, 40, { x: 0, y: 0 });
    const points = compactNodes.map((node) => projectPoint(node.position, state.projection));

    expect(points[0]?.y).toBeCloseTo(60, 4);
    expect(points[1]?.y).toBeCloseTo(540, 4);
    expect(points[0]?.x).toBeGreaterThan(60);
  });

  it("clamps large pan offsets back inside the visible stage when requested", () => {
    const state = resolveGraphViewport(compactNodes, viewport, 40, { x: 260, y: -220 }, { clampPan: true });
    const points = compactNodes.map((node) => projectPoint(node.position, state.projection));
    const xs = points.map((point) => point.x + state.pan.x);
    const ys = points.map((point) => point.y + state.pan.y);

    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(viewport.width);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs(state.pan.x)).toBeLessThan(260);
    expect(Math.abs(state.pan.y)).toBeLessThan(220);
  });

  it("preserves pan offsets when clamping is disabled", () => {
    const state = resolveGraphViewport(compactNodes, viewport, 40, { x: 120, y: -90 }, { clampPan: false });

    expect(state.pan).toEqual({ x: 120, y: -90 });
  });

  it("interpolates viewport transitions toward the target", () => {
    const compact = resolveGraphViewport(compactNodes, viewport, 40, { x: 0, y: 0 });
    const expanded = resolveGraphViewport(expandedNodes, viewport, 40, { x: 120, y: -90 });
    const interpolated = interpolateGraphViewport(compact, expanded, 0.25);

    expect(graphViewportDistance(interpolated, expanded)).toBeLessThan(graphViewportDistance(compact, expanded));
    expect(interpolated.projection.scaleX).toBeGreaterThan(expanded.projection.scaleX);
    expect(interpolated.projection.scaleX).toBeLessThan(compact.projection.scaleX);
  });
});