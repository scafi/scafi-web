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

export class LightweightSimulationRenderer implements SimulationRenderer {
  private parent?: HTMLElement;
  private container?: HTMLDivElement;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
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
  private listenersAttached = false;

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

    this.canvas = document.createElement("canvas");
    this.canvas.className = "graph-canvas";
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.borderRadius = "14px";
    this.canvas.style.border = "1px solid var(--line)";
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

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
    if (!this.container || !this.canvas) {
      return false;
    }
    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(Math.round(bounds.width) - 2, 1);
    const height = Math.max(Math.round(bounds.height) - 2, 1);
    if (width === this.graphViewportSize.width && height === this.graphViewportSize.height) {
      return false;
    }
    this.graphViewportSize = { width, height };

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

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
    this.listenersAttached = false;
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
    if (!this.container || !this.canvas || !this.activeState || !this.visualization) {
      return;
    }
    const state = this.activeState;
    const graph = state.graph;
    const isLoaded = state.execution.status === "ready" || state.execution.status === "daemon";

    // Gestione degli overlay HTML di avvio o grafico vuoto
    if (!isLoaded) {
      this.canvas.style.display = "none";
      if (!this.container.querySelector(".viz-startup-overlay")) {
        this.container.querySelectorAll(".viz-startup-overlay, .empty-graph").forEach((el) => el.remove());
        const overlay = document.createElement("div");
        overlay.className = "viz-startup-overlay";
        overlay.innerHTML = `<p>Press <strong>Load</strong> to start the simulation</p>`;
        this.container.appendChild(overlay);
      }
      return;
    }

    if (graph.nodes.length === 0) {
      this.canvas.style.display = "none";
      if (!this.container.querySelector(".empty-graph")) {
        this.container.querySelectorAll(".viz-startup-overlay, .empty-graph").forEach((el) => el.remove());
        const empty = document.createElement("div");
        empty.className = "empty-graph";
        empty.textContent = "No nodes available for the current configuration.";
        this.container.appendChild(empty);
      }
      return;
    }

    // Nasconde gli overlay e mostra il Canvas attivo
    this.canvas.style.display = "block";
    this.container.querySelectorAll(".viz-startup-overlay, .empty-graph").forEach((el) => el.remove());

    // Cursore del Canvas in base alla modalità d'interazione
    if (this.graphInteractionMode === "pan") {
      this.canvas.style.cursor = this.viewportDragState ? "grabbing" : "grab";
    } else {
      this.canvas.style.cursor = "default";
    }

    // Assicura l'aggancio dei listener esattamente una volta sul Canvas
    if (!this.listenersAttached) {
      this.attachEventListeners();
      this.listenersAttached = true;
    }

