import { Application, Graphics, Container, Text, TextStyle } from "pixi.js";
import type { Vec2, GraphNode } from "../../domain/contracts";
import type { AppState } from "../../state/app-store";
import type { SimulationRenderer, SimulationRendererCallbacks } from "./simulation-renderer";
import type { VisualizationState } from "../renderer-document";
import {
  resolveGraphViewport,
  projectPoint,
  interpolateGraphViewport,
  graphViewportDistance,
  type GraphProjection,
  type GraphViewportState,
  type GraphViewportSize,
} from "../graph-viewport";

type DragState = {
  nodeIds: string[];
  startClientX: number;
  startClientY: number;
  originalPositions: Record<string, Vec2>;
};

type ViewportDragState = {
  startClientX: number;
  startClientY: number;
  originalPan: Vec2;
};

type SelectionBoxState = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  additive: boolean;
};

export class PixiSimulationRenderer implements SimulationRenderer {
  private parent?: HTMLElement;
  private container?: HTMLDivElement;
  private app?: Application;
  private callbacks: SimulationRendererCallbacks = {};

  private graphViewportSize: GraphViewportSize = { width: 860, height: 520 };
  private graphPan: Vec2 = { x: 0, y: 0 };
  private graphProjection?: GraphProjection;
  private graphInteractionMode: "pan" | "selection" = "pan";
  private selectedNodeIds: string[] = [];

  private dragState?: DragState;
  private viewportDragState?: ViewportDragState;
  private selectionBoxState?: SelectionBoxState;

  private renderedGraphViewport?: GraphViewportState;
  private targetGraphViewport?: GraphViewportState;
  private graphViewportAnimationFrame?: number;

  private activeState?: AppState;
  private visualization?: VisualizationState;

  // Pixi elements
  private graphics?: Graphics;
  private textContainer?: Container;
  private textPool: Text[] = [];
  private textPoolUsed = 0;
  private textStyle?: TextStyle;

  private isInitialized = false;
  private isDestroyed = false;

  private cachedTheme?: string;
  private cachedAccentColor = 0xbb66ff;
  private cachedAccentCoolColor = 0x39f3ff;

