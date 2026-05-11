import CodeMirror from "codemirror";
import type { EditorFromTextArea } from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror/mode/clike/clike";
import "codemirror/mode/javascript/javascript";
import { convertEasyScalaToFull } from "../services/scastie/easy-scala";
import { parseWorldDocument, serializeWorldDocument, tryParseWorldDocument } from "../services/config/world-document";
import {
  compileRendererDocument,
  createDefaultVisualizationState,
  defaultRendererDocument,
  normalizeNodeRenderLabels,
  normalizeNodeRenderOverlays,
  resolveVisualizationState,
  summarizeActiveRenderers,
  visualizationToRendererDefaults,
  type EdgeRendererEvaluator,
  type NodeRendererEvaluator,
  type NodeRenderDefaults,
  type NodeRenderOverlay,
  type NodeRenderOutput,
  type EdgeRenderDefaults,
  type RendererDocumentContext,
  type RendererDocumentEvaluator,
  type VisualizationState,
} from "./renderer-document";
import {
  graphViewportDistance,
  interpolateGraphViewport,
  projectPoint,
  resolveGraphViewport,
  type GraphProjection,
  type GraphViewportState,
  type GraphViewportSize,
} from "./graph-viewport";

import type {
  EditorDocument,
  ExampleDefinition,
  ExampleGroup,
  GraphNode,
  MatrixValue,
  SupportConfiguration,
  Vec2,
} from "../domain/contracts";
import type { AppState } from "../state/app-store";
import { defaultConfiguration, defaultEditorDocument } from "./defaults";
import { ScafiWebApp } from "./scafi-web-app";

type SensorDraft = {
  id: string;
  name: string;
  value: string;
};

type ConfigurationDraft = {
  networkKind: "grid" | "random";
  rows: number;
  cols: number;
  stepX: number;
  stepY: number;
  tolerance: number;
  min: number;
  max: number;
  howMany: number;
  radius: number;
  matrixDimension: number;
  matrixColor: string;
  sensors: SensorDraft[];
};

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

type GraphInteractionMode = "pan" | "selection";

type SelectionBoxState = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  additive: boolean;
};

type PerformanceMetrics = {
  windowStartedAt: number;
  framesInWindow: number;
  fps: number;
  averageRenderMs: number;
};

type GraphRenderProfile = {
  key: "full" | "compact" | "compact-matrix" | "full-custom";
  visualization: VisualizationState;
  patchCircleOnly: boolean;
};

type ResolvedNodeRenderState = NodeRenderDefaults & {
  hidden: boolean;
  className?: string;
};

type ResolvedEdgeRenderState = EdgeRenderDefaults;

type PlaygroundDocument = "code" | "world" | "renderer" | "compiled";

let sensorDraftCounter = 0;

