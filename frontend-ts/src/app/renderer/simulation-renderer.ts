import type { Vec2 } from "../../domain/contracts";
import type { AppState } from "../../state/app-store";
import type { VisualizationState, NodeRendererEvaluator, EdgeRendererEvaluator } from "../renderer-document";

export interface SimulationRendererCallbacks {
  onNodeClick?(nodeId: string, shiftKey: boolean): void;
  onNodesDragged?(movedPositions: Record<string, Vec2>): void;
  onViewportPanned?(pan: Vec2): void;
  onSelectionApplied?(selectedNodeIds: string[]): void;
  onSelectionCleared?(): void;
  onResetView?(): void;
}

export interface SimulationRenderer {
  mount(parent: HTMLElement): void;
  update(
    state: AppState,
    selectedNodeIds: string[],
    interactionMode: "pan" | "selection",
    graphPan: Vec2,
    visualization: VisualizationState,
    nodeRenderer?: NodeRendererEvaluator,
    edgeRenderer?: EdgeRendererEvaluator,
  ): void;
  setCallbacks(callbacks: SimulationRendererCallbacks): void;
  getGraphPan(): Vec2;
  setGraphPan(pan: Vec2): void;
  updateSize(): boolean;
  destroy(): void;
}