  constructor() {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  async mount(parent: HTMLElement): Promise<void> {
    this.isDestroyed = false;
    this.parent = parent;

    if (this.container) {
      parent.appendChild(this.container);
      this.updateSize();
      return;
    }

    this.container = document.createElement("div");
    this.container.className = "graph-workspace-container pixi-renderer";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.position = "relative";
    parent.appendChild(this.container);

    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(Math.round(bounds.width) - 2, 1);
    const height = Math.max(Math.round(bounds.height) - 2, 1);
    this.graphViewportSize = { width, height };

    const app = new Application();
    
    try {
      // In PixiJS v8, initialization is async and uses the init() method.
      await app.init({
        width,
        height,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        backgroundAlpha: 0, // Translucent to show the lovely CSS aurora gradient underneath!
      });

      if (this.isDestroyed) {
        this.safeDestroyApp(app);
        return;
      }

      this.app = app;

      const canvas = this.app.canvas;
      canvas.className = "graph-canvas";
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.borderRadius = "14px";
      canvas.style.border = "1px solid var(--line)";
      this.container.appendChild(canvas);

      // Main drawing containers
      this.graphics = new Graphics();
      this.app.stage.addChild(this.graphics);

      this.textContainer = new Container();
      this.app.stage.addChild(this.textContainer);

      this.textStyle = new TextStyle({
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        fontSize: 12,
        fontWeight: "500",
        fill: "#b0b6bd",
        align: "center",
      });

      // Attach local pointer event listeners for dragging, panning, clicking, and selections
      this.container.addEventListener("pointerdown", (e) => this.onPointerDown(e));
      window.addEventListener("pointermove", this.onPointerMove);
      window.addEventListener("pointerup", this.onPointerUp);

      this.isInitialized = true;
      this.updateSize();

      if (this.activeState) {
        this.render();
      }
    } catch (err) {
      console.error("Failed to initialize PixiJS application:", err);
    }
  }

  setCallbacks(callbacks: SimulationRendererCallbacks): void {
    this.callbacks = callbacks;
  }

  getGraphPan(): Vec2 {
    return this.graphPan;
  }

  setGraphPan(pan: Vec2): void {
    this.graphPan = pan;
    this.renderedGraphViewport = undefined;
    this.targetGraphViewport = undefined;
  }

  updateSize(): boolean {
    if (!this.container || !this.app) {
      return false;
    }
    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(Math.round(bounds.width) - 2, 1);
    const height = Math.max(Math.round(bounds.height) - 2, 1);
    if (width === this.graphViewportSize.width && height === this.graphViewportSize.height) {
      return false;
    }
    this.graphViewportSize = { width, height };

    this.app.renderer.resize(width, height);

    this.renderedGraphViewport = undefined;
    this.targetGraphViewport = undefined;
    this.cancelGraphViewportAnimation();
    
    if (this.isInitialized && this.activeState) {
      this.render();
    }
    return true;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.cancelGraphViewportAnimation();
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    
    if (this.app) {
      this.safeDestroyApp(this.app);
      this.app = undefined;
    }

    if (this.container && this.parent) {
      this.container.remove();
    }
    this.textPool = [];
    this.isInitialized = false;
  }

  private safeDestroyApp(app: any): void {
    if (!app) return;
    if (typeof app._cancelResize !== "function") {
      app._cancelResize = () => {};
    }
    try {
      if (app.ticker) {
        app.ticker.stop();
      }
    } catch (e) {}
    try {
      if (app.renderer) {
        app.destroy(true, { children: true });
      } else {
        if (app.stage) {
          app.stage.destroy({ children: true });
        }
      }
    } catch (e) {
      console.warn("Error in safeDestroyApp:", e);
    }
  }

  update(
    state: AppState,
    selectedNodeIds: string[],
    interactionMode: "pan" | "selection",
    graphPan: Vec2,
    visualization: VisualizationState,
  ): void {
    this.activeState = state;
    this.selectedNodeIds = selectedNodeIds;
    this.graphInteractionMode = interactionMode;
    this.graphPan = graphPan;
    this.visualization = visualization;

    if (!this.isInitialized) {
      return;
    }

    this.render();
  }

  private render(): void {
    if (!this.app || !this.graphics || !this.visualization || !this.activeState) {
      return;
    }

    if (this.app.canvas) {
      if (this.graphInteractionMode === "pan") {
        this.app.canvas.style.cursor = this.viewportDragState ? "grabbing" : "grab";
      } else {
        this.app.canvas.style.cursor = "default";
      }
    }

    this.draw();
    this.scheduleGraphViewportAnimation();
  }

  private draw(): void {
    if (!this.app || !this.graphics || !this.visualization || !this.activeState) {
      return;
    }

    const state = this.activeState;
    const graph = state.graph;
    const nodeSize = this.visualization.nodeSize;
    const isLightTheme = document.documentElement.getAttribute("data-theme") === "light";

    // Update styling for labels only if changed
    const targetFill = isLightTheme ? "#333333" : "#b0b6bd";
    const targetFontSize = this.visualization.fontSize || 12;
    if (this.textStyle) {
      if (this.textStyle.fill !== targetFill || this.textStyle.fontSize !== targetFontSize) {
        this.textStyle.fill = targetFill;
        this.textStyle.fontSize = targetFontSize;
      }
    }

    // Resolve projection & active anim viewport
    const viewport = this.resolveGraphViewportState(graph.nodes);
    const projection = viewport.projection;

    // Reset rendering states
    this.graphics.clear();
    this.resetTextPool();

    // 1. Draw Edges (Links)
    if (this.visualization.showLinks !== false && graph.edges.length > 0) {
      const showNeighborhood = this.visualization.showNeighborhood && this.selectedNodeIds.length > 0;
      const lineColor = isLightTheme ? 0xd0d5e3 : 0x222436; // WebGL uses numeric hex representation
      const lineOpacity = isLightTheme ? 0.6 : 0.45;
      
      this.graphics.beginPath();
      for (const edge of graph.edges) {
        const fromNode = graph.nodes.find((n) => n.id === edge.from);
        const toNode = graph.nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) continue;

        const isMuted = showNeighborhood && !this.selectedNodeIds.includes(edge.from) && !this.selectedNodeIds.includes(edge.to);
        if (isMuted) continue;

        const p1 = projectPoint(fromNode.position, projection);
        const p2 = projectPoint(toNode.position, projection);

        const x1 = p1.x + this.graphPan.x;
        const y1 = p1.y + this.graphPan.y;
        const x2 = p2.x + this.graphPan.x;
        const y2 = p2.y + this.graphPan.y;

        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
      }
      this.graphics.stroke({ width: 1.5, color: lineColor, alpha: lineOpacity });
    }

    // Prepare Node gradient calculation ranges if enabled
    const exportRange = this.visualization.renderGradient ? getExportRange(graph.nodes) : undefined;

    // Pre-resolve CSS theme variable colors once per frame to prevent layout thrashing
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    if (this.cachedTheme !== theme) {
      this.cachedTheme = theme;
      const rootStyle = getComputedStyle(document.documentElement);
      const accentHex = rootStyle.getPropertyValue("--accent").trim();
      this.cachedAccentColor = hexToNumber(accentHex) || 0xbb66ff;
      const accentCoolHex = rootStyle.getPropertyValue("--accent-cool").trim();
      this.cachedAccentCoolColor = hexToNumber(accentCoolHex) || 0x39f3ff;
    }
    const accentColor = this.cachedAccentColor;
    const accentCoolColor = this.cachedAccentCoolColor;

    // 2. Draw Nodes
    for (const node of graph.nodes) {
      const point = projectPoint(node.position, projection);
      const px = point.x + this.graphPan.x;
      const py = point.y + this.graphPan.y;
      const selected = this.selectedNodeIds.includes(node.id);

      // Resolve filled color code
      let fillColor = selected ? accentColor : accentCoolColor;
      if (this.visualization.renderGradient) {
        const num = resolveExportNumber(node.labels.export);
        if (num !== undefined) {
          fillColor = gradientColorHex(num, exportRange?.min, exportRange?.max);
        }
      }

      const ledColor = node.labels.ledAll;
      if (ledColor !== undefined && ledColor !== null && ledColor !== "") {
        fillColor = hexToNumber(String(ledColor)) || (selected ? accentColor : accentCoolColor);
      }

      let fillOpacity = 1;
      let strokeColor = 0;
      let strokeWidth = 0;
      if (this.visualization.renderExportEffect && typeof node.labels.export === "boolean") {
        fillOpacity = node.labels.export ? 0.92 : 0.3;
        strokeColor = node.labels.export ? 0x00ffff : 0;
        strokeWidth = node.labels.export ? 2 : 0;
      }

      // Draw Selection Outline Rings
      if (selected) {
        this.graphics.circle(px, py, nodeSize + 3);
        this.graphics.stroke({ width: 1.5, color: accentColor });
      }

      // Draw Node solid circular fill
      this.graphics.circle(px, py, nodeSize);
      this.graphics.fill({ color: fillColor, alpha: fillOpacity });

      // Draw export border highlights
      if (strokeWidth > 0 && strokeColor) {
        this.graphics.circle(px, py, nodeSize);
        this.graphics.stroke({ width: strokeWidth, color: strokeColor });
      }

      // 3. Draw Labels (Texts)
      const showLabel = this.visualization.showId || (this.visualization.showExport && node.labels.export !== undefined);
      if (showLabel) {
        const parts: string[] = [];
        if (this.visualization.showId) parts.push(node.id);
        if (this.visualization.showExport && node.labels.export !== undefined) {
          const val = node.labels.export;
          parts.push(typeof val === "number" ? val.toFixed(1) : String(val));
        }
        const labelText = parts.join("·");

        const text = this.acquireText(labelText);
        text.position.set(px, py + nodeSize + 4);
      }
    }

    // 4. Draw selection drag box
    if (this.selectionBoxState) {
      const rect = this.currentSelectionRect();
      if (rect) {
        const strokeColor = isLightTheme ? 0x4a90d9 : 0x7db5ff;
        const fillColor = isLightTheme ? 0x4a90d9 : 0x7db5ff;
        
        this.graphics.rect(rect.x, rect.y, rect.width, rect.height);
        this.graphics.fill({ color: fillColor, alpha: 0.08 });
        this.graphics.stroke({ width: 1, color: strokeColor, alpha: 0.8 });
      }
    }

    this.hideUnusedTexts();
  }