    // Disegna l'intero grafico sul Canvas
    this.draw();
    this.scheduleGraphViewportAnimation();
  }

  private attachEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const node = this.findNodeAt(event.clientX, event.clientY);
      if (node) {
        if (this.graphInteractionMode !== "selection") return;
        event.preventDefault();

        if (!this.selectedNodeIds.includes(node.id)) {
          this.callbacks.onNodeClick?.(node.id, event.shiftKey);
        }

        const nodes = this.activeState?.graph.nodes ?? [];
        const positions = Object.fromEntries(
          nodes
            .filter((n) => this.selectedNodeIds.includes(n.id) || n.id === node.id)
            .map((n) => [n.id, { ...n.position }]),
        );

        this.dragState = {
          nodeIds: [...this.selectedNodeIds, node.id],
          startClientX: event.clientX,
          startClientY: event.clientY,
          originalPositions: positions,
        };
        this.draw();
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
        this.canvas?.classList.add("is-dragging");
        this.draw();
        return;
      }

      this.selectionBoxState = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        additive: event.shiftKey,
      };
      this.draw();
    });
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
      this.callbacks.onViewportPanned?.(this.graphPan);
      this.draw();
      return;
    }

    if (this.selectionBoxState) {
      this.selectionBoxState.currentClientX = event.clientX;
      this.selectionBoxState.currentClientY = event.clientY;
      this.draw();
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
    this.canvas?.classList.remove("is-dragging");
    this.viewportDragState = undefined;
    if (this.selectionBoxState) {
      this.applySelectionBox();
      this.selectionBoxState = undefined;
    }
    this.dragState = undefined;
    this.draw();
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
    if (!this.canvas || !this.graphProjection) return undefined;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return undefined;
    return {
      x: ((clientX - bounds.left) / bounds.width) * this.graphProjection.width,
      y: ((clientY - bounds.top) / bounds.height) * this.graphProjection.height,
    };
  }

  private findNodeAt(clientX: number, clientY: number): GraphNode | undefined {
    if (!this.canvas || !this.graphProjection || !this.activeState) return undefined;
    const bounds = this.canvas.getBoundingClientRect();
    const mouseX = clientX - bounds.left;
    const mouseY = clientY - bounds.top;

    const nodeSize = this.visualization?.nodeSize ?? 8;
    const nodes = this.activeState.graph.nodes;

    // Cerca dall'ultimo al primo per cliccare sul nodo visualmente in cima
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const projected = projectPoint(node.position, this.graphProjection);
      const x = projected.x + this.graphPan.x;
      const y = projected.y + this.graphPan.y;
      const dx = mouseX - x;
      const dy = mouseY - y;
      if (dx * dx + dy * dy <= (nodeSize + 4) * (nodeSize + 4)) {
        return node;
      }
    }
    return undefined;
  }

  private draw(): void {
    if (!this.canvas || !this.ctx || !this.activeState || !this.visualization) {
      return;
    }
    const state = this.activeState;
    const graph = state.graph;

    const dpr = window.devicePixelRatio || 1;
    const width = this.graphViewportSize.width;
    const height = this.graphViewportSize.height;

    this.ctx.clearRect(0, 0, width * dpr, height * dpr);

    const viewport = this.resolveGraphViewportState(graph.nodes);
    const projection = viewport.projection;
    const exportRange = getExportRange(graph.nodes);

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    // 1. Sfondo del tabellone di gioco (Rounded Rect)
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(0, 0, width, height, 26);
    } else {
      this.ctx.rect(0, 0, width, height);
    }
    this.ctx.fillStyle = "rgba(0,0,0,0.15)";
    this.ctx.fill();

    const nodeMap = new Map<string, GraphNode>();
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node);
    }

    const showNeighborhood = this.visualization.showNeighborhood && this.selectedNodeIds.length > 0;
    const nodeSize = this.visualization.nodeSize;
    const isLightTheme = document.documentElement.getAttribute("data-theme") === "light";

    // 2. Disegno degli Archi (Collegamenti di rete)
    this.ctx.save();
    for (const edge of graph.edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) continue;

      const fromPoint = projectPoint(from.position, projection);
      const toPoint = projectPoint(to.position, projection);

      const isMuted = showNeighborhood && !this.selectedNodeIds.includes(edge.from) && !this.selectedNodeIds.includes(edge.to);
      
      this.ctx.beginPath();
      this.ctx.moveTo(fromPoint.x + this.graphPan.x, fromPoint.y + this.graphPan.y);
      this.ctx.lineTo(toPoint.x + this.graphPan.x, toPoint.y + this.graphPan.y);
      
      if (isMuted) {
        this.ctx.strokeStyle = isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)";
        this.ctx.lineWidth = 0.75;
      } else {
        this.ctx.strokeStyle = isLightTheme ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.16)";
        this.ctx.lineWidth = 1.25;
      }
      this.ctx.stroke();
    }
    this.ctx.restore();

    // 3. Disegno dei Nodi
    for (const node of graph.nodes) {
      const point = projectPoint(node.position, projection);
      const px = point.x + this.graphPan.x;
      const py = point.y + this.graphPan.y;
      const selected = this.selectedNodeIds.includes(node.id);

      // Risolve il colore primario del nodo
      let fill = selected ? "var(--accent)" : "var(--accent-cool)";
      if (this.visualization.renderGradient) {
        const num = resolveExportNumber(node.labels.export);
        if (num !== undefined) {
          fill = gradientColor(num, exportRange?.min, exportRange?.max);
        }
      }

      const ledColor = node.labels.ledAll;
      if (ledColor !== undefined && ledColor !== null && ledColor !== "") {
        fill = String(ledColor);
      }

      // Risolve variabili CSS se presenti
      let resolvedFill = fill;
      if (fill.startsWith("var(")) {
        const varName = fill.substring(4, fill.length - 1).trim();
        resolvedFill = getComputedStyle(this.container!).getPropertyValue(varName) || (selected ? "#e07030" : "#7db5ff");
      }

      let fillOpacity = 1;
      let stroke = "";
      let strokeWidth = 0;
      if (this.visualization.renderExportEffect && typeof node.labels.export === "boolean") {
        fillOpacity = node.labels.export ? 0.92 : 0.3;
        stroke = node.labels.export ? "#00ffff" : "";
        strokeWidth = node.labels.export ? 2 : 0;
      }

      this.ctx.save();

      // Disegna l'anello di selezione
      if (selected) {
        this.ctx.beginPath();
        this.ctx.arc(px, py, nodeSize + 3, 0, Math.PI * 2);
        this.ctx.strokeStyle = getComputedStyle(this.container!).getPropertyValue("--accent") || "#e07030";
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      // Disegna il nodo (cerchio pieno)
      this.ctx.beginPath();
      this.ctx.arc(px, py, nodeSize, 0, Math.PI * 2);
      this.ctx.fillStyle = resolvedFill;
      this.ctx.globalAlpha = fillOpacity;
      this.ctx.fill();

      // Disegna il contorno dell'effetto export attivo
      if (stroke) {
        this.ctx.beginPath();
        this.ctx.arc(px, py, nodeSize, 0, Math.PI * 2);
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.globalAlpha = 1;
        this.ctx.stroke();
      }

      this.ctx.restore();

      // 4. Disegno dei Testi (Label del nodo)
      const showLabel = this.visualization.showId || (this.visualization.showExport && node.labels.export !== undefined);
      if (showLabel) {
        const parts: string[] = [];
        if (this.visualization.showId) parts.push(node.id);
        if (this.visualization.showExport && node.labels.export !== undefined) {
          const val = node.labels.export;
          parts.push(typeof val === "number" ? val.toFixed(1) : String(val));
        }
        const labelText = parts.join("·");

        this.ctx.save();
        this.ctx.font = `500 ${this.visualization.fontSize}px sans-serif`;
        this.ctx.fillStyle = isLightTheme ? "#333333" : "#b0b6bd";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "top";
        this.ctx.fillText(labelText, px, py + nodeSize + 4);
        this.ctx.restore();
      }
    }

    // 5. Disegno della Scatola di Selezione (Selection Box)
    if (this.selectionBoxState) {
      const rect = this.currentSelectionRect();
      if (rect) {
        this.ctx.save();
        this.ctx.strokeStyle = isLightTheme ? "rgba(74, 144, 217, 0.8)" : "rgba(125, 181, 255, 0.8)";
        this.ctx.fillStyle = isLightTheme ? "rgba(74, 144, 217, 0.08)" : "rgba(125, 181, 255, 0.08)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.rect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    this.ctx.restore();
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
    this.draw();
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
    const hue = (((value % 1920) + 1920) % 1920) / 1920;
    return `hsl(${Math.round(hue * 360)} 70% 58%)`;
  }
  const range = max - min;
  const t = range <= 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
  const hue = (1 - t) * 240;
  return `hsl(${Math.round(hue)} 70% 58%)`;
}
