import type { Vec2, GraphNode, GraphEdge } from "../../domain/contracts";
import type { AppState } from "../../state/app-store";
import type { SimulationRenderer, SimulationRendererCallbacks } from "./simulation-renderer";
import type {
  VisualizationState,
  NodeRendererEvaluator,
  EdgeRendererEvaluator,
  NodeRenderDefaults,
  NodeRenderOutput,
  NodeRenderOverlay,
  EdgeRenderDefaults,
} from "../renderer-document";
import {
  resolveGraphViewport,
  projectPoint,
  interpolateGraphViewport,
  graphViewportDistance,
  type GraphProjection,
  type GraphViewportState,
  type GraphViewportSize,
} from "../graph-viewport";
import {
  normalizeNodeRenderLabels,
  normalizeNodeRenderOverlays,
} from "../renderer-document";

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

type ResolvedNodeRenderState = NodeRenderDefaults & {
  hidden: boolean;
  className?: string;
};

type ResolvedEdgeRenderState = EdgeRenderDefaults;

/**
 * Above this many nodes the per-element drop-shadows, stroked text and transitions cost more
 * than the whole scene is worth; `.graph-svg.is-dense` in styles.css turns them off.
 */
const DENSE_PAINT_THRESHOLD = 180;

/** Resolves the `.graph-node` an event landed on, if any. */
function nodeIdFromEvent(event: Event): string | undefined {
  const target = event.target;
  if (!(target instanceof Element)) {
    return undefined;
  }
  const nodeElement = target.closest<SVGGElement>(".graph-node");
  return nodeElement?.dataset.nodeId ?? undefined;
}

export class SvgSimulationRenderer implements SimulationRenderer {
  private parent?: HTMLElement;
  private container?: HTMLDivElement;
  private callbacks: SimulationRendererCallbacks = {};
  
  private graphViewportSize: GraphViewportSize = { width: 860, height: 520 };
  private graphPan: Vec2 = { x: 0, y: 0 };
  private graphProjection?: GraphProjection;
  private graphInteractionMode: "pan" | "selection" = "pan";
  private selectedNodeIds: string[] = [];
  /** Membership view of `selectedNodeIds`: the array is scanned once per node and per edge. */
  private selectedNodeIdSet: Set<string> = new Set();

  private dragState?: DragState;
  private viewportDragState?: ViewportDragState;
  private selectionBoxState?: SelectionBoxState;

  private renderedGraphViewport?: GraphViewportState;
  private targetGraphViewport?: GraphViewportState;
  private graphViewportAnimationFrame?: number;

  private activeState?: AppState;
  private visualization?: VisualizationState;
  private nodeRenderer?: NodeRendererEvaluator;
  private edgeRenderer?: EdgeRendererEvaluator;
  private exportRange?: { min: number; max: number };

  constructor() {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  mount(parent: HTMLElement): void {
    this.parent = parent;

    if (this.container) {
      parent.appendChild(this.container);
      this.updateSize();
      return;
    }

    this.container = document.createElement("div");
    this.container.className = "graph-workspace-container";
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
    nodeRenderer?: NodeRendererEvaluator,
    edgeRenderer?: EdgeRendererEvaluator,
  ): void {
    this.activeState = state;
    this.selectedNodeIds = selectedNodeIds;
    this.selectedNodeIdSet = new Set(selectedNodeIds);
    this.graphInteractionMode = interactionMode;
    this.graphPan = graphPan;
    this.visualization = visualization;
    this.nodeRenderer = nodeRenderer;
    this.edgeRenderer = edgeRenderer;

    this.render();
  }

  private render(): void {
    if (!this.container || !this.activeState || !this.visualization) {
      return;
    }
    const state = this.activeState;
    const graph = state.graph;
    this.exportRange = getExportRange(graph.nodes);
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
    const renderProfile = this.resolveGraphRenderProfile(state.execution.status, graph.nodes.length);

    const nodeMap = new Map<string, GraphNode>();
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node);
    }