  // Text Pooling helpers to avoid costly text instantiation garbage collection sweeps
  private resetTextPool(): void {
    this.textPoolUsed = 0;
  }

  private acquireText(content: string): Text {
    if (!this.textContainer) {
      throw new Error("Text container not ready");
    }
    let textNode: Text;
    if (this.textPoolUsed < this.textPool.length) {
      textNode = this.textPool[this.textPoolUsed];
      if (textNode.text !== content) {
        textNode.text = content;
      }
      textNode.visible = true;
    } else {
      textNode = new Text({ text: content, style: this.textStyle });
      textNode.anchor.set(0.5, 0); // Center text horizontally, top-align vertically
      this.textContainer.addChild(textNode);
      this.textPool.push(textNode);
    }
    this.textPoolUsed++;
    return textNode;
  }

  private hideUnusedTexts(): void {
    for (let i = this.textPoolUsed; i < this.textPool.length; i++) {
      this.textPool[i].visible = false;
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.container || !this.activeState || !this.graphProjection) return;
    const clientRect = this.container.getBoundingClientRect();
    const x = e.clientX - clientRect.left;
    const y = e.clientY - clientRect.top;

    const clickedNode = this.findNodeAtPosition(x, y);

    if (clickedNode) {
      if (this.graphInteractionMode !== "selection") return;
      e.stopPropagation();
      let dragNodeIds = [clickedNode.id];
      if (this.selectedNodeIds.includes(clickedNode.id)) {
        dragNodeIds = [...this.selectedNodeIds];
      }

      const originalPositions: Record<string, Vec2> = {};
      for (const id of dragNodeIds) {
        const node = this.activeState.graph.nodes.find((n) => n.id === id);
        if (node) {
          originalPositions[id] = { ...node.position };
        }
      }

      this.dragState = {
        nodeIds: dragNodeIds,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originalPositions,
      };
      
      this.callbacks.onNodeClick?.(clickedNode.id, e.shiftKey);
      this.container.setPointerCapture(e.pointerId);
      this.draw();
    } else {
      if (this.graphInteractionMode === "pan") {
        this.viewportDragState = {
          startClientX: e.clientX,
          startClientY: e.clientY,
          originalPan: { ...this.graphPan },
        };
        this.container.setPointerCapture(e.pointerId);
      } else {
        this.selectionBoxState = {
          startClientX: e.clientX,
          startClientY: e.clientY,
          currentClientX: e.clientX,
          currentClientY: e.clientY,
          additive: e.shiftKey,
        };
        this.container.setPointerCapture(e.pointerId);
        this.draw();
      }
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isInitialized || !this.container) return;

    if (this.selectionBoxState) {
      this.selectionBoxState.currentClientX = e.clientX;
      this.selectionBoxState.currentClientY = e.clientY;
      this.draw();
      return;
    }

    if (this.dragState && this.graphProjection) {
      const dx = (e.clientX - this.dragState.startClientX) / this.graphProjection.scaleX;
      const dy = (e.clientY - this.dragState.startClientY) / this.graphProjection.scaleY;

      const movedPositions: Record<string, Vec2> = {};
      for (const id of this.dragState.nodeIds) {
        const original = this.dragState.originalPositions[id];
        if (original) {
          movedPositions[id] = {
            x: original.x + dx,
            y: original.y + dy,
          };
        }
      }
      this.callbacks.onNodesDragged?.(movedPositions);
      return;
    }

    if (this.viewportDragState) {
      const dx = e.clientX - this.viewportDragState.startClientX;
      const dy = e.clientY - this.viewportDragState.startClientY;
      const newPan = {
        x: this.viewportDragState.originalPan.x + dx,
        y: this.viewportDragState.originalPan.y + dy,
      };
      this.callbacks.onViewportPanned?.(newPan);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.container) return;
    this.container.releasePointerCapture(e.pointerId);

    if (this.selectionBoxState) {
      const rect = this.currentSelectionRect();
      this.selectionBoxState = undefined;

      if (rect && this.activeState && this.graphProjection) {
        const selectedIds: string[] = [];
        for (const node of this.activeState.graph.nodes) {
          const pt = projectPoint(node.position, this.graphProjection);
          const px = pt.x + this.graphPan.x;
          const py = pt.y + this.graphPan.y;

          if (
            px >= rect.x &&
            px <= rect.x + rect.width &&
            py >= rect.y &&
            py <= rect.y + rect.height
          ) {
            selectedIds.push(node.id);
          }
        }
        this.callbacks.onSelectionApplied?.(selectedIds);
      } else {
        this.callbacks.onSelectionCleared?.();
      }
      this.draw();
      return;
    }

    if (this.dragState) {
      this.dragState = undefined;
    }

    if (this.viewportDragState) {
      this.viewportDragState = undefined;
    }
  }