export class ScafiWebUiShell {
  private examples: ExampleGroup[] = [];
  private examplesError?: string;
  private editorDocument: EditorDocument = defaultEditorDocument;
  private configurationDraft: ConfigurationDraft = configurationToDraft(defaultConfiguration);
  private selectedExample = "";
  private selectedNodeIds: string[] = [];
  private visualization: VisualizationState = createDefaultVisualizationState();
  private dragState?: DragState;
  private viewportDragState?: ViewportDragState;
  private selectionBoxState?: SelectionBoxState;
  private graphProjection?: GraphProjection;
  private graphViewportSize: GraphViewportSize = { width: 860, height: 520 };
  private graphInteractionMode: GraphInteractionMode = "pan";
  private graphPan: Vec2 = { x: 0, y: 0 };
  private selectionPanelOpen = false;
  private visualizationSettingsOpen = false;
  private lastRenderedExecutionStatus: AppState["execution"]["status"] = "idle";
  private codeEditor?: EditorFromTextArea;
  private mountedDocument?: PlaygroundDocument;
  private mountedEditorMode?: EditorDocument["mode"];
  private easyScalaBuffer = defaultEditorDocument.code;
  private fullScalaBuffer = convertEasyScalaToFull(defaultEditorDocument.code);
  private activeEditorMode: EditorDocument["mode"] = defaultEditorDocument.mode;
  private activePlaygroundDocument: PlaygroundDocument = "code";
  private worldDocument = serializeWorldDocument(defaultConfiguration);
  private rendererDocument = defaultRendererDocument;
  private rendererDocumentError?: string;
  private rendererEvaluatorSource?: string;
  private rendererEvaluator?: RendererDocumentEvaluator | null;
  private nodeRenderer?: NodeRendererEvaluator;
  private edgeRenderer?: EdgeRendererEvaluator;
  private rendererDocumentDebounce?: number;
  private graphViewportSyncScheduled = false;
  private renderedGraphViewport?: GraphViewportState;
  private targetGraphViewport?: GraphViewportState;
  private graphViewportAnimationFrame?: number;
  private pendingLiveState?: AppState;
  private livePatchScheduled = false;
  private performanceMetrics: PerformanceMetrics = {
    windowStartedAt: 0,
    framesInWindow: 0,
    fps: 0,
    averageRenderMs: 0,
  };
  private theme: "dark" | "light" = "dark";

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {
    this.performanceMetrics.windowStartedAt = nowMs();
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  async mount(): Promise<void> {
    const configuration = this.app.loadPersistedConfiguration(defaultConfiguration);
    this.configurationDraft = configurationToDraft(configuration);
    this.editorDocument = this.app.loadPersistedEditor(defaultEditorDocument);
    this.initializeEditorBuffers();
    const persistedWorld = this.app.loadPersistedWorldDocument(serializeWorldDocument(configuration));
    this.worldDocument = persistedWorld;
    this.rendererDocument = this.app.loadPersistedRendererDocument(defaultRendererDocument);
    this.theme = this.app.loadPersistedTheme();
    this.applyTheme(this.theme);

    this.app.subscribe((event) => {
      if (event.type === "state-changed") {
        this.reconcileSelection();
        if (this.shouldPatchLiveState(event.state)) {
          this.scheduleLiveStatePatch(event.state);
          return;
        }
      }
      if (event.type === "examples-loaded") {
        this.examples = event.examples;
        this.examplesError = undefined;
      }
      this.render();
    });

    this.render();

    try {
      await this.app.loadExamples();
    } catch (error) {
      this.examplesError = stringifyError(error);
      this.render();
    }

    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("resize", () => {
      if (this.updateGraphViewportSize()) {
        this.render();
      }
    });
  }

  private applyTheme(theme: "dark" | "light"): void {
    this.theme = theme;
    document.documentElement.dataset.theme = theme;
    if (this.codeEditor) {
      this.codeEditor.setOption("theme", theme === "dark" ? "material" : "default");
    }
    const themeButton = this.root.querySelector<HTMLButtonElement>("#toggle-theme");
    if (themeButton) {
      themeButton.innerHTML = theme === "dark" ? iconSun() : iconMoon();
    }
  }

  private toggleTheme(): void {
    const next = this.theme === "dark" ? "light" : "dark";
    this.applyTheme(next);
    this.app.saveTheme(next);
  }

  private render(): void {
    const renderStartedAt = nowMs();
    this.pendingLiveState = undefined;
    this.livePatchScheduled = false;
    this.destroyCodeEditor();
    const state = this.app.store.getState();
    this.visualization = this.resolveVisualization(state);
    const graph = state.graph;
    const status = state.execution.status;
    const isLoaded = status === "ready" || status === "daemon";
    const hasSelection = this.selectedNodes(graph.nodes).length > 0;
    const selectionPanelVisible = hasSelection && this.selectionPanelOpen;

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="app-nav">
          <div class="brand-block">
            <p class="brand-mark">ScaFi</p>
            <div class="brand-lockup">
              <h1>Discover the power of the collective</h1>
            </div>
          </div>
          <div class="topbar-actions">
            <button id="toggle-theme" class="ghost-link icon-btn" type="button" title="Toggle theme">${this.theme === "dark" ? iconSun() : iconMoon()}</button>
            <a class="ghost-link" href="https://scafi.github.io/" target="_blank" rel="noreferrer">Website</a>
            <a class="ghost-link" href="https://github.com/scafi/scafi" target="_blank" rel="noreferrer">Repository</a>
            <a class="ghost-link" href="https://youtu.be/E-EoFmm5tuc" target="_blank" rel="noreferrer">Demo</a>
          </div>
        </header>

        <main class="workspace-grid">
          <div class="playground">
            <section class="panel panel-editor">
              <section class="panel-section panel-section-fill editor-pane">
                <div class="editor-pane-meta">
                  <div class="section-heading compact-section-heading">
                    <p class="section-kicker">Playground</p>
                  </div>
                  <div class="editor-tabbar" role="tablist" aria-label="Playground documents">
                    <button id="document-tab-code" class="editor-tab ${this.activePlaygroundDocument === "code" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.activePlaygroundDocument === "code")}">Code</button>
                    <button id="document-tab-world" class="editor-tab ${this.activePlaygroundDocument === "world" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.activePlaygroundDocument === "world")}">World</button>
                    <button id="document-tab-renderer" class="editor-tab ${this.activePlaygroundDocument === "renderer" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.activePlaygroundDocument === "renderer")}">Renderer (JS)</button>
                  </div>
                  <div class="toolbar-row compact-toolbar-row">
                    <label class="field compact-field">
                      <span>Examples</span>
                      <select id="example-select">
                        <option value="">Choose an example...</option>
                        ${this.renderExampleOptions()}
                      </select>
                    </label>
                    ${
                      this.activePlaygroundDocument === "code"
                        ? `<div class="field mode-field">
                            <span>Mode</span>
                            <fieldset class="mode-toggle">
                              <label>
                                <input type="radio" name="editor-mode" value="easy-scala" ${checked(this.activeEditorMode === "easy-scala")} />
                                <span>Basic</span>
                              </label>
                              <label>
                                <input type="radio" name="editor-mode" value="full-scala" ${checked(this.activeEditorMode === "full-scala")} />
                                <span>Advanced</span>
                              </label>
                            </fieldset>
                          </div>`
                        : ""
                    }
                  </div>
                  ${this.examplesError ? `<p class="inline-error">Examples fallback failed: ${escapeHtml(this.examplesError)}</p>` : ""}
                  ${
                    this.activePlaygroundDocument === "renderer"
                      ? `<div id="renderer-error-container">${this.rendererDocumentError ? `<p class="inline-error">Renderer JS error: ${escapeHtml(this.rendererDocumentError)}</p>` : ""}</div>`
                      : ""
                  }
                </div>
                <div class="editor-pane-body">
                  <div class="editor-surface">
                    <textarea id="code-editor" spellcheck="false">${escapeHtml(this.getActiveEditorText())}</textarea>
                  </div>
                </div>
              </section>
            </section>

            <section class="panel panel-visualization ${!isLoaded ? "viz-unloaded" : ""}">
              <section class="panel-section viz-top-section">
                <div class="viz-heading-row compact-viz-heading-row">
                  <div class="section-heading compact-section-heading">
                    <p class="section-kicker">Execution</p>
                  </div>
                  <div class="status-strip status-strip-inline">${this.renderStatusStrip(state)}</div>
                </div>
                <div class="viz-toolbar-strip">
                  <div class="viz-control-group viz-control-group-run">
                    <p class="control-card-title">Execution</p>
                    <div class="viz-inline-actions viz-inline-actions-run" role="group" aria-label="Execution commands">
                      <button id="load-script" class="primary icon-btn" ${disabled(status === "compiling")}>${iconPlay()} Load</button>
                      <button id="tick-once" class="icon-btn" ${disabled(!(status === "ready" || status === "daemon"))}>${iconSkipForward()} Tick</button>
                      <button id="start-daemon" class="icon-btn" ${disabled(status !== "ready")}>${iconPlay()} Start</button>
                      <button id="stop-daemon" class="icon-btn" ${disabled(status !== "daemon")}>${iconSquare()} Stop</button>
                    </div>
                  </div>
                  <div class="viz-control-group viz-control-group-speed">
                    <p class="control-card-title">Speed</p>
                    <div class="speed-cluster compact-speed-cluster" role="group" aria-label="Simulation speed">
                      ${this.renderSpeedOption("slow", 60)}
                      ${this.renderSpeedOption("normal", 30)}
                      ${this.renderSpeedOption("fast", 10)}
                    </div>
                  </div>
                  <div class="viz-control-group viz-control-group-graph">
                    <div class="viz-inline-actions graph-inline-actions">
                      <div class="interaction-toggle graph-mode-toggle" role="group" aria-label="Graph interaction mode">
                        <button id="interaction-pan" class="mode-chip icon-btn ${this.graphInteractionMode === "pan" ? "is-active" : ""}" type="button">${iconMove()} Pan</button>
                        <button id="interaction-selection" class="mode-chip icon-btn ${this.graphInteractionMode === "selection" ? "is-active" : ""}" type="button">${iconMousePointer()} Select</button>
                      </div>
                      <button id="toggle-selection-panel" class="ghost selection-panel-toggle icon-btn ${selectionPanelVisible ? "is-active" : ""}" type="button" ${disabled(!hasSelection)} aria-pressed="${String(selectionPanelVisible)}">${selectionPanelVisible ? `${iconEyeOff()} Hide` : `${iconEye()} Show`} inspector</button>
                      <button id="reset-view" class="ghost icon-btn" type="button">${iconRotateCcw()} Reset view</button>
                    </div>
                  </div>
                </div>
                ${this.visualizationSettingsOpen ? this.renderVisualizationSettings() : ""}
                <div class="viz-runtime-feedback">${this.renderRuntimeFeedback(state)}</div>
              </section>
              <section class="panel-section panel-section-tight panel-section-fill graph-pane">
                <div class="graph-workspace">
                  <div class="graph-main">
                    ${!isLoaded ? `<div class="viz-startup-overlay"><p>Press <strong>Load</strong> to start the simulation</p></div>` : ""}
                    <div class="graph-stage ${this.graphInteractionMode === "pan" ? "is-pan-mode" : "is-selection-mode"}" data-graph-stage>
                      ${graph.nodes.length > 0 ? this.renderGraph(state.graph.nodes, state.graph.edges) : `<div class="empty-graph">No nodes available for the current configuration.</div>`}
                    </div>
                    <aside class="selection-slot ${selectionPanelVisible ? "is-open" : ""}" data-selection-panel>${this.renderSelectionPanel(state)}</aside>
                  </div>
                </div>
              </section>
            </section>
          </div>
        </main>
      </div>
    `;

    this.lastRenderedExecutionStatus = status;
    this.attachListeners();
    this.scheduleGraphViewportAnimation();
    this.scheduleGraphViewportSync();
    this.recordUiUpdate(renderStartedAt);
  }

  private renderSelectionPanel(state: AppState): string {
    const selectedNodes = this.selectedNodes(state.graph.nodes);
    if (selectedNodes.length === 0 || !this.selectionPanelOpen) {
      return "";
    }
    const daemonRunning = state.execution.status === "daemon";
    return `
      <div class="selection-tray is-open">
        <div class="selection-tray-header">
          <div>
            <p class="section-kicker">Inspector</p>
            <h3>Selection</h3>
          </div>
          <div class="selection-tray-actions">
            <p class="muted">${selectedNodes.length} node${selectedNodes.length === 1 ? "" : "s"} selected</p>
            <div style="display: flex; gap: 8px;">
              <button id="inspector-start-daemon" class="ghost" type="button" ${disabled(state.execution.status !== "ready")}>${iconPlay()} Start</button>
              <button id="inspector-stop-daemon" class="ghost" type="button" ${disabled(state.execution.status !== "daemon")}>${iconSquare()} Stop</button>
              <button class="ghost selection-close" type="button" data-hide-selection-panel>Close</button>
            </div>
          </div>
        </div>
        <div class="selection-list">
          ${selectedNodes.map((node) => `<button class="selection-chip ${selectedNodes[0]?.id === node.id ? "is-active" : ""}" data-select-node="${escapeHtml(node.id)}">${escapeHtml(node.id)}</button>`).join("")}
        </div>
        ${this.renderInspector(selectedNodes, daemonRunning)}
      </div>
    `;
  }

  private renderStatusStrip(state: AppState): string {
    const status = state.execution.status;
    return `
      <span class="status-pill status-${status}">${escapeHtml(status)}</span>
      <span>generation ${state.execution.generation}</span>
      ${state.execution.daemonIntervalMs ? `<span>${state.execution.daemonIntervalMs} ms</span>` : ""}
      ${this.renderPerformanceBadge()}
    `;
  }

  private renderRuntimeFeedback(state: AppState): string {
    return state.execution.error ? `<p class="inline-error">${escapeHtml(state.execution.error)}</p>` : "";
  }

  private shouldPatchLiveState(state: AppState): boolean {
    const wasLive = this.lastRenderedExecutionStatus === "daemon" || this.lastRenderedExecutionStatus === "ready";
    const isLive = state.execution.status === "daemon" || state.execution.status === "ready";
    return wasLive && isLive && this.root.childElementCount > 0;
  }

  private patchLiveState(state: AppState): void {
    const renderStartedAt = nowMs();
    this.visualization = this.resolveVisualization(state);
    this.lastRenderedExecutionStatus = state.execution.status;
    this.root.querySelector<HTMLElement>(".status-strip")?.replaceChildren();
    const statusStrip = this.root.querySelector<HTMLElement>(".status-strip");
    if (statusStrip) {
      statusStrip.innerHTML = this.renderStatusStrip(state);
    }
    const runtimeFeedback = this.root.querySelector<HTMLElement>(".viz-runtime-feedback");
    if (runtimeFeedback) {
      runtimeFeedback.innerHTML = this.renderRuntimeFeedback(state);
    }
    
    const loadScriptBtn = this.root.querySelector<HTMLButtonElement>("#load-script");
    if (loadScriptBtn) loadScriptBtn.disabled = state.execution.status === "compiling";
    const tickOnceBtn = this.root.querySelector<HTMLButtonElement>("#tick-once");
    if (tickOnceBtn) tickOnceBtn.disabled = !(state.execution.status === "ready" || state.execution.status === "daemon");
    const startDaemonBtn = this.root.querySelector<HTMLButtonElement>("#start-daemon");
    if (startDaemonBtn) startDaemonBtn.disabled = state.execution.status !== "ready";
    const stopDaemonBtn = this.root.querySelector<HTMLButtonElement>("#stop-daemon");
    if (stopDaemonBtn) stopDaemonBtn.disabled = state.execution.status !== "daemon";

    let shouldRebindGraphListeners = false;
    const graphStage = this.root.querySelector<HTMLElement>("[data-graph-stage]");
    if (graphStage) {
      if (state.graph.nodes.length === 0) {
        graphStage.innerHTML = `<div class="empty-graph">No nodes available for the current configuration.</div>`;
        shouldRebindGraphListeners = true;
      } else if (!this.patchLiveGraphScene(state)) {
        graphStage.innerHTML = this.renderGraph(state.graph.nodes, state.graph.edges);
        shouldRebindGraphListeners = true;
      }
    }
    const selectionPanel = this.root.querySelector<HTMLElement>("[data-selection-panel]");
    if (selectionPanel && this.selectionPanelOpen) {
      this.patchSelectionPanel(state);
    }
    if (shouldRebindGraphListeners) {
      this.attachGraphListeners();
      this.attachSelectionListeners();
    }
    this.scheduleGraphViewportAnimation();
    this.recordUiUpdate(renderStartedAt);
  }

  private patchSelectionPanel(state: AppState): void {
    const selectedNodes = this.selectedNodes(state.graph.nodes);
    if (selectedNodes.length === 0) return;
    const primaryNode = selectedNodes[0];
    const isGroup = selectedNodes.length > 1;
    const consensus = this.buildSensorConsensus(selectedNodes);
    const exportValue = primaryNode.labels.export ?? null;
    const daemonRunning = state.execution.status === "daemon";

    const summaryEl = this.root.querySelector<HTMLElement>("[data-inspector-export-summary]");
    if (summaryEl) {
      summaryEl.textContent = summarizeInspectorValue(exportValue);
    }
    const previewEl = this.root.querySelector<HTMLElement>("[data-inspector-export-preview]");
    if (previewEl) {
      previewEl.textContent = formatInspectorJson(exportValue);
    }

    const inspectorStartDaemon = this.root.querySelector<HTMLButtonElement>("#inspector-start-daemon");
    if (inspectorStartDaemon) {
      inspectorStartDaemon.disabled = state.execution.status !== "ready";
    }
    const inspectorStopDaemon = this.root.querySelector<HTMLButtonElement>("#inspector-stop-daemon");
    if (inspectorStopDaemon) {
      inspectorStopDaemon.disabled = state.execution.status !== "daemon";
    }

    const moveX = this.root.querySelector<HTMLInputElement>("#move-x");
    if (moveX) {
      moveX.value = isGroup ? "0" : primaryNode.position.x.toFixed(2);
      moveX.disabled = daemonRunning;
    }
    const moveY = this.root.querySelector<HTMLInputElement>("#move-y");
    if (moveY) {
      moveY.value = isGroup ? "0" : primaryNode.position.y.toFixed(2);
      moveY.disabled = daemonRunning;
    }

    const moveBtn = this.root.querySelector<HTMLButtonElement>("#apply-move");
    if (moveBtn) {
      moveBtn.disabled = daemonRunning;
    }

    for (const entry of consensus) {
      const input = this.root.querySelector<HTMLInputElement>(
        `[data-runtime-sensor-input="${cssEscape(entry.name)}"]`,
      );
      if (!input) continue;
      input.disabled = daemonRunning;
      if (entry.mixed) {
        input.dataset.sensorMixed = "true";
        input.value = "";
        input.placeholder = "(mixed)";
      } else {
        delete input.dataset.sensorMixed;
        input.value = String(entry.value);
        input.placeholder = "";
      }
      const applyBtn = this.root.querySelector<HTMLButtonElement>(`[data-apply-sensor="${cssEscape(entry.name)}"]`);
      if (applyBtn) applyBtn.disabled = daemonRunning;
      const toggleBtn = this.root.querySelector<HTMLButtonElement>(`[data-toggle-runtime-sensor="${cssEscape(entry.name)}"]`);
      if (toggleBtn) toggleBtn.disabled = daemonRunning;
    }
  }

  private scheduleLiveStatePatch(state: AppState): void {
    this.pendingLiveState = state;
    if (this.livePatchScheduled) {
      return;
    }
    this.livePatchScheduled = true;
    window.requestAnimationFrame(() => {
      this.livePatchScheduled = false;
      const pendingState = this.pendingLiveState;
      this.pendingLiveState = undefined;
      if (pendingState) {
        this.patchLiveState(pendingState);
      }
    });
  }

  private renderPerformanceBadge(): string {
    const averageRenderMs = this.performanceMetrics.averageRenderMs;
    const fps = this.performanceMetrics.fps;
    return `<span class="perf-pill">ui ${averageRenderMs > 0 ? averageRenderMs.toFixed(1) : "--"} ms · ${fps > 0 ? Math.round(fps) : "--"} fps</span>`;
  }

  private recordUiUpdate(startedAt: number): void {
    const finishedAt = nowMs();
    const duration = Math.max(finishedAt - startedAt, 0);
    const metrics = this.performanceMetrics;
    metrics.averageRenderMs = metrics.averageRenderMs === 0 ? duration : metrics.averageRenderMs * 0.78 + duration * 0.22;
    metrics.framesInWindow += 1;
    const elapsed = finishedAt - metrics.windowStartedAt;
    if (elapsed >= 1000) {
      metrics.fps = (metrics.framesInWindow * 1000) / elapsed;
      metrics.framesInWindow = 0;
      metrics.windowStartedAt = finishedAt;
    }
  }

  private renderConfigurationForm(): string {
    const draft = this.configurationDraft;
    return `
      <div class="config-stack">
        <label class="field">
          <span>Displacement</span>
          <select id="network-kind">
            <option value="grid" ${selected(draft.networkKind === "grid")}>grid</option>
            <option value="random" ${selected(draft.networkKind === "random")}>random</option>
          </select>
        </label>

        <div class="config-grid ${draft.networkKind === "grid" ? "" : "is-hidden"}" id="grid-fields">
          ${numberField("Rows", "config-rows", draft.rows)}
          ${numberField("Cols", "config-cols", draft.cols)}
          ${numberField("Step X", "config-step-x", draft.stepX)}
          ${numberField("Step Y", "config-step-y", draft.stepY)}
          ${numberField("Tolerance", "config-tolerance", draft.tolerance)}
        </div>

        <div class="config-grid ${draft.networkKind === "random" ? "" : "is-hidden"}" id="random-fields">
          ${numberField("Min", "config-min", draft.min)}
          ${numberField("Max", "config-max", draft.max)}
          ${numberField("How many", "config-how-many", draft.howMany)}
        </div>

        ${numberField("Neighbour radius", "config-radius", draft.radius)}

        <div class="matrix-card">
          <h3>LED matrix</h3>
          <div class="config-grid">
            ${textField("Color", "matrix-color", draft.matrixColor)}
            ${numberField("Dimension", "matrix-dimension", draft.matrixDimension)}
          </div>
        </div>

        <div class="sensor-card">
          <div class="inline-heading">
            <h3>Sensors</h3>
            <button id="add-sensor" class="ghost" type="button">Add sensor</button>
          </div>
          <div class="sensor-list">
            ${draft.sensors
              .map(
                (sensor) => `
                  <div class="sensor-row">
                    <input data-sensor-name-id="${sensor.id}" type="text" value="${escapeHtml(sensor.name)}" placeholder="name" />
                    <input data-sensor-value-id="${sensor.id}" type="text" value="${escapeHtml(sensor.value)}" placeholder="value" />
                    <button class="danger" type="button" data-remove-sensor="${sensor.id}">Remove</button>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>

        <button id="apply-configuration" class="primary" type="button">Load configuration</button>
      </div>
    `;
  }

  private renderExampleOptions(): string {
    return this.examples
      .map(
        (group) => `
          <optgroup label="${escapeHtml(group.groupName)}">
            ${group.examples
              .map(
                (example) => `<option value="${escapeHtml(example.name)}" ${selected(this.selectedExample === example.name)}>${escapeHtml(example.name)}</option>`,
              )
              .join("")}
          </optgroup>
        `,
      )
      .join("");
  }

  private renderVisualizationSettings(): string {
    const visibleSensors = Array.from(this.visualization.visibleSensors);
    return `
      <div class="settings-tray">
        <div class="settings-group settings-group-wide">
          <p class="settings-group-title">Renderer (JavaScript)</p>
          <p class="control-card-summary">Use the Renderer tab to script node size, visible sensors, and renderers in JavaScript instead of enabling or disabling UI toggles.</p>
          <div class="viz-inline-actions">
            <button id="open-renderer-document" class="ghost" type="button">Open Renderer (JS)</button>
          </div>
          <p class="control-card-summary">Current node size: ${this.visualization.nodeSize}px · font size: ${this.visualization.fontSize}px</p>
          <p class="control-card-summary">Active renderers: ${escapeHtml(summarizeActiveRenderers(this.visualization))}</p>
          <p class="control-card-summary">Visible sensors: ${visibleSensors.length > 0 ? escapeHtml(visibleSensors.join(", ")) : "none"}</p>
        </div>
      </div>
    `;
  }

  private renderSpeedOption(label: "slow" | "normal" | "fast", intervalMs: number): string {
    const active = this.app.store.getState().execution.daemonIntervalMs === intervalMs;
    return `<button class="speed-pill ${active ? "is-active" : ""}" data-speed="${intervalMs}">${label}</button>`;
  }

  private renderGraph(nodes: GraphNode[], edges: Array<{ from: string; to: string }>): string {
    const viewport = this.resolveGraphViewportState(nodes);
    const projection = viewport.projection;
    const renderProfile = this.resolveGraphRenderProfile(this.app.store.getState().execution.status, nodes.length);

    const edgeMarkup = edges
      .map((edge, index) => {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        if (!from || !to) {
          return "";
        }
        const fromPoint = projectPoint(from.position, projection);
        const toPoint = projectPoint(to.position, projection);
        const edgeState = this.resolveEdgeRenderState(edge, from, to, renderProfile.visualization);
        return `<line class="${escapeHtml(edgeState.className)}" ${edgeState.hidden ? 'display="none" ' : ""}${
          edgeState.stroke ? `stroke="${escapeHtml(edgeState.stroke)}" ` : ""
        }${edgeState.strokeWidth !== undefined ? `stroke-width="${edgeState.strokeWidth}" ` : ""}${
          edgeState.strokeOpacity !== undefined ? `stroke-opacity="${edgeState.strokeOpacity}" ` : ""
        }data-edge-key="${escapeHtml(edge.from)}->${escapeHtml(edge.to)}" data-edge-index="${index}" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}" />`;
      })
      .join("");

    const nodeMarkup = nodes
      .map((node, index) => {
        const point = projectPoint(node.position, projection);
        const nodeRenderState = this.resolveNodeRenderState(node, edges, nodes.length, index, renderProfile.visualization);
        return `
          <g class="graph-node ${this.selectedNodeIds.includes(node.id) ? "is-selected" : ""} ${escapeHtml(nodeRenderState.className ?? "")}" ${
            nodeRenderState.hidden ? 'display="none" aria-hidden="true"' : ""
          } data-node-id="${escapeHtml(node.id)}" transform="translate(${point.x}, ${point.y})">
            ${this.renderGraphNodeContent(node, renderProfile.visualization, nodeRenderState)}
          </g>
        `;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${projection.width} ${projection.height}" class="graph-svg" data-render-profile="${renderProfile.key}" aria-label="Simulation graph">
        <rect x="0" y="0" width="${projection.width}" height="${projection.height}" rx="26" class="graph-surface" />
        <g class="graph-viewport" transform="translate(${this.graphPan.x} ${this.graphPan.y})">
          ${edgeMarkup}
          ${nodeMarkup}
        </g>
        ${this.renderSelectionBox()}
      </svg>
    `;
  }

  private renderSelectionBox(): string {
    const rect = this.currentSelectionRect();
    if (!rect) {
      return '<rect class="selection-box is-hidden" data-selection-box x="0" y="0" width="0" height="0" />';
    }
    return `<rect class="selection-box" data-selection-box x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" />`;
  }

  private resolveGraphEdgeClass(
    edge: { from: string; to: string },
    visualization: VisualizationState,
  ): string {
    if (!visualization.showNeighborhood || this.selectedNodeIds.length === 0) {
      return "graph-edge";
    }
    return this.selectedNodeIds.includes(edge.from) || this.selectedNodeIds.includes(edge.to)
      ? "graph-edge is-neighborhood"
      : "graph-edge is-muted";
  }

  private resolveEdgeRenderState(
    edge: { from: string; to: string },
    fromNode: GraphNode,
    toNode: GraphNode,
    visualization: VisualizationState,
  ): ResolvedEdgeRenderState {
    const defaults: EdgeRenderDefaults = {
      hidden: false,
      className: this.resolveGraphEdgeClass(edge, visualization),
    };
    if (!this.edgeRenderer) {
      return defaults;
    }
    try {
      const output = this.edgeRenderer({
        edge,
        fromNode,
        toNode,
        graph: this.app.store.getState().graph,
        execution: this.app.store.getState().execution,
        selectedNodeIds: [...this.selectedNodeIds],
        isNeighborhood: this.selectedNodeIds.includes(edge.from) || this.selectedNodeIds.includes(edge.to),
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
      this.rendererDocumentError = stringifyError(error);
      return defaults;
    }
  }

  private resolveNodeRenderState(
    node: GraphNode,
    edges: Array<{ from: string; to: string }>,
    totalNodes: number,
    nodeIndex: number,
    visualization: VisualizationState,
  ): ResolvedNodeRenderState {
    const selectedNode = this.selectedNodeIds.includes(node.id);
    const labels = buildNodeLabels(node, edges, visualization, selectedNode, totalNodes, nodeIndex);
    const nodeVisual = computeNodeVisual(node, visualization, selectedNode);
    const defaults: NodeRenderDefaults = {
      fill: nodeVisual.fill,
      fillOpacity: nodeVisual.fillOpacity,
      stroke: nodeVisual.stroke,
      strokeWidth: nodeVisual.strokeWidth,
      nodeSize: visualization.nodeSize,
      fontSize: visualization.fontSize,
      labels,
      renderMatrix: visualization.renderMatrix,
      renderBooleans: visualization.renderBooleans,
      renderGradient: visualization.renderGradient,
      renderExportEffect: visualization.renderExportEffect,
      overlays: [],
    };
    if (!this.nodeRenderer) {
      return { ...defaults, hidden: false };
    }
    try {
      const output: NodeRenderOutput | void = this.nodeRenderer({
        node,
        graph: this.app.store.getState().graph,
        execution: this.app.store.getState().execution,
        selected: selectedNode,
        nodeIndex,
        totalNodes,
        incidentEdges: edges.filter((edge) => edge.from === node.id || edge.to === node.id),
        availableSensors: Array.from(visualization.visibleSensors),
        defaults,
      });
      const renderGradient = typeof output?.renderGradient === "boolean" ? output.renderGradient : defaults.renderGradient;
      const renderExportEffect =
        typeof output?.renderExportEffect === "boolean" ? output.renderExportEffect : defaults.renderExportEffect;
      const resolvedVisual = computeNodeVisual(
        node,
        {
          ...visualization,
          renderGradient,
          renderExportEffect,
        },
        selectedNode,
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
      this.rendererDocumentError = stringifyError(error);
      return { ...defaults, hidden: false };
    }
  }

  private renderInspector(selectedNodes: GraphNode[], disabled: boolean): string {
    const primaryNode = selectedNodes[0];
    const sensorConsensus = this.buildSensorConsensus(selectedNodes);
    const exportValue = primaryNode.labels.export ?? null;
    const isGroup = selectedNodes.length > 1;
    const moveLabel = isGroup ? "ΔX" : "X";
    const moveLabelY = isGroup ? "ΔY" : "Y";
    const moveDefault = isGroup ? 0 : Number(primaryNode.position.x.toFixed(2));
    const moveDefaultY = isGroup ? 0 : Number(primaryNode.position.y.toFixed(2));
    return `
      <div class="inspector-stack">
        <div class="inspector-card inspector-card-export">
          <div class="selection-node-header">
            <div>
              <p class="section-kicker">Node</p>
              <h3>${escapeHtml(primaryNode.id)}</h3>
            </div>
            <p class="muted">${selectedNodes.length} node${selectedNodes.length === 1 ? "" : "s"} selected${selectedNodes.length > 1 ? ` — showing ${escapeHtml(primaryNode.id)}` : ""}</p>
          </div>
          <div class="export-callout">
            <span class="export-callout-label">Current output</span>
            <p class="export-summary" data-inspector-export-summary>${escapeHtml(summarizeInspectorValue(exportValue))}</p>
          </div>
          <pre class="export-preview" data-inspector-export-preview>${escapeHtml(formatInspectorJson(exportValue))}</pre>
        </div>

        <div class="inspector-card">
          <div class="inline-heading">
            <h3>Move</h3>
            <span class="muted">${isGroup ? "delta to selection" : "selection transform"}</span>
          </div>
          <div class="config-grid compact-grid">
            <label class="field"><span>${escapeHtml(moveLabel)}</span><input id="move-x" type="number" value="${moveDefault}" ${disabled ? "disabled" : ""} /></label>
            <label class="field"><span>${escapeHtml(moveLabelY)}</span><input id="move-y" type="number" value="${moveDefaultY}" ${disabled ? "disabled" : ""} /></label>
          </div>
          <button id="apply-move" class="primary" type="button" ${disabled ? "disabled" : ""}>Move selection</button>
        </div>

        <div class="inspector-card">
          <div class="inline-heading">
            <h3>Sensors</h3>
            <span class="muted">apply to selection</span>
          </div>
          ${sensorConsensus.length > 0 ? sensorConsensus.map((entry) => this.renderSensorEditor(entry.name, entry.value, entry.mixed, disabled)).join("") : `<p class="muted">No scalar sensors available.</p>`}
        </div>

      </div>
    `;
  }

  private buildSensorConsensus(selectedNodes: GraphNode[]): Array<{ name: string; value: unknown; mixed: boolean }> {
    const seen = new Set<string>();
    const result: Array<{ name: string; value: unknown; mixed: boolean }> = [];
    for (const node of selectedNodes) {
      for (const [label, value] of Object.entries(node.labels)) {
        if (label === "export" || label === "matrix") continue;
        if (seen.has(label)) continue;
        seen.add(label);
        const allSame = selectedNodes.every((other) => other.labels[label] === value);
        result.push({ name: label, value: allSame ? value : undefined, mixed: !allSame });
      }
    }
    return result;
  }

  private renderSensorEditor(name: string, value: unknown, mixed = false, disabled = false): string {
    const displayValue = mixed ? "" : String(value);
    const isBoolean = typeof value === "boolean" && !mixed;
    const mixedAttr = mixed ? ' data-sensor-mixed="true"' : "";
    return `
      <div class="sensor-editor">
        <label class="field grow-field">
          <span>${escapeHtml(name)}${mixed ? ` <small class="sensor-mixed-hint">(mixed)</small>` : ""}</span>
          <input data-runtime-sensor-input="${escapeHtml(name)}"${mixedAttr} type="text" value="${escapeHtml(displayValue)}" placeholder="${mixed ? "(mixed)" : ""}" ${disabled ? "disabled" : ""} />
        </label>
        <button class="ghost" type="button" data-apply-sensor="${escapeHtml(name)}" ${disabled ? "disabled" : ""}>Apply</button>
        ${isBoolean ? `<button class="ghost" type="button" data-toggle-runtime-sensor="${escapeHtml(name)}" ${disabled ? "disabled" : ""}>Toggle</button>` : ""}
      </div>
    `;
  }

  private renderGraphNodeContent(
    node: GraphNode,
    visualization: VisualizationState,
    nodeRenderState: ResolvedNodeRenderState,
  ): string {
    const selectedNode = this.selectedNodeIds.includes(node.id);
    const effectiveVisualization: VisualizationState = {
      ...visualization,
      nodeSize: nodeRenderState.nodeSize,
      fontSize: nodeRenderState.fontSize,
      renderMatrix: nodeRenderState.renderMatrix,
      renderBooleans: nodeRenderState.renderBooleans,
    };
    const booleanBadges =
      nodeRenderState.renderBooleans && shouldRenderBooleanBadges(this.app.store.getState().graph.nodes.length, selectedNode)
        ? renderBooleanBadges(node, effectiveVisualization, this.app.store.getState().graph.nodes.length, selectedNode)
        : "";
    const matrixOverlay = nodeRenderState.renderMatrix
      ? renderMatrixOverlay(node, effectiveVisualization, this.app.store.getState().graph.nodes.length, selectedNode)
      : "";
    const customOverlays = renderNodeOverlays(nodeRenderState.overlays, nodeRenderState);
    return `
      <circle r="${nodeRenderState.nodeSize}" fill="${escapeHtml(nodeRenderState.fill)}" fill-opacity="${nodeRenderState.fillOpacity}" stroke="${escapeHtml(nodeRenderState.stroke)}" stroke-width="${nodeRenderState.strokeWidth}" />
      ${matrixOverlay}
      ${booleanBadges}
      ${customOverlays}
      ${nodeRenderState.labels.length > 0 ? `<text class="graph-node-label" y="${nodeRenderState.nodeSize + nodeRenderState.fontSize + 6}" style="font-size:${nodeRenderState.fontSize}px">${escapeHtml(nodeRenderState.labels.join(" · "))}</text>` : ""}
    `;
  }

  private attachListeners(): void {
    this.bindButton("toggle-theme", () => {
      this.toggleTheme();
    });
    this.bindButton("toggle-settings", () => {
      this.visualizationSettingsOpen = !this.visualizationSettingsOpen;
      this.render();
    });
    this.bindButton("reset-view", () => {
      this.graphPan = { x: 0, y: 0 };
      this.render();
    });
    this.bindButton("toggle-selection-panel", () => {
      if (this.selectedNodeIds.length === 0) {
        return;
      }
      this.selectionPanelOpen = !this.selectionPanelOpen;
      this.render();
    });
    this.bindButton("interaction-pan", () => {
      this.graphInteractionMode = "pan";
      this.dragState = undefined;
      this.selectionBoxState = undefined;
      this.selectedNodeIds = [];
      this.selectionPanelOpen = false;
      this.render();
    });
    this.bindButton("interaction-selection", () => {
      this.graphInteractionMode = "selection";
      this.viewportDragState = undefined;
      this.selectionBoxState = undefined;
      this.render();
    });
    this.bindButton("document-tab-code", () => {
      this.activePlaygroundDocument = "code";
      this.render();
    });
    this.bindButton("document-tab-world", () => {
      this.activePlaygroundDocument = "world";
      this.render();
    });
    this.bindButton("document-tab-renderer", () => {
      this.activePlaygroundDocument = "renderer";
      this.render();
    });
    this.attachCodeEditor();
    this.bindSelect("example-select", (value) => {
      this.selectedExample = value;
      if (!value) {
        return;
      }
      const example = this.findExample(value);
      if (!example) {
        return;
      }
      this.destroyCodeEditor();
      this.easyScalaBuffer = example.body;
      this.fullScalaBuffer = convertEasyScalaToFull(example.body);
      this.activeEditorMode = "easy-scala";
      this.editorDocument = { code: this.easyScalaBuffer, mode: "easy-scala" };
      const exampleConfiguration = buildExampleConfiguration(example);
      this.configurationDraft = configurationToDraft(exampleConfiguration);
      this.worldDocument = example.world ?? serializeWorldDocument(exampleConfiguration);
      this.rendererDocument = example.renderer ?? defaultRendererDocument;
      this.rendererDocumentError = undefined;
      this.invalidateRendererEvaluator();
      this.app.saveWorldDocument(this.worldDocument);
      this.app.saveRendererDocument(this.rendererDocument);
      this.app.evolve(exampleConfiguration);
      this.app.resetExecution();
      this.app.saveEditor(this.editorDocument);
      this.render();
    });

    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[name="editor-mode"]')) {
      input.addEventListener("change", () => {
        this.switchEditorMode(input.value as EditorDocument["mode"]);
      });
    }

    this.bindButton("load-script", async () => {
      await this.app.loadScript(this.editorDocument, this.worldDocument);
    });
    this.bindButton("open-renderer-document", () => {
      this.activePlaygroundDocument = "renderer";
      this.visualizationSettingsOpen = false;
      this.render();
    });
    this.bindButton("tick-once", () => this.app.tick());
    this.bindButton("start-daemon", () => {
      const selectedSpeed = this.root.querySelector<HTMLButtonElement>(".speed-pill.is-active")?.dataset.speed;
      this.app.startDaemon(Number(selectedSpeed ?? 90));
    });
    this.bindButton("stop-daemon", () => this.app.stopDaemon());

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-speed]")) {
      button.addEventListener("click", () => {
        const intervalMs = Number(button.dataset.speed);
        this.root.querySelectorAll(".speed-pill").forEach((element) => element.classList.remove("is-active"));
        button.classList.add("is-active");
        if (this.app.store.getState().execution.status === "daemon") {
          this.app.startDaemon(intervalMs);
        }
      });
    }

    this.bindSelect("network-kind", (value) => {
      this.configurationDraft.networkKind = value as ConfigurationDraft["networkKind"];
      this.render();
    });

    this.bindNumber("config-rows", (value) => {
      this.configurationDraft.rows = value;
    });
    this.bindNumber("config-cols", (value) => {
      this.configurationDraft.cols = value;
    });
    this.bindNumber("config-step-x", (value) => {
      this.configurationDraft.stepX = value;
    });
    this.bindNumber("config-step-y", (value) => {
      this.configurationDraft.stepY = value;
    });
    this.bindNumber("config-tolerance", (value) => {
      this.configurationDraft.tolerance = value;
    });
    this.bindNumber("config-min", (value) => {
      this.configurationDraft.min = value;
    });
    this.bindNumber("config-max", (value) => {
      this.configurationDraft.max = value;
    });
    this.bindNumber("config-how-many", (value) => {
      this.configurationDraft.howMany = value;
    });
    this.bindNumber("config-radius", (value) => {
      this.configurationDraft.radius = value;
    });
    this.bindText("matrix-color", (value) => {
      this.configurationDraft.matrixColor = value;
    });
    this.bindNumber("matrix-dimension", (value) => {
      this.configurationDraft.matrixDimension = value;
    });
    this.bindButton("add-sensor", () => {
      this.configurationDraft.sensors.push(newSensorDraft());
      this.render();
    });
    for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-sensor-name-id]")) {
      input.addEventListener("input", () => {
        const target = this.configurationDraft.sensors.find((sensor) => sensor.id === input.dataset.sensorNameId);
        if (target) {
          target.name = input.value;
        }
      });
    }
    for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-sensor-value-id]")) {
      input.addEventListener("input", () => {
        const target = this.configurationDraft.sensors.find((sensor) => sensor.id === input.dataset.sensorValueId);
        if (target) {
          target.value = input.value;
        }
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-remove-sensor]")) {
      button.addEventListener("click", () => {
        this.configurationDraft.sensors = this.configurationDraft.sensors.filter(
          (sensor) => sensor.id !== button.dataset.removeSensor,
        );
        this.render();
      });
    }
    this.bindButton("apply-configuration", () => {
      const configuration = draftToConfiguration(this.configurationDraft);
      this.syncWorldDocumentFromConfiguration(configuration);
      this.app.evolve(configuration);
    });

    this.attachGraphListeners();
    this.attachSelectionListeners();
  }

  private attachGraphListeners(): void {
    const graphStage = this.root.querySelector<HTMLElement>("[data-graph-stage]");
    graphStage?.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest(".graph-node")) {
        return;
      }
      if (this.graphInteractionMode === "pan") {
        event.preventDefault();
        this.viewportDragState = {
          startClientX: event.clientX,
          startClientY: event.clientY,
          originalPan: { ...this.graphPan },
        };
        graphStage.classList.add("is-dragging");
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

    for (const nodeElement of this.root.querySelectorAll<SVGGElement>(".graph-node")) {
      nodeElement.addEventListener("click", (event) => {
        if (this.graphInteractionMode !== "selection") {
          return;
        }
        const nodeId = nodeElement.dataset.nodeId;
        if (!nodeId) {
          return;
        }
        if ((event as MouseEvent).shiftKey) {
          this.selectedNodeIds = this.selectedNodeIds.includes(nodeId)
            ? this.selectedNodeIds.filter((id) => id !== nodeId)
            : [...this.selectedNodeIds, nodeId];
        } else {
          this.selectedNodeIds = [nodeId];
        }
        this.render();
      });
      nodeElement.addEventListener("pointerdown", (event) => {
        if (this.graphInteractionMode !== "selection") {
          return;
        }
        const nodeId = nodeElement.dataset.nodeId;
        if (!nodeId) {
          return;
        }
        event.preventDefault();
        if (!this.selectedNodeIds.includes(nodeId)) {
          this.selectedNodeIds = event.shiftKey ? [...this.selectedNodeIds, nodeId] : [nodeId];
          this.render();
        }
        const positions = Object.fromEntries(
          this.selectedNodes(this.app.store.getState().graph.nodes).map((node) => [node.id, { ...node.position }]),
        );
        this.dragState = {
          nodeIds: [...this.selectedNodeIds],
          startClientX: event.clientX,
          startClientY: event.clientY,
          originalPositions: positions,
        };
      });
    }
  }

  private attachSelectionListeners(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-select-node]")) {
      button.addEventListener("click", () => {
        const nodeId = button.dataset.selectNode;
        if (nodeId) {
          this.selectedNodeIds = [nodeId];
          this.render();
        }
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-clear-selection]")) {
      button.addEventListener("click", () => {
        this.selectedNodeIds = [];
        this.selectionPanelOpen = false;
        this.render();
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-hide-selection-panel]")) {
      button.addEventListener("click", () => {
        this.selectionPanelOpen = false;
        this.render();
      });
    }

    this.bindButton("inspector-start-daemon", () => {
      const selectedSpeed = this.root.querySelector<HTMLButtonElement>(".speed-pill.is-active")?.dataset.speed;
      this.app.startDaemon(Number(selectedSpeed ?? 90));
    });
    this.bindButton("inspector-stop-daemon", () => this.app.stopDaemon());

    this.bindButton("apply-move", () => {
      const x = Number((this.root.querySelector<HTMLInputElement>("#move-x")?.value ?? "0").trim());
      const y = Number((this.root.querySelector<HTMLInputElement>("#move-y")?.value ?? "0").trim());
      if (this.selectedNodeIds.length > 1) {
        const nodes = this.selectedNodes(this.app.store.getState().graph.nodes);
        const positionMap: Record<string, Vec2> = {};
        for (const node of nodes) {
          positionMap[node.id] = { x: node.position.x + x, y: node.position.y + y };
        }
        this.app.moveNodes(positionMap);
      } else if (this.selectedNodeIds.length === 1) {
        const nodeId = this.selectedNodeIds[0];
        this.app.moveNodes({ [nodeId]: { x, y } });
      }
    });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-apply-sensor]")) {
      button.addEventListener("click", () => {
        const sensorName = button.dataset.applySensor;
        if (!sensorName) {
          return;
        }
        const input = this.root.querySelector<HTMLInputElement>(`[data-runtime-sensor-input="${cssEscape(sensorName)}"]`);
        if (!input || this.selectedNodeIds.length === 0) {
          return;
        }
        this.app.changeSensor(sensorName, this.selectedNodeIds, parseRuntimeValue(input.value));
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-toggle-runtime-sensor]")) {
      button.addEventListener("click", () => {
        const sensorName = button.dataset.toggleRuntimeSensor;
        if (sensorName && this.selectedNodeIds.length > 0) {
          this.app.toggleSensor(sensorName, this.selectedNodeIds);
        }
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
        this.renderedGraphViewport = {
          ...this.renderedGraphViewport,
          pan: { ...this.graphPan },
        };
      }
      if (this.targetGraphViewport) {
        this.targetGraphViewport = {
          ...this.targetGraphViewport,
          pan: { ...this.graphPan },
        };
      }
      this.root
        .querySelector<SVGGElement>(".graph-viewport")
        ?.setAttribute("transform", `translate(${this.graphPan.x} ${this.graphPan.y})`);
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
    this.app.moveNodes(movedPositions);
  }

  private onPointerUp(): void {
    this.root.querySelector<HTMLElement>("[data-graph-stage]")?.classList.remove("is-dragging");
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
    if (!rect || !this.graphProjection) {
      if (!this.selectionBoxState?.additive) {
        this.selectedNodeIds = [];
        this.selectionPanelOpen = false;
        this.render();
      }
      return;
    }
    const nextSelection = this.app.store
      .getState()
      .graph.nodes.filter((node) => {
        const projected = projectPoint(node.position, this.graphProjection as GraphProjection);
        const x = projected.x + this.graphPan.x;
        const y = projected.y + this.graphPan.y;
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
      })
      .map((node) => node.id);
    const isClick = rect.width < 4 && rect.height < 4;
    if (isClick && !this.selectionBoxState?.additive) {
      this.selectedNodeIds = [];
      this.selectionPanelOpen = false;
      this.render();
      return;
    }
    this.selectedNodeIds = this.selectionBoxState?.additive
      ? Array.from(new Set([...this.selectedNodeIds, ...nextSelection]))
      : nextSelection;
    if (this.selectedNodeIds.length === 0) {
      this.selectionPanelOpen = false;
    }
    this.render();
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
    const graphStage = this.root.querySelector<HTMLElement>("[data-graph-stage]");
    if (!graphStage || !this.graphProjection) {
      return undefined;
    }
    const bounds = graphStage.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return undefined;
    }
    return {
      x: ((clientX - bounds.left) / bounds.width) * this.graphProjection.width,
      y: ((clientY - bounds.top) / bounds.height) * this.graphProjection.height,
    };
  }

  private updateSelectionBoxVisual(): void {
    const selectionBox = this.root.querySelector<SVGRectElement>("[data-selection-box]");
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

  private scheduleGraphViewportSync(): void {
    if (this.graphViewportSyncScheduled) {
      return;
    }
    this.graphViewportSyncScheduled = true;
    window.requestAnimationFrame(() => {
      this.graphViewportSyncScheduled = false;
      if (this.updateGraphViewportSize()) {
        this.render();
      }
    });
  }

  private updateGraphViewportSize(): boolean {
    const graphStage = this.root.querySelector<HTMLElement>("[data-graph-stage]");
    if (!graphStage) {
      return false;
    }
    const bounds = graphStage.getBoundingClientRect();
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

  private resolveGraphViewportState(nodes: GraphNode[]): GraphViewportState {
    const labelPadding = this.visualization.renderText
      ? this.visualization.nodeSize + this.visualization.fontSize * 2
      : this.visualization.nodeSize * 2;
    const targetViewport = resolveGraphViewport(nodes, this.graphViewportSize, labelPadding, this.graphPan, {
      clampPan: this.graphInteractionMode !== "pan" || Boolean(this.dragState),
    });
    const viewport = this.resolveRenderedGraphViewport(targetViewport);
    this.graphProjection = viewport.projection;
    this.graphPan = viewport.pan;
    return viewport;
  }

  private patchLiveGraphScene(state: AppState): boolean {
    if (this.nodeRenderer || this.edgeRenderer) {
      return false;
    }
    const graphSvg = this.root.querySelector<SVGSVGElement>(".graph-svg");
    const graphSurface = this.root.querySelector<SVGRectElement>(".graph-surface");
    const graphViewport = this.root.querySelector<SVGGElement>(".graph-viewport");
    const edgeElements = Array.from(this.root.querySelectorAll<SVGLineElement>(".graph-edge"));
    const nodeElements = Array.from(this.root.querySelectorAll<SVGGElement>(".graph-node"));
    if (!graphSvg || !graphSurface || !graphViewport || edgeElements.length !== state.graph.edges.length || nodeElements.length !== state.graph.nodes.length) {
      return false;
    }

    const viewport = this.resolveGraphViewportState(state.graph.nodes);
    const projection = viewport.projection;
    const renderProfile = this.resolveGraphRenderProfile(state.execution.status, state.graph.nodes.length);
    if (graphSvg.dataset.renderProfile !== renderProfile.key) {
      return false;
    }
    const nodesById = new Map(state.graph.nodes.map((node) => [node.id, node]));
    const nodeIndices = new Map(state.graph.nodes.map((node, index) => [node.id, index]));

    graphSvg.setAttribute("viewBox", `0 0 ${projection.width} ${projection.height}`);
    graphSurface.setAttribute("width", String(projection.width));
    graphSurface.setAttribute("height", String(projection.height));
    graphViewport.setAttribute("transform", `translate(${viewport.pan.x} ${viewport.pan.y})`);

    for (const [index, edge] of state.graph.edges.entries()) {
      const edgeElement = edgeElements[index];
      const edgeKey = `${edge.from}->${edge.to}`;
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      if (!edgeElement || edgeElement.dataset.edgeKey !== edgeKey || !from || !to) {
        return false;
      }
      const fromPoint = projectPoint(from.position, projection);
      const toPoint = projectPoint(to.position, projection);
      edgeElement.setAttribute("class", this.resolveGraphEdgeClass(edge, renderProfile.visualization));
      edgeElement.setAttribute("x1", String(fromPoint.x));
      edgeElement.setAttribute("y1", String(fromPoint.y));
      edgeElement.setAttribute("x2", String(toPoint.x));
      edgeElement.setAttribute("y2", String(toPoint.y));
    }

    for (const nodeElement of nodeElements) {
      const nodeId = nodeElement.dataset.nodeId;
      if (!nodeId) {
        return false;
      }
      const node = nodesById.get(nodeId);
      const nodeIndex = nodeIndices.get(nodeId);
      if (!node || nodeIndex === undefined) {
        return false;
      }
      const point = projectPoint(node.position, projection);
      nodeElement.classList.toggle("is-selected", this.selectedNodeIds.includes(nodeId));
      nodeElement.setAttribute("transform", `translate(${point.x}, ${point.y})`);
      if (renderProfile.patchCircleOnly) {
        if (!this.patchGraphNodeCircle(nodeElement, node, renderProfile.visualization)) {
          return false;
        }
      } else {
        const nodeRenderState = this.resolveNodeRenderState(
          node,
          state.graph.edges,
          state.graph.nodes.length,
          nodeIndex,
          renderProfile.visualization,
        );
        nodeElement.innerHTML = this.renderGraphNodeContent(
          node,
          renderProfile.visualization,
          nodeRenderState,
        );
      }
    }
    return true;
  }

  private resolveGraphRenderProfile(
    executionStatus: AppState["execution"]["status"],
    totalNodes: number,
  ): GraphRenderProfile {
    const compact = executionStatus === "daemon" && totalNodes >= 324;
    if (this.nodeRenderer || this.edgeRenderer) {
      return {
        key: "full-custom",
        visualization: this.visualization,
        patchCircleOnly: false,
      };
    }
    if (!compact) {
      return {
        key: "full",
        visualization: this.visualization,
        patchCircleOnly: false,
      };
    }
    const keepMatrixOverlay = this.visualization.renderMatrix;
    return {
      key: keepMatrixOverlay ? "compact-matrix" : "compact",
      visualization: {
        ...this.visualization,
        renderText: false,
        renderBooleans: false,
        showNeighborhood: false,
      },
      patchCircleOnly: !keepMatrixOverlay,
    };
  }

  private patchGraphNodeCircle(nodeElement: SVGGElement, node: GraphNode, visualization: VisualizationState): boolean {
    const circle = nodeElement.querySelector<SVGCircleElement>("circle");
    if (!circle) {
      return false;
    }
    const nodeVisual = computeNodeVisual(node, visualization, this.selectedNodeIds.includes(node.id));
    circle.setAttribute("r", String(visualization.nodeSize));
    circle.setAttribute("fill", nodeVisual.fill);
    circle.setAttribute("fill-opacity", String(nodeVisual.fillOpacity));
    circle.setAttribute("stroke", nodeVisual.stroke);
    circle.setAttribute("stroke-width", String(nodeVisual.strokeWidth));
    if (nodeElement.childElementCount !== 1) {
      nodeElement.replaceChildren(circle);
    }
    return true;
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
    const graph = this.app.store.getState().graph;
    const graphViewport = this.root.querySelector<SVGGElement>(".graph-viewport");
    const edgeElements = Array.from(this.root.querySelectorAll<SVGLineElement>(".graph-edge"));
    const nodeElements = Array.from(this.root.querySelectorAll<SVGGElement>(".graph-node"));
    if (!graphViewport || edgeElements.length !== graph.edges.length || nodeElements.length !== graph.nodes.length) {
      return false;
    }
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    graphViewport.setAttribute("transform", `translate(${viewport.pan.x} ${viewport.pan.y})`);
    for (const [index, edge] of graph.edges.entries()) {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      const edgeElement = edgeElements[index];
      if (!from || !to || !edgeElement) {
        return false;
      }
      const fromPoint = projectPoint(from.position, viewport.projection);
      const toPoint = projectPoint(to.position, viewport.projection);
      edgeElement.setAttribute("x1", String(fromPoint.x));
      edgeElement.setAttribute("y1", String(fromPoint.y));
      edgeElement.setAttribute("x2", String(toPoint.x));
      edgeElement.setAttribute("y2", String(toPoint.y));
    }
    for (const nodeElement of nodeElements) {
      const nodeId = nodeElement.dataset.nodeId;
      if (!nodeId) {
        return false;
      }
      const node = nodeById.get(nodeId);
      if (!node) {
        return false;
      }
      const point = projectPoint(node.position, viewport.projection);
      nodeElement.setAttribute("transform", `translate(${point.x}, ${point.y})`);
    }
    return true;
  }

  private selectedNodes(nodes: GraphNode[]): GraphNode[] {
    const lookup = new Set(this.selectedNodeIds);
    return nodes.filter((node) => lookup.has(node.id));
  }

  private reconcileSelection(): void {
    const available = new Set(this.app.store.getState().graph.nodes.map((node) => node.id));
    this.selectedNodeIds = this.selectedNodeIds.filter((id) => available.has(id));
    if (this.selectedNodeIds.length === 0) {
      this.selectionPanelOpen = false;
    }
  }

  private findExample(name: string): ExampleDefinition | undefined {
    return this.examples.flatMap((group) => group.examples).find((example) => example.name === name);
  }

  private bindButton(id: string, action: () => void | Promise<void>): void {
    this.root.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener("click", () => {
      void action();
    });
  }

  private bindSelect(id: string, onChange: (value: string) => void): void {
    this.root.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener("change", (event) => {
      onChange((event.currentTarget as HTMLSelectElement).value);
    });
  }

  private attachCodeEditor(): void {
    const textArea = this.root.querySelector<HTMLTextAreaElement>("#code-editor");
    if (!textArea) {
      return;
    }
    const editor = CodeMirror.fromTextArea(textArea, {
      lineNumbers: true,
      mode: codeMirrorMode(this.activePlaygroundDocument, this.activeEditorMode),
      theme: this.theme === "dark" ? "material" : "default",
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      readOnly: this.activePlaygroundDocument === "compiled" ? "nocursor" : false,
    });
    editor.setSize("100%", "100%");
    editor.on("change", (instance) => {
      const currentValue = instance.getValue();
      if (this.activePlaygroundDocument === "world") {
        this.worldDocument = currentValue;
        this.app.saveWorldDocument(currentValue);
        return;
      }
      if (this.activePlaygroundDocument === "renderer") {
        this.rendererDocument = currentValue;
        this.app.saveRendererDocument(currentValue);
        if (this.rendererDocumentDebounce !== undefined) {
          window.clearTimeout(this.rendererDocumentDebounce);
        }
        this.rendererDocumentDebounce = window.setTimeout(() => {
          this.rendererDocumentError = undefined;
          this.invalidateRendererEvaluator();
          this.patchLiveState(this.app.store.getState());
          const errorContainer = this.root.querySelector<HTMLElement>("#renderer-error-container");
          if (errorContainer) {
            errorContainer.innerHTML = this.rendererDocumentError ? `<p class="inline-error">Renderer JS error: ${escapeHtml(this.rendererDocumentError)}</p>` : "";
          }
        }, 300);
        return;
      }
      this.updateActiveBuffer(currentValue);
      this.app.saveEditor(this.editorDocument);
    });
    this.codeEditor = editor;
    this.mountedDocument = this.activePlaygroundDocument;
    this.mountedEditorMode = this.activeEditorMode;
  }

  private destroyCodeEditor(): void {
    if (!this.codeEditor) {
      return;
    }
    const mountedDocument = this.mountedDocument ?? this.activePlaygroundDocument;
    if (mountedDocument === "world") {
      this.worldDocument = this.codeEditor.getValue();
      this.app.saveWorldDocument(this.worldDocument);
      this.codeEditor.toTextArea();
      this.codeEditor = undefined;
      this.mountedDocument = undefined;
      this.mountedEditorMode = undefined;
      return;
    }
    if (mountedDocument === "renderer") {
      this.rendererDocument = this.codeEditor.getValue();
      this.app.saveRendererDocument(this.rendererDocument);
      this.codeEditor.toTextArea();
      this.codeEditor = undefined;
      this.mountedDocument = undefined;
      this.mountedEditorMode = undefined;
      return;
    }
    if (mountedDocument === "compiled") {
      this.codeEditor.toTextArea();
      this.codeEditor = undefined;
      this.mountedDocument = undefined;
      this.mountedEditorMode = undefined;
      return;
    }
    const mountedMode = this.mountedEditorMode ?? this.activeEditorMode;
    this.setBufferForMode(mountedMode, this.codeEditor.getValue());
    this.editorDocument = {
      code: this.getBufferForMode(this.activeEditorMode),
      mode: this.activeEditorMode,
    };
    this.codeEditor.toTextArea();
    this.codeEditor = undefined;
    this.mountedDocument = undefined;
    this.mountedEditorMode = undefined;
  }

  private initializeEditorBuffers(): void {
    if (this.editorDocument.mode === "full-scala") {
      this.fullScalaBuffer = this.editorDocument.code;
      this.easyScalaBuffer = this.editorDocument.code;
    } else {
      this.easyScalaBuffer = this.editorDocument.code;
      this.fullScalaBuffer = convertEasyScalaToFull(this.editorDocument.code);
    }
    this.activeEditorMode = this.editorDocument.mode;
  }

  private getActiveEditorCode(): string {
    return this.activeEditorMode === "easy-scala" ? this.easyScalaBuffer : this.fullScalaBuffer;
  }

  private getActiveEditorText(): string {
    if (this.activePlaygroundDocument === "world") {
      return this.worldDocument;
    }
    if (this.activePlaygroundDocument === "renderer") {
      return this.rendererDocument;
    }
    if (this.activePlaygroundDocument === "compiled") {
      return this.app.previewCompiledSource(this.editorDocument, this.worldDocument);
    }
    return this.getActiveEditorCode();
  }

  private getBufferForMode(mode: EditorDocument["mode"]): string {
    return mode === "easy-scala" ? this.easyScalaBuffer : this.fullScalaBuffer;
  }

  private setBufferForMode(mode: EditorDocument["mode"], code: string): void {
    if (mode === "easy-scala") {
      this.easyScalaBuffer = code;
    } else {
      this.fullScalaBuffer = code;
    }
  }

  private updateActiveBuffer(code: string): void {
    this.setBufferForMode(this.activeEditorMode, code);
    this.editorDocument = { code, mode: this.activeEditorMode };
  }

  private switchEditorMode(newMode: EditorDocument["mode"]): void {
    if (newMode === this.activeEditorMode) {
      return;
    }
    if (newMode === "full-scala" && this.activeEditorMode === "easy-scala") {
      this.fullScalaBuffer = convertEasyScalaToFull(this.easyScalaBuffer);
    }
    this.activeEditorMode = newMode;
    this.editorDocument = { code: this.getActiveEditorCode(), mode: newMode };
    this.app.saveEditor(this.editorDocument);
    this.render();
  }

  private syncWorldDocumentFromConfiguration(configuration: SupportConfiguration): void {
    this.worldDocument = serializeWorldDocument(configuration);
    this.app.saveWorldDocument(this.worldDocument);
  }

  private resolveVisualization(state: AppState): VisualizationState {
    const availableSensors = availableSensorNames(this.configurationDraft).filter((sensor) => sensor !== "matrix");
    const fallback = createDefaultVisualizationState();
    fallback.visibleSensors = new Set(availableSensors);
    const evaluator = this.getRendererEvaluator();
    if (!evaluator) {
      return fallback;
    }
    const context: RendererDocumentContext = {
      graph: state.graph,
      execution: state.execution,
      selectedNodeIds: [...this.selectedNodeIds],
      availableSensors,
      defaults: visualizationToRendererDefaults(fallback),
    };
    try {
      this.rendererDocumentError = undefined;
      const output = evaluator(context);
      this.nodeRenderer = output?.renderNode;
      this.edgeRenderer = output?.renderEdge;
      return resolveVisualizationState(fallback, output, availableSensors);
    } catch (error) {
      this.rendererDocumentError = stringifyError(error);
      this.nodeRenderer = undefined;
      this.edgeRenderer = undefined;
      return fallback;
    }
  }

  private getRendererEvaluator(): RendererDocumentEvaluator | undefined {
    if (this.rendererEvaluatorSource === this.rendererDocument) {
      return this.rendererEvaluator ?? undefined;
    }
    this.rendererEvaluatorSource = this.rendererDocument;
    try {
      this.rendererEvaluator = compileRendererDocument(this.rendererDocument);
      this.rendererDocumentError = undefined;
      return this.rendererEvaluator;
    } catch (error) {
      this.rendererEvaluator = null;
      this.rendererDocumentError = stringifyError(error);
      return undefined;
    }
  }

  private invalidateRendererEvaluator(): void {
    this.rendererEvaluatorSource = undefined;
    this.rendererEvaluator = undefined;
  }

  private bindText(id: string, onInput: (value: string) => void): void {
    this.root.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("input", (event) => {
      onInput((event.currentTarget as HTMLInputElement).value);
    });
  }

  private bindNumber(id: string, onInput: (value: number) => void): void {
    this.root.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("input", (event) => {
      onInput(Number((event.currentTarget as HTMLInputElement).value));
    });
  }

  private bindCheckbox(id: string, onInput: (checkedValue: boolean) => void): void {
    this.root.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("change", (event) => {
      onInput((event.currentTarget as HTMLInputElement).checked);
    });
  }
}

function configurationToDraft(configuration: SupportConfiguration): ConfigurationDraft {
  const matrix = configuration.deviceShape.sensors.matrix as MatrixValue | undefined;
  return {
    networkKind: configuration.network.kind,
    rows: configuration.network.kind === "grid" ? configuration.network.rows : 10,
    cols: configuration.network.kind === "grid" ? configuration.network.cols : 10,
    stepX: configuration.network.kind === "grid" ? configuration.network.stepX : 60,
    stepY: configuration.network.kind === "grid" ? configuration.network.stepY : 60,
    tolerance: configuration.network.kind === "grid" ? configuration.network.tolerance : 10,
    min: configuration.network.kind === "random" ? configuration.network.min : 0,
    max: configuration.network.kind === "random" ? configuration.network.max : 500,
    howMany: configuration.network.kind === "random" ? configuration.network.howMany : 100,
    radius: configuration.neighbour.range,
    matrixDimension: matrix?.dimension ?? 3,
    matrixColor: firstMatrixColor(matrix) ?? "#bb86fc",
    sensors: Object.entries(configuration.deviceShape.sensors)
      .filter(([name]) => name !== "matrix")
      .map(([name, value]) => ({
        id: nextSensorDraftId(),
        name,
        value: String(value),
      })),
  };
}

function draftToConfiguration(draft: ConfigurationDraft): SupportConfiguration {
  const scalarSensors = Object.fromEntries(
    draft.sensors
      .filter((sensor) => sensor.name.trim().length > 0)
      .map((sensor) => [sensor.name.trim(), parseRuntimeValue(sensor.value)]),
  );

  return {
    network:
      draft.networkKind === "grid"
        ? {
            kind: "grid",
            rows: draft.rows,
            cols: draft.cols,
            stepX: draft.stepX,
            stepY: draft.stepY,
            tolerance: draft.tolerance,
          }
        : {
            kind: "random",
            min: draft.min,
            max: draft.max,
            howMany: draft.howMany,
          },
    neighbour: {
      range: draft.radius,
    },
    deviceShape: {
      sensors: {
        matrix: createMatrixValue(draft.matrixDimension, draft.matrixColor),
        ...scalarSensors,
      },
      initialValues: {},
    },
    seed: {
      configSeed: Date.now(),
      simulationSeed: Date.now(),
      randomSensorSeed: Date.now(),
    },
  };
}

function buildExampleConfiguration(example: ExampleDefinition): SupportConfiguration {
  if (example.world) {
    const parsedWorld = tryParseWorldDocument(example.world);
    if (parsedWorld) {
      return parsedWorld;
    }
  }
  return parseWorldDocument(
    serializeWorldDocument({
      network: {
        kind: "grid",
        rows: 10,
        cols: 10,
        stepX: 60,
        stepY: 60,
        tolerance: 10,
      },
      neighbour: {
        range: 70,
      },
      deviceShape: example.devices,
      seed: {
        configSeed: 0,
        simulationSeed: 0,
        randomSensorSeed: 0,
      },
    }),
  );
}

function availableSensorNames(draft: ConfigurationDraft): string[] {
  return draft.sensors.map((sensor) => sensor.name).filter((name) => name.length > 0);
}

function nextSensorDraftId(): string {
  sensorDraftCounter += 1;
  return `sensor-${sensorDraftCounter}`;
}

function newSensorDraft(): SensorDraft {
  return { id: nextSensorDraftId(), name: "", value: "false" };
}

function renderMatrixPreview(matrix: MatrixValue): string {
  const cells = [] as string[];
  for (let i = 0; i < matrix.dimension; i += 1) {
    for (let j = 0; j < matrix.dimension; j += 1) {
      const color = matrix.pixels[`${i}:${j}`] ?? "#000000";
      cells.push(`<span class="matrix-cell" style="background:${escapeHtml(color)}"></span>`);
    }
  }
  return `<div class="matrix-preview" style="grid-template-columns: repeat(${matrix.dimension}, 1fr)">${cells.join("")}</div>`;
}

function buildNodeLabels(
  node: GraphNode,
  _edges: Array<{ from: string; to: string }>,
  visualization: VisualizationState,
  selectedNode: boolean,
  totalNodes: number,
  nodeIndex: number,
): string[] {
  const hasTextualDecorations = visualization.showId || visualization.showExport || visualization.renderText;
  if (!hasTextualDecorations) {
    return [];
  }
  if (!shouldShowNodeLabel(totalNodes, selectedNode, nodeIndex)) {
    return [];
  }
  const labels: string[] = [];
  if (visualization.showId) {
    labels.push(node.id);
  }
  if (visualization.showExport && "export" in node.labels) {
    labels.push(`out:${stringifyLabel(node.labels.export)}`);
  }
  if (visualization.renderText) {
    for (const sensorName of visualization.visibleSensors) {
      if (sensorName in node.labels) {
        labels.push(`${sensorName}:${stringifyLabel(node.labels[sensorName])}`);
      }
    }
  }
  return labels.slice(0, totalNodes > 16 ? 2 : 4);
}

function shouldShowNodeLabel(totalNodes: number, selectedNode: boolean, nodeIndex: number): boolean {
  if (selectedNode || totalNodes <= 144) {
    return true;
  }
  const stride = Math.ceil(totalNodes / 36);
  return nodeIndex % stride === 0;
}

function stringifyLabel(value: unknown): string {
  if (isMatrixValue(value)) {
    return `${value.dimension}x${value.dimension}`;
  }
  if (typeof value === "number") {
    const compact = Number.isInteger(value) ? String(value) : value.toFixed(Math.abs(value) >= 100 ? 0 : 2);
    return compact.replace(/\.00$/, "");
  }
  if (typeof value === "string") {
    return value.length > 18 ? `${value.slice(0, 15)}...` : value;
  }
  if (value && typeof value === "object") {
    const json = JSON.stringify(value);
    return json.length > 18 ? `${json.slice(0, 15)}...` : json;
  }
  return String(value);
}

function summarizeInspectorValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "No export available";
  }
  if (isMatrixValue(value)) {
    return `${value.dimension}x${value.dimension} matrix output`;
  }
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(Math.abs(value) >= 100 ? 1 : 3).replace(/\.0$/, "");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  const json = JSON.stringify(value);
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
}

function formatInspectorJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function firstMatrixColor(matrix?: MatrixValue): string | undefined {
  if (!matrix) {
    return undefined;
  }
  return Object.values(matrix.pixels)[0];
}

function computeNodeVisual(
  node: GraphNode,
  visualization: VisualizationState,
  selectedNode: boolean,
): { fill: string; fillOpacity: number; stroke: string; strokeWidth: number } {
  let fill = selectedNode ? "#f08c4a" : "#7db5ff";
  let fillOpacity = 1;
  let stroke = "rgba(12, 16, 20, 0.92)";
  let strokeWidth = 3;

  if (visualization.renderGradient && typeof node.labels.export === "number") {
    fill = gradientColor(node.labels.export);
  }

  if (visualization.renderExportEffect && typeof node.labels.export === "boolean") {
    fillOpacity = node.labels.export ? 1 : 0.3;
    stroke = node.labels.export ? "#00ffff" : stroke;
    strokeWidth = node.labels.export ? 2 : strokeWidth;
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

function gradientColor(value: number): string {
  const hue = ((value % 1920) + 1920) % 1920 / 1920;
  return `hsl(${Math.round(hue * 360)} 70% 58%)`;
}

function booleanColor(index: number): string {
  const base = 255 - index * 48;
  const channel = Math.max(96, base);
  return `rgb(${channel}, ${channel}, 255)`;
}

function createMatrixValue(dimension: number, color: string): MatrixValue {
  const pixels: Record<string, string> = {};
  for (let i = 0; i < dimension; i += 1) {
    for (let j = 0; j < dimension; j += 1) {
      pixels[`${i}:${j}`] = color;
    }
  }
  return { dimension, pixels };
}

function isMatrixValue(value: unknown): value is MatrixValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      "dimension" in value &&
      "pixels" in value &&
      typeof (value as MatrixValue).dimension === "number",
  );
}

function codeMirrorMode(_document: PlaygroundDocument, _mode: EditorDocument["mode"]): string {
  if (_document === "renderer") {
    return "javascript";
  }
  return "text/x-scala";
}

function shouldRenderBooleanBadges(totalNodes: number, selectedNode: boolean): boolean {
  return selectedNode || totalNodes <= 48;
}

function parseRuntimeValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed.length > 0 && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return value;
}

function iconSun(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
}

function iconMoon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
}

function iconPlay(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

function iconSkipForward(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`;
}

function iconSquare(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`;
}

function iconMove(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>`;
}

function iconMousePointer(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`;
}

function iconRotateCcw(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
}

function iconEye(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function iconEyeOff(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;
}

function iconCode(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>`;
}

function numberField(label: string, id: string, value: number): string {
  return `<label class="field"><span>${escapeHtml(label)}</span><input id="${id}" type="number" value="${value}" /></label>`;
}

function textField(label: string, id: string, value: string): string {
  return `<label class="field"><span>${escapeHtml(label)}</span><input id="${id}" type="text" value="${escapeHtml(value)}" /></label>`;
}

function checked(value: boolean): string {
  return value ? "checked" : "";
}

function selected(value: boolean): string {
  return value ? "selected" : "";
}

function disabled(value: boolean): string {
  return value ? "disabled" : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function cssEscape(value: string): string {
  return value.replaceAll('"', '\\"');
}