    const edgeMarkup = (this.visualization?.showLinks !== false)
      ? graph.edges
          .map((edge, index) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) {
              return "";
            }
            const fromPoint = projectPoint(from.position, projection);
            const toPoint = projectPoint(to.position, projection);
            const edgeState = this.resolveEdgeRenderState(edge, from, to);
            return `<line class="${escapeHtml(edgeState.className)}" ${edgeState.hidden ? 'display="none" ' : ""}${
              edgeState.stroke ? `stroke="${escapeHtml(edgeState.stroke)}" ` : ""
            }${edgeState.strokeWidth !== undefined ? `stroke-width="${edgeState.strokeWidth}" ` : ""}${
              edgeState.strokeOpacity !== undefined ? `stroke-opacity="${edgeState.strokeOpacity}" ` : ""
            }data-edge-key="${escapeHtml(edge.from)}->${escapeHtml(edge.to)}" data-edge-index="${index}" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}" />`;
          })
          .join("")
      : "";

    const nodeMarkup = graph.nodes
      .map((node, index) => {
        const point = projectPoint(node.position, projection);
        const nodeRenderState = this.resolveNodeRenderState(node, graph.edges, graph.nodes.length, index);
        return `
          <g class="graph-node ${this.selectedNodeIdSet.has(node.id) ? "is-selected" : ""} ${escapeHtml(nodeRenderState.className ?? "")}" ${
            nodeRenderState.hidden ? 'display="none" aria-hidden="true"' : ""
          } data-node-id="${escapeHtml(node.id)}" transform="translate(${point.x}, ${point.y})">
            ${this.renderGraphNodeContent(node, nodeRenderState)}
          </g>
        `;
      })
      .join("");

    const selectionBoxHtml = this.renderSelectionBox();

    this.container.innerHTML = `
      <div class="graph-stage ${this.graphInteractionMode === "pan" ? "is-pan-mode" : "is-selection-mode"}" data-graph-stage>
        <svg viewBox="0 0 ${projection.width} ${projection.height}" class="graph-svg ${graph.nodes.length > DENSE_PAINT_THRESHOLD ? "is-dense" : ""}" data-render-profile="${renderProfile}" aria-label="Simulation graph">
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

  /**
   * Binds the stage once per render, and reaches nodes by delegation.
   *
   * `render()` replaces the whole subtree, so this runs on every frame; attaching a `click`
   * and a `pointerdown` handler to each `.graph-node` meant two listeners per node per frame,
   * which is thousands of closures a second on a large network.
   */
  private attachEventListeners(): void {
    const stage = this.container?.querySelector<HTMLElement>("[data-graph-stage]");
    if (!stage) return;

    stage.addEventListener("click", (event) => {
      if (this.graphInteractionMode !== "selection") {
        return;
      }
      const nodeId = nodeIdFromEvent(event);
      if (!nodeId) return;
      this.callbacks.onNodeClick?.(nodeId, event.shiftKey);
    });

    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const nodeId = nodeIdFromEvent(event);
      if (nodeId !== undefined) {
        if (this.graphInteractionMode !== "selection") {
          return;
        }
        event.preventDefault();

        // Drag node state setting
        if (!this.selectedNodeIdSet.has(nodeId)) {
          this.callbacks.onNodeClick?.(nodeId, event.shiftKey);
        }

        const nodes = this.activeState?.graph.nodes ?? [];
        const positions = Object.fromEntries(
          nodes.filter((n) => this.selectedNodeIdSet.has(n.id) || n.id === nodeId).map((node) => [node.id, { ...node.position }]),
        );

        this.dragState = {
          nodeIds: [...this.selectedNodeIds, nodeId],
          startClientX: event.clientX,
          startClientY: event.clientY,
          originalPositions: positions,
        };
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

    if (!this.dragState || !this.graphProjection) {
      return;
    }

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
    if (!this.selectionBoxState || !this.graphProjection) {
      return undefined;
    }
    const start = this.clientPointToSvg(this.selectionBoxState.startClientX, this.selectionBoxState.startClientY);
    const current = this.clientPointToSvg(this.selectionBoxState.currentClientX, this.selectionBoxState.currentClientY);
    if (!start || !current) {
      return undefined;
    }
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
  }

  private clientPointToSvg(clientX: number, clientY: number): Vec2 | undefined {
    const stage = this.container?.querySelector<HTMLElement>("[data-graph-stage]");
    if (!stage || !this.graphProjection) {
      return undefined;
    }
    const bounds = stage.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return undefined;
    }
    return {
      x: ((clientX - bounds.left) / bounds.width) * this.graphProjection.width,
      y: ((clientY - bounds.top) / bounds.height) * this.graphProjection.height,
    };
  }

  private updateSelectionBoxVisual(): void {
    const selectionBox = this.container?.querySelector<SVGRectElement>("[data-selection-box]");
    if (!selectionBox) {
      return;
    }
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
    const labelPadding = this.visualization?.renderText
      ? this.visualization.nodeSize + this.visualization.fontSize * 2
      : (this.visualization?.nodeSize ?? 10) * 2;
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
    if (!currentViewport) {
      return false;
    }
    return graphViewportDistance(currentViewport, targetViewport) > 0.6;
  }

  private scheduleGraphViewportAnimation(): void {
    if (!this.renderedGraphViewport || !this.targetGraphViewport) {
      return;
    }
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
      if (!this.renderedGraphViewport || !this.targetGraphViewport) {
        return;
      }
      const nextViewport = interpolateGraphViewport(this.renderedGraphViewport, this.targetGraphViewport, 0.22);
      const settledViewport =
        graphViewportDistance(nextViewport, this.targetGraphViewport) <= 0.6 ? this.targetGraphViewport : nextViewport;
      this.renderedGraphViewport = settledViewport;
      this.graphProjection = settledViewport.projection;
      this.graphPan = settledViewport.pan;
      if (!this.patchAnimatedGraphViewport(settledViewport)) {
        return;
      }
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
    if (!this.activeState) {
      return false;
    }
    const graph = this.activeState.graph;
    const graphViewport = this.container?.querySelector<SVGGElement>(".graph-viewport");
    const edgeElements = Array.from(this.container?.querySelectorAll<SVGLineElement>(".graph-edge") ?? []);
    const nodeElements = Array.from(this.container?.querySelectorAll<SVGGElement>(".graph-node") ?? []);
    if (!graphViewport || edgeElements.length !== (this.visualization?.showLinks !== false ? graph.edges.length : 0) || nodeElements.length !== graph.nodes.length) {
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

  private resolveGraphRenderProfile(status: string, nodesCount: number): "full" | "compact" | "compact-matrix" | "full-custom" {
    if (this.nodeRenderer || this.edgeRenderer) {
      return "full-custom";
    }
    if (status === "daemon") {
      return nodesCount > 64 ? "compact-matrix" : "compact";
    }
    return nodesCount > 400 ? "compact-matrix" : nodesCount > 64 ? "compact" : "full";
  }

  private resolveGraphEdgeClass(edge: GraphEdge): string {
    if (!this.visualization?.showNeighborhood || this.selectedNodeIds.length === 0) {
      return "graph-edge";
    }
    return this.selectedNodeIdSet.has(edge.from) || this.selectedNodeIdSet.has(edge.to)
      ? "graph-edge is-neighborhood"
      : "graph-edge is-muted";
  }

  private resolveEdgeRenderState(edge: GraphEdge, fromNode: GraphNode, toNode: GraphNode): ResolvedEdgeRenderState {
    const defaults: EdgeRenderDefaults = {
      hidden: false,
      className: this.resolveGraphEdgeClass(edge),
    };
    if (!this.edgeRenderer) {
      return defaults;
    }
    try {
      const output = this.edgeRenderer({
        edge,
        fromNode,
        toNode,
        graph: this.activeState!.graph,
        execution: this.activeState!.execution,
        selectedNodeIds: this.selectedNodeIds,
        isNeighborhood: this.selectedNodeIdSet.has(edge.from) || this.selectedNodeIdSet.has(edge.to),
        defaults,
      });
      return {
        hidden: typeof output?.hidden === "boolean" ? output.hidden : defaults.hidden,
        className: typeof output?.className === "string" && output.className.length > 0 ? output.className : defaults.className,
        stroke: typeof output?.stroke === "string" ? output.stroke : defaults.stroke,
        strokeWidth: typeof output?.strokeWidth === "number" ? output.strokeWidth : defaults.strokeWidth,
        strokeOpacity: typeof output?.strokeOpacity === "number" ? output.strokeOpacity : defaults.strokeOpacity,
      };
    } catch (error) {
      return defaults;
    }
  }

  private resolveNodeRenderState(
    node: GraphNode,
    edges: GraphEdge[],
    totalNodes: number,
    nodeIndex: number,
  ): ResolvedNodeRenderState {
    const selectedNode = this.selectedNodeIdSet.has(node.id);
    const labels = buildNodeLabels(node, edges, this.visualization!, selectedNode, totalNodes, nodeIndex);
    const nodeVisual = computeNodeVisual(node, this.visualization!, selectedNode, this.exportRange);
    const defaults: NodeRenderDefaults = {
      fill: nodeVisual.fill,
      fillOpacity: nodeVisual.fillOpacity,
      stroke: nodeVisual.stroke,
      strokeWidth: nodeVisual.strokeWidth,
      nodeSize: this.visualization!.nodeSize,
      fontSize: this.visualization!.fontSize,
      labels,
      renderMatrix: this.visualization!.renderMatrix,
      renderBooleans: this.visualization!.renderBooleans,
      renderGradient: this.visualization!.renderGradient,
      renderExportEffect: this.visualization!.renderExportEffect,
      overlays: [],
    };
    if (!this.nodeRenderer) {
      return { ...defaults, hidden: false };
    }
    const showLinks = this.visualization?.showLinks !== false;
    const availableSensors = Array.from(this.visualization!.visibleSensors);
    try {
      const output: NodeRenderOutput | void = this.nodeRenderer({
        node,
        graph: this.activeState!.graph,
        execution: this.activeState!.execution,
        selected: selectedNode,
        nodeIndex,
        totalNodes,
        // Scanning every edge per node is O(nodes x edges); none of the built-in RendererKit
        // helpers read this, so it is only paid for when a custom renderNode asks for it.
        get incidentEdges(): GraphEdge[] {
          return showLinks ? edges.filter((edge) => edge.from === node.id || edge.to === node.id) : [];
        },
        availableSensors,
        defaults,
      });
      const renderGradient = typeof output?.renderGradient === "boolean" ? output.renderGradient : defaults.renderGradient;
      const renderExportEffect =
        typeof output?.renderExportEffect === "boolean" ? output.renderExportEffect : defaults.renderExportEffect;
      const resolvedVisual = computeNodeVisual(
        node,
        {
          ...this.visualization!,
          renderGradient,
          renderExportEffect,
        },
        selectedNode,
        this.exportRange,
      );
      return {
        hidden: typeof output?.hidden === "boolean" ? output.hidden : false,
        className: typeof output?.className === "string" ? output.className : undefined,
        fill: typeof output?.fill === "string" ? output.fill : resolvedVisual.fill,
        fillOpacity: typeof output?.fillOpacity === "number" ? output.fillOpacity : resolvedVisual.fillOpacity,
        stroke: typeof output?.stroke === "string" ? output.stroke : resolvedVisual.stroke,
        strokeWidth: typeof output?.strokeWidth === "number" ? output.strokeWidth : resolvedVisual.strokeWidth,
        nodeSize: typeof output?.nodeSize === "number" ? output.nodeSize : defaults.nodeSize,
        fontSize: typeof output?.fontSize === "number" ? output.fontSize : defaults.fontSize,
        labels: normalizeNodeRenderLabels(output?.labels, defaults.labels),
        renderMatrix: typeof output?.renderMatrix === "boolean" ? output.renderMatrix : defaults.renderMatrix,
        renderBooleans: typeof output?.renderBooleans === "boolean" ? output.renderBooleans : defaults.renderBooleans,
        renderGradient,
        renderExportEffect,
        overlays: normalizeNodeRenderOverlays(output?.overlays, defaults.overlays),
      };
    } catch (error) {
      return { ...defaults, hidden: false };
    }
  }

  private renderGraphNodeContent(
    node: GraphNode,
    nodeRenderState: ResolvedNodeRenderState,
  ): string {
    const selectedNode = this.selectedNodeIdSet.has(node.id);
    const effectiveVisualization: VisualizationState = {
      ...this.visualization!,
      nodeSize: nodeRenderState.nodeSize,
      fontSize: nodeRenderState.fontSize,
      renderMatrix: nodeRenderState.renderMatrix,
      renderBooleans: nodeRenderState.renderBooleans,
    };
    const booleanBadges =
      nodeRenderState.renderBooleans && shouldRenderBooleanBadges(this.activeState!.graph.nodes.length, selectedNode)
        ? renderBooleanBadges(node, effectiveVisualization, this.activeState!.graph.nodes.length, selectedNode)
        : "";
    const matrixOverlay = nodeRenderState.renderMatrix
      ? renderMatrixOverlay(node, effectiveVisualization, this.activeState!.graph.nodes.length, selectedNode)
      : "";
    const customOverlays = renderNodeOverlays(nodeRenderState.overlays, nodeRenderState);
    const styleParts = [`fill:${nodeRenderState.fill}`];
    if (nodeRenderState.fillOpacity !== 1) {
      styleParts.push(`fill-opacity:${nodeRenderState.fillOpacity}`);
    }
    if (nodeRenderState.stroke) {
      styleParts.push(`stroke:${nodeRenderState.stroke}`);
    }
    if (nodeRenderState.strokeWidth) {
      styleParts.push(`stroke-width:${nodeRenderState.strokeWidth}`);
    }
    const circleStyle = styleParts.join(";");
    return `
      <circle r="${nodeRenderState.nodeSize}" style="${circleStyle}" />
      ${matrixOverlay}
      ${booleanBadges}
      ${customOverlays}
      ${nodeRenderState.labels.length > 0 ? `<text class="graph-node-label" y="${nodeRenderState.nodeSize + nodeRenderState.fontSize + 6}" style="font-size:${nodeRenderState.fontSize}px">${escapeHtml(nodeRenderState.labels.join(" · "))}</text>` : ""}
    `;
  }
}

// Inline pure helpers to avoid duplicate definitions
function buildNodeLabels(
  node: GraphNode,
  edges: GraphEdge[],
  visualization: VisualizationState,
  selectedNode: boolean,
  totalNodes: number,
  nodeIndex: number,
): string[] {
  const result: string[] = [];
  if (visualization.showId) {
    if (selectedNode || totalNodes <= 12 || (totalNodes <= 48 && nodeIndex % 2 === 0)) {
      result.push(node.id);
    }
  }
  if (visualization.showExport && node.labels.export !== undefined) {
    const val = node.labels.export;
    if (selectedNode || totalNodes <= 24) {
      result.push(typeof val === "number" ? val.toFixed(2) : String(val));
    }
  }
  return result;
}

function computeNodeVisual(
  node: GraphNode,
  visualization: VisualizationState,
  selectedNode: boolean,
  exportRange?: { min: number; max: number },
): { fill: string; fillOpacity: number; stroke: string; strokeWidth: number } {
  let fill = selectedNode ? "var(--accent)" : "var(--accent-cool)";
  let fillOpacity = 1;
  let stroke = "";
  let strokeWidth = 0;

  if (visualization.renderGradient) {
    const num = resolveExportNumber(node.labels.export);
    if (num !== undefined) {
      fill = gradientColor(num, exportRange?.min, exportRange?.max);
    }
  }

  if (visualization.renderExportEffect && typeof node.labels.export === "boolean") {
    fillOpacity = node.labels.export ? 0.92 : 0.3;
    stroke = node.labels.export ? "#00ffff" : "";
    strokeWidth = node.labels.export ? 2 : 0;
  }

  const ledColor = node.labels.ledAll;
  if (ledColor !== undefined && ledColor !== null && ledColor !== "") {
    fill = String(ledColor);
  }

  return { fill, fillOpacity, stroke, strokeWidth };
}

function renderBooleanBadges(
  node: GraphNode,
  visualization: VisualizationState,
  totalNodes: number,
  selectedNode: boolean,
): string {
  const booleans = Object.entries(node.labels)
    .filter(([label, value]) => label !== "export" && label !== "matrix" && typeof value === "boolean")
    .slice(0, selectedNode || totalNodes <= 24 ? undefined : 2);
  const badgeRadius = Math.max(3.5, visualization.nodeSize * (totalNodes > 64 && !selectedNode ? 0.32 : 0.42));
  const offsetX = -(visualization.nodeSize * (totalNodes > 64 && !selectedNode ? 1.45 : 2.2));
  return booleans
    .map(([label, value], index) => {
      const offsetY = index * (visualization.nodeSize * 1.55) - ((booleans.length - 1) * visualization.nodeSize * 0.78);
      const color = value ? booleanColor(index) : "#ffffff";
      const opacity = value ? 1 : 0.2;
      return `<g class="graph-boolean-badge" data-bool-label="${escapeHtml(label)}" transform="translate(${offsetX}, ${offsetY})"><circle r="${badgeRadius}" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-width="1" /></g>`;
    })
    .join("");
}

function renderMatrixOverlay(
  node: GraphNode,
  visualization: VisualizationState,
  totalNodes: number,
  selectedNode: boolean,
): string {
  const matrix = node.labels.matrix;
  if (!isMatrixValue(matrix)) {
    return "";
  }
  const matrixSize = visualization.nodeSize * (totalNodes > 64 && !selectedNode ? 1.25 : 1.8);
  const cellSize = matrixSize / matrix.dimension;
  const start = -matrixSize / 2;
  const cells: string[] = [];
  for (let row = 0; row < matrix.dimension; row += 1) {
    for (let column = 0; column < matrix.dimension; column += 1) {
      const color = matrix.pixels[`${row}:${column}`] ?? "#000000";
      cells.push(
        `<rect class="graph-matrix-cell" x="${start + column * cellSize}" y="${start + row * cellSize}" width="${cellSize}" height="${cellSize}" fill="${escapeHtml(color)}" />`,
      );
    }
  }
  return `<g class="graph-matrix-overlay">${cells.join("")}</g>`;
}

function renderNodeOverlays(overlays: NodeRenderOverlay[], nodeRenderState: ResolvedNodeRenderState): string {
  return overlays
    .map((overlay, index) => {
      if (overlay.kind === "ring") {
        return `<circle class="graph-node-overlay graph-node-overlay-ring ${escapeHtml(overlay.className ?? "")}" data-overlay-index="${index}" r="${overlay.radius ?? nodeRenderState.nodeSize + 4}" fill="${escapeHtml(overlay.fill ?? "none")}" ${
          overlay.fillOpacity !== undefined ? `fill-opacity="${overlay.fillOpacity}" ` : ""
        }stroke="${escapeHtml(overlay.stroke ?? nodeRenderState.stroke)}" stroke-width="${overlay.strokeWidth ?? 2}" />`;
      }
      if (overlay.kind === "dot") {
        return `<circle class="graph-node-overlay graph-node-overlay-dot ${escapeHtml(overlay.className ?? "")}" data-overlay-index="${index}" cx="${overlay.x}" cy="${overlay.y}" r="${overlay.radius ?? 3}" fill="${escapeHtml(overlay.fill ?? "#ffffff")}" ${
          overlay.fillOpacity !== undefined ? `fill-opacity="${overlay.fillOpacity}" ` : ""
        }${overlay.stroke ? `stroke="${escapeHtml(overlay.stroke)}" ` : ""}${overlay.strokeWidth !== undefined ? `stroke-width="${overlay.strokeWidth}"` : ""} />`;
      }
      if (overlay.kind === "arrow") {
        const module = Math.hypot(overlay.dx, overlay.dy);
        if (module === 0) return "";
        const nx = overlay.dx / module;
        const ny = overlay.dy / module;
        const arrowLen = overlay.length ?? nodeRenderState.nodeSize * 3;
        const tipX = nx * arrowLen;
        const tipY = ny * arrowLen;
        const headLen = Math.min(7, arrowLen * 0.4);
        const headW = headLen * 0.45;
        const baseX = tipX - nx * headLen;
        const baseY = tipY - ny * headLen;
        const pw = -ny * headW;
        const ph = nx * headW;
        const color = escapeHtml(overlay.stroke ?? "#a5d6ff");
        const strokeWidth = overlay.strokeWidth ?? 2.5;
        return `<g class="graph-node-overlay graph-node-overlay-arrow ${escapeHtml(overlay.className ?? "")}" data-overlay-index="${index}">
          <line x1="0" y1="0" x2="${tipX}" y2="${tipY}" stroke="${color}" stroke-width="${strokeWidth}" />
          <polygon points="${tipX},${tipY} ${baseX + pw},${baseY + ph} ${baseX - pw},${baseY - ph}" fill="${color}" />
        </g>`;
      }
      return `<text class="graph-node-overlay graph-node-overlay-text ${escapeHtml(overlay.className ?? "")}" data-overlay-index="${index}" x="${overlay.x ?? 0}" y="${overlay.y}" fill="${escapeHtml(overlay.fill ?? "#ffffff")}" text-anchor="${overlay.anchor ?? "middle"}" style="font-size:${overlay.fontSize ?? Math.max(10, nodeRenderState.fontSize - 1)}px">${escapeHtml(overlay.text)}</text>`;
    })
    .join("");
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

function resolveExportNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function booleanColor(index: number): string {
  const base = 255 - index * 48;
  const channel = Math.max(96, base);
  return `rgb(${channel}, ${channel}, 255)`;
}

function isMatrixValue(value: unknown): value is { dimension: number; pixels: Record<string, string> } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "dimension" in value &&
      "pixels" in value &&
      typeof (value as any).dimension === "number",
  );
}

function shouldRenderBooleanBadges(totalNodes: number, selectedNode: boolean): boolean {
  return selectedNode || totalNodes <= 48;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