  private findNodeAtPosition(x: number, y: number): GraphNode | undefined {
    if (!this.activeState || !this.graphProjection || !this.visualization) return undefined;
    const nodeSize = this.visualization.nodeSize;
    const clickTolerance = Math.max(nodeSize, 12);

    for (const node of this.activeState.graph.nodes) {
      const pt = projectPoint(node.position, this.graphProjection);
      const px = pt.x + this.graphPan.x;
      const py = pt.y + this.graphPan.y;

      const dist = Math.hypot(x - px, y - py);
      if (dist <= clickTolerance) {
        return node;
      }
    }
    return undefined;
  }

  private currentSelectionRect(): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.selectionBoxState || !this.container) return undefined;
    const clientRect = this.container.getBoundingClientRect();
    const x1 = this.selectionBoxState.startClientX - clientRect.left;
    const y1 = this.selectionBoxState.startClientY - clientRect.top;
    const x2 = this.selectionBoxState.currentClientX - clientRect.left;
    const y2 = this.selectionBoxState.currentClientY - clientRect.top;

    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x1 - x2);
    const height = Math.abs(y1 - y2);

    if (width < 3 || height < 3) return undefined;
    return { x, y, width, height };
  }

  private resolveGraphViewportState(nodes: GraphNode[]): GraphViewportState {
    const labelPadding = this.visualization!.nodeSize * 2;
    const targetViewport = resolveGraphViewport(nodes, this.graphViewportSize, labelPadding, this.graphPan, {
      clampPan: this.graphInteractionMode !== "pan" || Boolean(this.dragState),
    });
    const viewport = this.resolveRenderedGraphViewport(targetViewport);
    this.graphProjection = viewport.projection;
    this.graphPan = viewport.pan;
    return viewport;
  }

  private resolveRenderedGraphViewport(targetViewport: GraphViewportState): GraphViewportState {
    this.targetGraphViewport = targetViewport;
    if (
      !this.renderedGraphViewport ||
      this.viewportDragState ||
      this.selectionBoxState ||
      this.renderedGraphViewport.projection.width !== targetViewport.projection.width ||
      this.renderedGraphViewport.projection.height !== targetViewport.projection.height
    ) {
      this.cancelGraphViewportAnimation();
      this.renderedGraphViewport = targetViewport;
      return targetViewport;
    }
    if (!this.shouldAnimateGraphViewport(targetViewport)) {
      this.cancelGraphViewportAnimation();
      this.renderedGraphViewport = targetViewport;
      return targetViewport;
    }
    return this.renderedGraphViewport;
  }

  private shouldAnimateGraphViewport(targetViewport: GraphViewportState): boolean {
    const currentViewport = this.renderedGraphViewport;
    if (!currentViewport) return false;
    return graphViewportDistance(currentViewport, targetViewport) > 0.6;
  }

  private scheduleGraphViewportAnimation(): void {
    if (!this.renderedGraphViewport || !this.targetGraphViewport) return;
    if (!this.shouldAnimateGraphViewport(this.targetGraphViewport)) {
      this.cancelGraphViewportAnimation();
      this.renderedGraphViewport = this.targetGraphViewport;
      this.graphProjection = this.targetGraphViewport.projection;
      this.graphPan = this.targetGraphViewport.pan;
      return;
    }
    if (this.graphViewportAnimationFrame !== undefined || this.viewportDragState || this.selectionBoxState) {
      return;
    }
    const step = () => {
      this.graphViewportAnimationFrame = undefined;
      if (!this.renderedGraphViewport || !this.targetGraphViewport) return;
      const nextViewport = interpolateGraphViewport(this.renderedGraphViewport, this.targetGraphViewport, 0.22);
      const settledViewport =
        graphViewportDistance(nextViewport, this.targetGraphViewport) <= 0.6 ? this.targetGraphViewport : nextViewport;
      this.renderedGraphViewport = settledViewport;
      this.graphProjection = settledViewport.projection;
      this.graphPan = settledViewport.pan;

      this.draw();

      if (settledViewport !== this.targetGraphViewport) {
        this.graphViewportAnimationFrame = window.requestAnimationFrame(step);
      }
    };
    this.graphViewportAnimationFrame = window.requestAnimationFrame(step);
  }

  private cancelGraphViewportAnimation(): void {
    if (this.graphViewportAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.graphViewportAnimationFrame);
      this.graphViewportAnimationFrame = undefined;
    }
  }
}

