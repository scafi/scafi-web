import type { Vec2, GraphNode, GraphEdge } from "../../domain/contracts";
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

export class LightweightSimulationRenderer implements SimulationRenderer {
  private parent?: HTMLElement;
  private container?: HTMLDivElement;
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

  constructor() {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  mount(parent: HTMLElement): void {
    this.parent = parent;
    this.container = document.createElement("div");
    this.container.className = "graph-workspace-container lightweight-renderer";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.position = "relative";
    parent.appendChild(this.container);

    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.updateSize();
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
    if (!this.container) {
      return false;
    }
    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(Math.round(bounds.width) - 2, 1);
    const height = Math.max(Math.round(bounds.height) - 2, 1);
    if (width === this.graphViewportSize.width && height === this.graphViewportSize.height) {
      return false;
    }
    this.graphViewportSize = { width, height };
    this.renderedGraphViewport = undefined;
    this.targetGraphViewport = undefined;
    this.cancelGraphViewportAnimation();
    return true;
  }

  destroy(): void {
    this.cancelGraphViewportAnimation();
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    if (this.container && this.parent) {
      this.container.remove();
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

    this.render();
  }

  private render(): void {
    if (!this.container || !this.activeState || !this.visualization) {
      return;
    }
    const state = this.activeState;
    const graph = state.graph;
    const exportRange = getExportRange(graph.nodes);
    const isLoaded = state.execution.status === "ready" || state.execution.status === "daemon";

    if (!isLoaded) {
      this.container.innerHTML = `<div class="viz-startup-overlay"><p>Press <strong>Load</strong> to start the simulation</p></div>`;
      return;
    }

    if (graph.nodes.length === 0) {
      this.container.innerHTML = `<div class="empty-graph">No nodes available for the current configuration.</div>`;
      return;
    }

    const viewport = this.resolveGraphViewportState(graph.nodes);
    const projection = viewport.projection;

    const edgeMarkup = graph.edges
      .map((edge, index) => {
        const from = graph.nodes.find((node) => node.id === edge.from);
        const to = graph.nodes.find((node) => node.id === edge.to);
        if (!from || !to) {
          return "";
        }
        const fromPoint = projectPoint(from.position, projection);
        const toPoint = projectPoint(to.position, projection);
        
        // Simpler static connection style
        const isMuted = this.visualization!.showNeighborhood && this.selectedNodeIds.length > 0 &&
          !this.selectedNodeIds.includes(edge.from) && !this.selectedNodeIds.includes(edge.to);
        const className = isMuted ? "graph-edge is-muted" : "graph-edge";

        return `<line class="${className}" data-edge-index="${index}" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}" />`;
      })
      .join("");

    const nodeMarkup = graph.nodes
      .map((node) => {
        const point = projectPoint(node.position, projection);
        const selected = this.selectedNodeIds.includes(node.id);
        
        // 1. Base color (HSL Gradient support)
        let fill = selected ? "var(--accent)" : "var(--accent-cool)";
        if (this.visualization!.renderGradient) {
          const num = resolveExportNumber(node.labels.export);
          if (num !== undefined) {
            fill = gradientColor(num, exportRange?.min, exportRange?.max);
          }
        }

        // 2. Active Export stroke support (Stacked effect)
        let stroke = "";
        let strokeWidth = 0;
        let fillOpacity = 1;
        if (this.visualization!.renderExportEffect && typeof node.labels.export === "boolean") {
          fillOpacity = node.labels.export ? 0.92 : 0.3;
          stroke = node.labels.export ? "#00ffff" : "";
          strokeWidth = node.labels.export ? 2 : 0;
        }

        const ledColor = node.labels.ledAll;
        if (ledColor !== undefined && ledColor !== null && ledColor !== "") {
          fill = String(ledColor);
        }

        const circleStyle = `fill:${fill};fill-opacity:${fillOpacity};` + (stroke ? `stroke:${stroke};stroke-width:${strokeWidth};` : "");

        // 3. Selection ring support (Stacked effect)
        const selectionRing = selected 
          ? `<circle r="${this.visualization!.nodeSize + 3}" fill="none" stroke="var(--accent)" stroke-width="1.5" />` 
          : "";

        // 4. Compact label
        const showLabel = this.visualization!.showId || (this.visualization!.showExport && node.labels.export !== undefined);
        let labelText = "";
        if (showLabel) {
          const parts: string[] = [];
          if (this.visualization!.showId) parts.push(node.id);
          if (this.visualization!.showExport && node.labels.export !== undefined) {
            const val = node.labels.export;
            parts.push(typeof val === "number" ? val.toFixed(1) : String(val));
          }
          labelText = parts.join("·");
        }

        const labelMarkup = labelText 
          ? `<text class="graph-node-label" y="${this.visualization!.nodeSize + this.visualization!.fontSize + 4}" style="font-size:${this.visualization!.fontSize}px">${escapeHtml(labelText)}</text>` 
          : "";

        return `
          <g class="graph-node ${selected ? "is-selected" : ""}" data-node-id="${escapeHtml(node.id)}" transform="translate(${point.x}, ${point.y})">
            <circle r="${this.visualization!.nodeSize}" style="${circleStyle}" />
            ${selectionRing}
            ${labelMarkup}
          </g>
        `;
      })
      .join("");

    const selectionBoxHtml = this.renderSelectionBox();

    this.container.innerHTML = `
      <div class="graph-stage ${this.graphInteractionMode === "pan" ? "is-pan-mode" : "is-selection-mode"}" data-graph-stage style="width:100%; height:100%;">
        <svg viewBox="0 0 ${projection.width} ${projection.height}" class="graph-svg" data-render-profile="lightweight" aria-label="Simulation graph" style="width:100%; height:100%; display:block;">
          <rect x="0" y="0" width="${projection.width}" height="${projection.height}" rx="26" class="graph-surface" />
          <g class="graph-viewport" transform="translate(${this.graphPan.x} ${this.graphPan.y})">
            ${edgeMarkup}
            ${nodeMarkup}
          </g>
          ${selectionBoxHtml}
        </svg>
      </div>
    `;

    this.attachEventListeners();
    this.scheduleGraphViewportAnimation();
  }

  private attachEventListeners(): void {
    const stage = this.container?.querySelector<HTMLElement>("[data-graph-stage]");
    if (!stage) return;

    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest(".graph-node")) {
        return;
      }
      if (this.graphInteractionMode === "pan") {
        event.preventDefault();
        this.cancelGraphViewportAnimation();
        this.viewportDragState = {
          startClientX: event.clientX,
          startClientY: event.clientY,
          originalPan: { ...this.graphPan },
        };
        stage.classList.add("is-dragging");
        return;
      }
      this.selectionBoxState = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        additive: event.shiftKey,
      };
      this.updateSelectionBoxVisual();
    });

    for (const nodeElement of this.container?.querySelectorAll<SVGGElement>(".graph-node") ?? []) {
      nodeElement.addEventListener("click", (event) => {
        if (this.graphInteractionMode !== "selection") return;
        const nodeId = nodeElement.dataset.nodeId;
        if (!nodeId) return;
        this.callbacks.onNodeClick?.(nodeId, event.shiftKey);
      });

      nodeElement.addEventListener("pointerdown", (event) => {
        if (this.graphInteractionMode !== "selection") return;
        const nodeId = nodeElement.dataset.nodeId;
        if (!nodeId) return;
        event.preventDefault();

        if (!this.selectedNodeIds.includes(nodeId)) {
          this.callbacks.onNodeClick?.(nodeId, event.shiftKey);
        }

        const nodes = this.activeState?.graph.nodes ?? [];
        const positions = Object.fromEntries(
          nodes.filter((n) => this.selectedNodeIds.includes(n.id) || n.id === nodeId).map((node) => [node.id, { ...node.position }]),
        );

        this.dragState = {
          nodeIds: [...this.selectedNodeIds, nodeId],
          startClientX: event.clientX,
          startClientY: event.clientY,
          originalPositions: positions,
        };
      });
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.viewportDragState) {
      this.cancelGraphViewportAnimation();
      this.graphPan = {
        x: this.viewportDragState.originalPan.x + (event.clientX - this.viewportDragState.startClientX),
        y: this.viewportDragState.originalPan.y + (event.clientY - this.viewportDragState.startClientY),
      };
      if (this.renderedGraphViewport) {
        this.renderedGraphViewport.pan = { ...this.graphPan };
      }
      if (this.targetGraphViewport) {
        this.targetGraphViewport.pan = { ...this.graphPan };
      }
      this.container?.querySelector<SVGGElement>(".graph-viewport")
        ?.setAttribute("transform", `translate(${this.graphPan.x} ${this.graphPan.y})`);
      this.callbacks.onViewportPanned?.(this.graphPan);
      return;
    }

    if (this.selectionBoxState) {
      this.selectionBoxState.currentClientX = event.clientX;
      this.selectionBoxState.currentClientY = event.clientY;
      this.updateSelectionBoxVisual();
      return;
    }

    if (!this.dragState || !this.graphProjection) return;

    const deltaWorldX = (event.clientX - this.dragState.startClientX) / this.graphProjection.scaleX;
    const deltaWorldY = (event.clientY - this.dragState.startClientY) / this.graphProjection.scaleY;
    const movedPositions = Object.fromEntries(
      Object.entries(this.dragState.originalPositions).map(([nodeId, position]) => [
        nodeId,
        { x: position.x + deltaWorldX, y: position.y + deltaWorldY },
      ]),
    );
    this.callbacks.onNodesDragged?.(movedPositions);
  }

  private onPointerUp(): void {
    this.container?.querySelector<HTMLElement>("[data-graph-stage]")?.classList.remove("is-dragging");
    this.viewportDragState = undefined;
    if (this.selectionBoxState) {
      this.applySelectionBox();
      this.selectionBoxState = undefined;
      this.updateSelectionBoxVisual();
    }
    this.dragState = undefined;
  }

  private applySelectionBox(): void {
    const rect = this.currentSelectionRect();
    if (!rect || !this.graphProjection || !this.activeState) {
      if (!this.selectionBoxState?.additive) {
        this.callbacks.onSelectionCleared?.();
      }
      return;
    }
    const nextSelection = this.activeState.graph.nodes
      .filter((node) => {
        const projected = projectPoint(node.position, this.graphProjection as GraphProjection);
        const x = projected.x + this.graphPan.x;
        const y = projected.y + this.graphPan.y;
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
      })
      .map((node) => node.id);
    const isClick = rect.width < 4 && rect.height < 4;
    if (isClick && !this.selectionBoxState?.additive) {
      this.callbacks.onSelectionCleared?.();
      return;
    }
    const finalSelection = this.selectionBoxState?.additive
      ? Array.from(new Set([...this.selectedNodeIds, ...nextSelection]))
      : nextSelection;
    this.callbacks.onSelectionApplied?.(finalSelection);
  }

  private currentSelectionRect(): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.selectionBoxState || !this.graphProjection) return undefined;
    const start = this.clientPointToSvg(this.selectionBoxState.startClientX, this.selectionBoxState.startClientY);
    const current = this.clientPointToSvg(this.selectionBoxState.currentClientX, this.selectionBoxState.currentClientY);
    if (!start || !current) return undefined;
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
  }

  private clientPointToSvg(clientX: number, clientY: number): Vec2 | undefined {
    const stage = this.container?.querySelector<HTMLElement>("[data-graph-stage]");
    if (!stage || !this.graphProjection) return undefined;
    const bounds = stage.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return undefined;
    return {
      x: ((clientX - bounds.left) / bounds.width) * this.graphProjection.width,
      y: ((clientY - bounds.top) / bounds.height) * this.graphProjection.height,
    };
  }

  private updateSelectionBoxVisual(): void {
    const selectionBox = this.container?.querySelector<SVGRectElement>("[data-selection-box]");
    if (!selectionBox) return;
    const rect = this.currentSelectionRect();
    if (!rect) {
      selectionBox.classList.add("is-hidden");
      selectionBox.setAttribute("x", "0");
      selectionBox.setAttribute("y", "0");
      selectionBox.setAttribute("width", "0");
      selectionBox.setAttribute("height", "0");
      return;
    }
    selectionBox.classList.remove("is-hidden");
    selectionBox.setAttribute("x", String(rect.x));
    selectionBox.setAttribute("y", String(rect.y));
    selectionBox.setAttribute("width", String(rect.width));
    selectionBox.setAttribute("height", String(rect.height));
  }

  private renderSelectionBox(): string {
    const rect = this.currentSelectionRect();
    if (!rect) {
      return '<rect class="selection-box is-hidden" data-selection-box x="0" y="0" width="0" height="0" />';
    }
    return `<rect class="selection-box" data-selection-box x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" />`;
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
      if (!this.patchAnimatedGraphViewport(settledViewport)) return;
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

  private patchAnimatedGraphViewport(viewport: GraphViewportState): boolean {
    if (!this.activeState) return false;
    const graph = this.activeState.graph;
    const graphViewport = this.container?.querySelector<SVGGElement>(".graph-viewport");
    const edgeElements = Array.from(this.container?.querySelectorAll<SVGLineElement>(".graph-edge") ?? []);
    const nodeElements = Array.from(this.container?.querySelectorAll<SVGGElement>(".graph-node") ?? []);
    if (!graphViewport || edgeElements.length !== graph.edges.length || nodeElements.length !== graph.nodes.length) {
      return false;
    }
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    graphViewport.setAttribute("transform", `translate(${viewport.pan.x} ${viewport.pan.y})`);

    edgeElements.forEach((edgeElement) => {
      const indexStr = edgeElement.dataset.edgeIndex;
      if (!indexStr) return;
      const index = parseInt(indexStr, 10);
      const edge = graph.edges[index];
      if (!edge) return;
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return;
      const fromPoint = projectPoint(from.position, viewport.projection);
      const toPoint = projectPoint(to.position, viewport.projection);
      edgeElement.setAttribute("x1", String(fromPoint.x));
      edgeElement.setAttribute("y1", String(fromPoint.y));
      edgeElement.setAttribute("x2", String(toPoint.x));
      edgeElement.setAttribute("y2", String(toPoint.y));
    });

    nodeElements.forEach((nodeElement) => {
      const nodeId = nodeElement.dataset.nodeId;
      if (!nodeId) return;
      const node = nodeById.get(nodeId);
      if (!node) return;
      const point = projectPoint(node.position, viewport.projection);
      nodeElement.setAttribute("transform", `translate(${point.x}, ${point.y})`);
    });

    return true;
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
    const hue = ((value % 1920) + 1920) % 1920 / 1920;
    return `hsl(${Math.round(hue * 360)} 70% 58%)`;
  }
  const range = max - min;
  const t = range <= 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
  const hue = (1 - t) * 240;
  return `hsl(${Math.round(hue)} 70% 58%)`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