// Inline lightweight helpers
function resolveExportNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getExportRange(nodes: GraphNode[]): { min: number; max: number } | undefined {
  let min = Infinity;
  let max = -Infinity;
  let found = false;
  for (const node of nodes) {
    if (node.labels.export !== undefined) {
      const num = resolveExportNumber(node.labels.export);
      if (num !== undefined) {
        if (num < min) min = num;
        if (num > max) max = num;
        found = true;
      }
    }
  }
  return found ? { min, max } : undefined;
}

function gradientColor(value: number, min?: number, max?: number): string {
  if (!Number.isFinite(value)) return "#7db5ff";
  if (min === undefined || max === undefined) {
    const hue = (((value % 1920) + 1920) % 1920) / 1920;
    return `hsl(${Math.round(hue * 360)} 70% 58%)`;
  }
  const range = max - min;
  const t = range <= 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
  const hue = (1 - t) * 240;
  return `hsl(${Math.round(hue)} 70% 58%)`;
}

function gradientColorHex(value: number, min?: number, max?: number): number {
  if (!Number.isFinite(value)) return 0x7db5ff;
  
  let hue = 240; // Default
  if (min === undefined || max === undefined) {
    const norm = (((value % 1920) + 1920) % 1920) / 1920;
    hue = Math.round(norm * 360);
  } else {
    const range = max - min;
    const t = range <= 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
    hue = Math.round((1 - t) * 240);
  }
  
  return hslToHex(hue, 70, 58);
}

function hslToHex(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));
  return (r << 16) + (g << 8) + b;
}

function hexToNumber(hex: string): number | null {
  if (!hex) return null;
  let cleanHex = hex.trim().toLowerCase();
  
  // Handled named CSS colors or variables if they fall through
  if (cleanHex === "red") return 0xff0000;
  if (cleanHex === "blue") return 0x0000ff;
  if (cleanHex === "green") return 0x00ff00;
  if (cleanHex === "black") return 0x000000;
  if (cleanHex === "white") return 0xffffff;

  // Handle rgb() or hsl() string formats by falling back, or direct Hex patterns
  if (cleanHex.startsWith("#")) {
    cleanHex = cleanHex.substring(1);
    if (cleanHex.length === 3) {
      cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
    }
    const val = parseInt(cleanHex, 16);
    return Number.isFinite(val) ? val : null;
  }
  
  if (cleanHex.startsWith("0x")) {
    const val = parseInt(cleanHex.substring(2), 16);
    return Number.isFinite(val) ? val : null;
  }

  return null;
}
