import { convertEasyScalaToFull } from "../services/scastie/easy-scala";
import { parseWorldDocument, serializeWorldDocument, tryParseWorldDocument } from "../services/config/world-document";
import {
  compileRendererDocument,
  createDefaultVisualizationState,
  defaultRendererDocument,
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

// Components
import { ThemeManager } from "./components/theme-manager";
import { CodeEditorComponent, type PlaygroundDocument } from "./components/code-editor-component";
import { SimulationControlsComponent } from "./components/simulation-controls-component";
import { NodeInspectorComponent, summarizeInspectorValue, formatInspectorJson } from "./components/node-inspector-component";

// Renderers
import { SvgSimulationRenderer } from "./renderer/svg-simulation-renderer";
import { LightweightSimulationRenderer } from "./renderer/lightweight-simulation-renderer";
import type { SimulationRenderer } from "./renderer/simulation-renderer";

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

type PerformanceMetrics = {
  windowStartedAt: number;
  framesInWindow: number;
  fps: number;
  averageRenderMs: number;
};

let sensorDraftCounter = 0;

export class ScafiWebUiShell {
  private examples: ExampleGroup[] = [];
  private examplesError?: string;
  private configurationDraft: ConfigurationDraft = configurationToDraft(defaultConfiguration);
  private selectedExample = "";
  private selectedNodeIds: string[] = [];
  private visualization: VisualizationState = createDefaultVisualizationState();
  private graphPan: Vec2 = { x: 0, y: 0 };
  private graphInteractionMode: "pan" | "selection" = "pan";
  private selectionPanelOpen = false;
  private visualizationSettingsOpen = false;
  private isEditorCollapsed = false;
  private mobileView: "code" | "simulation" = "code";
  private isVisualizationCollapsed = false;
  private lastRenderedExecutionStatus: AppState["execution"]["status"] = "idle";
  private lastRenderedProblems?: AppState["execution"]["problems"];
  private lastRenderedSelectedNodeIds: string[] = [];
  private lastRenderedSelectionPanelOpen = false;
  private lastRenderedDaemonRunning = false;
  
  private activePlaygroundDocument: PlaygroundDocument = "code";
  private rendererDocumentError?: string;
  private rendererEvaluatorSource?: string;
  private rendererEvaluator?: RendererDocumentEvaluator | null;
  private nodeRenderer?: NodeRendererEvaluator;
  private edgeRenderer?: EdgeRendererEvaluator;
  
  private pendingLiveState?: AppState;
  private livePatchScheduled = false;
  private performanceMetrics: PerformanceMetrics = {
    windowStartedAt: 0,
    framesInWindow: 0,
    fps: 0,
    averageRenderMs: 0,
  };

  // Decoupled sub-components
  private readonly themeManager: ThemeManager;
  private readonly codeEditor: CodeEditorComponent;
  private readonly simulationControls: SimulationControlsComponent;
  private readonly nodeInspector: NodeInspectorComponent;

  // Swappable Simulation Renderer
  private renderer!: SimulationRenderer;
  private selectedRendererType: "standard" | "lightweight" = "standard";

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {
    this.performanceMetrics.windowStartedAt = nowMs();
    this.themeManager = new ThemeManager(root, app);
    this.codeEditor = new CodeEditorComponent(root, app);
    this.codeEditor.setMetalsService(app.metals);
    this.simulationControls = new SimulationControlsComponent(root, app);
    this.nodeInspector = new NodeInspectorComponent(root, app);
  }

  async mount(): Promise<void> {
    const configuration = this.app.loadPersistedConfiguration(defaultConfiguration);
    this.configurationDraft = configurationToDraft(configuration);

    this.codeEditor.initialize(configuration);
    this.themeManager.load();

    // Check for explicit code parameter override (raw or b64) from shared links
    const params = new URLSearchParams(window.location.search);
    const codeRaw = params.get("code");
    const codeB64 = params.get("code_b64");
    const modeParam = params.get("mode");
    const worldRaw = params.get("world");
    const worldB64 = params.get("world_b64");
    const rendererRaw = params.get("renderer");
    const rendererB64 = params.get("renderer_b64");
    
    let sharedCode: string | null = null;
    if (codeRaw) {
      sharedCode = codeRaw;
    } else if (codeB64) {
      sharedCode = decodeBase64(codeB64);
    }

    let sharedWorld: string | null = null;
    if (worldRaw) {
      sharedWorld = worldRaw;
    } else if (worldB64) {
      sharedWorld = decodeBase64(worldB64);
    }

    let sharedRenderer: string | null = null;
    if (rendererRaw) {
      sharedRenderer = rendererRaw;
    } else if (rendererB64) {
      sharedRenderer = decodeBase64(rendererB64);
    }
    
    if (sharedCode) {
      const mode = (modeParam === "full-scala" || modeParam === "advanced") ? "full-scala" : "easy-scala";
      this.codeEditor.loadSharedCode(sharedCode, mode, sharedWorld ?? undefined, sharedRenderer ?? undefined);
      
      if (sharedWorld) {
        const parsedConfig = tryParseWorldDocument(sharedWorld);
        if (parsedConfig) {
          this.app.evolve(parsedConfig);
          this.configurationDraft = configurationToDraft(parsedConfig);
        }
      }
      
      // Clear URL parameters so they don't persist on subsequent reloads
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    this.selectedRendererType = (localStorage.getItem("scafi-web-renderer-type") as any) || "standard";

    this.app.subscribe((event) => {
      if (event.type === "state-changed") {
        this.reconcileSelection();
        this.syncCompileDiagnostics(event.state);
        const status = event.state.execution.status;
        if (status === "ready" || status === "daemon") {
          this.configurationDraft = configurationToDraft(event.state.configuration);
        }
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

    window.addEventListener("resize", () => {
      if (this.renderer && this.renderer.updateSize()) {
        this.patchLiveState(this.app.store.getState());
      }
    });

    window.addEventListener("keydown", (event) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          activeEl.hasAttribute("contenteditable") ||
          (activeEl as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      if (this.selectedNodeIds.length === 0) {
        return;
      }

      const keyMatch = /^[1-9]$/.exec(event.key);
      if (!keyMatch) {
        return;
      }

      const numValue = parseInt(event.key, 10);
      const sensorIndex = numValue - 1;

      const sensorsList = this.getSelectedSensorsList();
      if (sensorIndex >= 0 && sensorIndex < sensorsList.length) {
        const sensorName = sensorsList[sensorIndex];
        this.triggerToggleSensor(sensorName);
        event.preventDefault();
      }
    });
  }

  private initRenderer(): void {
    const mountPoint = this.root.querySelector<HTMLElement>("#renderer-mount-point");
    if (!mountPoint) return;

    const currentRendererType =
      this.renderer instanceof LightweightSimulationRenderer
        ? "lightweight"
        : this.renderer instanceof SvgSimulationRenderer
          ? "standard"
          : undefined;

    if (this.renderer && this.selectedRendererType === currentRendererType) {
      // Clear mount point and remount the existing renderer to avoid recreate overhead
      mountPoint.innerHTML = "";
      this.renderer.mount(mountPoint);
      return;
    }

    if (this.renderer) {
      this.renderer.destroy();
    }

    // Clear the mount point to prevent duplicate containers or stacked startup overlays
    mountPoint.innerHTML = "";

    if (this.selectedRendererType === "lightweight") {
      this.renderer = new LightweightSimulationRenderer();
    } else {
      this.renderer = new SvgSimulationRenderer();
    }

    this.renderer.setGraphPan(this.graphPan);
    this.renderer.mount(mountPoint);

    this.renderer.setCallbacks({
      onNodeClick: (nodeId, shiftKey) => {
        if (shiftKey) {
          this.selectedNodeIds = this.selectedNodeIds.includes(nodeId)
            ? this.selectedNodeIds.filter((id) => id !== nodeId)
            : [...this.selectedNodeIds, nodeId];
        } else {
          this.selectedNodeIds = [nodeId];
        }
        this.patchLiveState(this.app.store.getState());
      },
      onNodesDragged: (movedPositions) => {
        this.app.moveNodes(movedPositions);
      },
      onViewportPanned: (pan) => {
        this.graphPan = pan;
      },
      onSelectionApplied: (selectedIds) => {
        this.selectedNodeIds = selectedIds;
        if (selectedIds.length === 0) {
          this.selectionPanelOpen = false;
        }
        this.patchLiveState(this.app.store.getState());
      },
      onSelectionCleared: () => {
        this.selectedNodeIds = [];
        this.selectionPanelOpen = false;
        this.patchLiveState(this.app.store.getState());
      },
      onResetView: () => {
        this.graphPan = { x: 0, y: 0 };
        this.renderer.setGraphPan(this.graphPan);
        this.patchLiveState(this.app.store.getState());
      }
    });
  }

  private render(): void {
    const renderStartedAt = nowMs();
    this.pendingLiveState = undefined;
    this.livePatchScheduled = false;

    this.codeEditor.destroyCodeEditor();

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
            <button id="toggle-theme" class="ghost-link icon-btn" type="button" title="Toggle theme"></button>
            <a class="ghost-link" href="https://scafi.github.io/" target="_blank" rel="noreferrer">Website</a>
            <a class="ghost-link" href="https://github.com/scafi/scafi" target="_blank" rel="noreferrer">Repository</a>
            <a class="ghost-link" href="https://youtu.be/E-EoFmm5tuc" target="_blank" rel="noreferrer">Demo</a>
          </div>
        </header>

        <main class="workspace-grid">
          <div class="mobile-view-switch" role="tablist" aria-label="Workspace view">
            <button id="mobile-view-code" class="mode-chip ${this.mobileView === "code" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.mobileView === "code")}">Code</button>
            <button id="mobile-view-simulation" class="mode-chip ${this.mobileView === "simulation" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.mobileView === "simulation")}">Simulation</button>
          </div>
          <div class="playground ${this.isEditorCollapsed ? "is-editor-collapsed" : ""} ${this.isVisualizationCollapsed ? "is-visualization-collapsed" : ""}" data-mobile-view="${this.mobileView}">
            <section class="panel panel-editor ${this.isEditorCollapsed ? "is-collapsed" : ""}">
              <!-- Collapsed Trigger -->
              <button class="collapsed-panel-trigger collapsed-editor" id="expand-editor" type="button" title="Expand Editor" aria-hidden="${String(!this.isEditorCollapsed)}">
                <span class="ghost-link icon-btn expand-btn">
                  ${iconChevronRight()}
                </span>
                <div class="collapsed-title">Playground</div>
              </button>

              <!-- Panel Content -->
              <div class="panel-content editor-panel-content">
                <section class="panel-section panel-section-fill editor-pane">
                  <div class="editor-pane-meta">
                    <div class="section-heading compact-section-heading">
                      <p class="section-kicker">Playground</p>
                      <button id="collapse-editor" class="ghost-link icon-btn collapse-panel-btn" type="button" title="Collapse Editor">
                        ${iconChevronLeft()}
                      </button>
                    </div>
                    <div class="editor-tabbar" role="tablist" aria-label="Playground documents">
                      <div class="tab-buttons">
                        <button id="document-tab-code" class="editor-tab ${this.activePlaygroundDocument === "code" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.activePlaygroundDocument === "code")}">Code</button>
                        <button id="document-tab-world" class="editor-tab ${this.activePlaygroundDocument === "world" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.activePlaygroundDocument === "world")}">World</button>
                        <button id="document-tab-renderer" class="editor-tab ${this.activePlaygroundDocument === "renderer" ? "is-active" : ""}" type="button" role="tab" aria-selected="${String(this.activePlaygroundDocument === "renderer")}">Renderer (JS)</button>
                      </div>
                      <div class="field mode-field scala-version-field">
                        <span>Scala</span>
                        <fieldset class="mode-toggle mode-toggle-compact">
                          <label>
                            <input type="radio" name="scala-version" value="2" ${checked(!this.app.getScalaVersion().startsWith("3."))} />
                            <span>2</span>
                          </label>
                          <label>
                            <input type="radio" name="scala-version" value="3" ${checked(this.app.getScalaVersion().startsWith("3."))} />
                            <span>3</span>
                          </label>
                        </fieldset>
                      </div>
                    </div>
                    <div class="toolbar-row compact-toolbar-row">
                      <div class="examples-session-container">
                        <label class="field compact-field">
                          <span>Examples & Custom Files</span>
                          <select id="example-select">
                            <option value="">Choose an example or custom file...</option>
                            ${this.renderExampleOptions()}
                          </select>
                        </label>
                        <div class="session-btn-group">
                          <button id="session-save" class="icon-btn ghost" title="Save changes to active custom file" ${disabled(!this.isUserSessionActive())}>${iconSave()} Save</button>
                          <button id="session-save-as" class="icon-btn ghost" title="Save as new custom file">${iconCopy()} Save As...</button>
                          <button id="session-new" class="icon-btn ghost" title="Create new blank custom file">${iconFilePlus()} New</button>
                          <button id="session-delete" class="icon-btn ghost danger" title="Delete this custom file" ${disabled(!this.isUserSessionActive())}>${iconTrash()} Delete</button>
                          <button id="session-share" class="icon-btn ghost" title="Share current code as a link">${iconShare()} Share</button>
                        </div>
                      </div>
                      ${
                        this.activePlaygroundDocument === "code"
                          ? `<div class="field mode-field">
                              <span>Mode</span>
                              <fieldset class="mode-toggle">
                                <label>
                                  <input type="radio" name="editor-mode" value="easy-scala" ${checked(this.codeEditor.getActiveEditorMode() === "easy-scala")} />
                                  <span>Basic</span>
                                </label>
                                <label>
                                  <input type="radio" name="editor-mode" value="full-scala" ${checked(this.codeEditor.getActiveEditorMode() === "full-scala")} />
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
                      <textarea id="code-editor" spellcheck="false">${escapeHtml(this.codeEditor.getActiveEditorText())}</textarea>
                    </div>
                  </div>
                </section>
              </div>
            </section>
 
            <section class="panel panel-visualization ${this.isVisualizationCollapsed ? "is-collapsed" : ""} ${!isLoaded ? "viz-unloaded" : ""}">
              <!-- Collapsed Trigger -->
              <button class="collapsed-panel-trigger collapsed-visualization" id="expand-visualization" type="button" title="Expand Simulation" aria-hidden="${String(!this.isVisualizationCollapsed)}">
                <span class="ghost-link icon-btn expand-btn">
                  ${iconChevronLeft()}
                </span>
                <div class="collapsed-title">Simulation</div>
              </button>

              <!-- Panel Content -->
              <div class="panel-content viz-panel-content">
                <section class="panel-section viz-top-section">
                  <div class="viz-heading-row compact-viz-heading-row">
                    <div class="section-heading compact-section-heading">
                      <p class="section-kicker">Execution</p>
                    </div>
                    <div class="status-strip status-strip-inline">${this.simulationControls.renderStatusStrip(state)}</div>
                    <button id="collapse-visualization" class="ghost-link icon-btn collapse-panel-btn" type="button" title="Collapse Simulation">
                      ${iconChevronRight()}
                    </button>
                  </div>
                  <div class="viz-toolbar-strip">
                    <div class="viz-control-group viz-control-group-run">
                      <p class="control-card-title">Run</p>
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
                        ${this.simulationControls.renderSpeedOption("slow", 60, state.execution.daemonIntervalMs === 60)}
                        ${this.simulationControls.renderSpeedOption("normal", 30, state.execution.daemonIntervalMs === 30 || !state.execution.daemonIntervalMs)}
                        ${this.simulationControls.renderSpeedOption("fast", 10, state.execution.daemonIntervalMs === 10)}
                      </div>
                    </div>
                    <div class="viz-control-group viz-control-group-graph">
                      <p class="control-card-title">Graph</p>
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
                  <div class="viz-runtime-feedback">${state.execution.error ? `<p class="inline-error">${escapeHtml(state.execution.error)}</p>` : ""}</div>
                </section>
                <section class="panel-section panel-section-tight panel-section-fill graph-pane">
                  <div class="graph-workspace">
                    <div class="graph-main">
                      <div id="renderer-mount-point" class="graph-stage-wrapper"></div>
                      <aside class="selection-slot ${selectionPanelVisible ? "is-open" : ""}" data-selection-panel>${this.renderSelectionPanel(state)}</aside>
                      ${status === "compiling" ? `
                        <div class="compiling-overlay">
                          <div class="compiling-loader-container">
                            <div class="compiling-spinner"></div>
                            <div class="compiling-text-wrapper">
                              <h3 class="compiling-title">Compiling</h3>
                              <p class="compiling-subtitle">Contacting compilation server...</p>
                            </div>
                          </div>
                        </div>
                      ` : ""}
                    </div>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </main>
      </div>
    `;

    this.lastRenderedExecutionStatus = status;

    // Standard Theme initialization
    this.themeManager.applyTheme(this.themeManager.getTheme());

    // Setup Swappable Renderer
    this.initRenderer();

    // Attach Editor
    this.codeEditor.attachCodeEditor(this.themeManager.getTheme());

    // Setup Component callbacks
    this.setupComponentCallbacks();

    // Attach local DOM listeners
    this.attachListeners();

    // Initialize state
    this.patchLiveState(state);

    this.recordUiUpdate(renderStartedAt);
  }

  private setupComponentCallbacks(): void {
    this.codeEditor.setCallbacks({
      onContentChanged: () => {},
      onModeChanged: () => {
        this.render();
      },
      onTabChanged: (tab) => {
        this.activePlaygroundDocument = tab;
        this.render();
      },
      onRendererCompiled: () => {
        this.rendererDocumentError = undefined;
        this.invalidateRendererEvaluator();
        this.patchLiveState(this.app.store.getState());
      }
    });

    this.nodeInspector.setCallbacks({
      onMoveSelection: (x, y) => {
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
      },
      onChangeSensor: (sensorName, value) => {
        if (this.selectedNodeIds.length > 0) {
          this.app.changeSensor(sensorName, this.selectedNodeIds, value);
          if (this.app.store.getState().execution.status === "ready") {
            this.app.tick();
          }
        }
      },
      onToggleSensor: (sensorName) => {
        this.triggerToggleSensor(sensorName);
      },
      onSelectNode: (nodeId) => {
        this.selectedNodeIds = [nodeId];
        this.patchLiveState(this.app.store.getState());
      },
      onClearSelection: () => {
        this.selectedNodeIds = [];
        this.selectionPanelOpen = false;
        this.patchLiveState(this.app.store.getState());
      },
      onHidePanel: () => {
        this.selectionPanelOpen = false;
        this.patchLiveState(this.app.store.getState());
      }
    });
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
            <div class="inspector-action-row">
              <button id="inspector-start-daemon" class="ghost" type="button" ${disabled(state.execution.status !== "ready")}>${iconPlay()} Start</button>
              <button id="inspector-stop-daemon" class="ghost" type="button" ${disabled(state.execution.status !== "daemon")}>${iconSquare()} Stop</button>
              <button class="ghost selection-close" type="button" data-hide-selection-panel>Close</button>
            </div>
          </div>
        </div>
        <div class="selection-list">
          ${selectedNodes.map((node) => `<button class="selection-chip ${selectedNodes[0]?.id === node.id ? "is-active" : ""}" data-select-node="${escapeHtml(node.id)}">${escapeHtml(node.id)}</button>`).join("")}
        </div>
        ${this.nodeInspector.renderInspector(selectedNodes, daemonRunning)}
      </div>
    `;
  }

  private shouldPatchLiveState(state: AppState): boolean {
    const wasLive = this.lastRenderedExecutionStatus === "daemon" || this.lastRenderedExecutionStatus === "ready";
    const isLive = state.execution.status === "daemon" || state.execution.status === "ready";
    return wasLive && isLive && this.root.childElementCount > 0;
  }

  private patchLiveState(state: AppState): void {
    const renderStartedAt = nowMs();
    this.visualization = this.resolveVisualization(state);

    const currentRendererType =
      this.renderer instanceof LightweightSimulationRenderer
        ? "lightweight"
        : "standard";
    if (!this.renderer || this.selectedRendererType !== currentRendererType) {
      this.initRenderer();
    }

    this.lastRenderedExecutionStatus = state.execution.status;

    const statusStrip = this.root.querySelector<HTMLElement>(".status-strip");
    if (statusStrip) {
      statusStrip.innerHTML = this.simulationControls.renderStatusStrip(state) + " " + this.renderPerformanceBadge();
    }

    const runtimeFeedback = this.root.querySelector<HTMLElement>(".viz-runtime-feedback");
    if (runtimeFeedback) {
      runtimeFeedback.innerHTML = state.execution.error ? `<p class="inline-error">${escapeHtml(state.execution.error)}</p>` : "";
    }

    const loadScriptBtn = this.root.querySelector<HTMLButtonElement>("#load-script");
    if (loadScriptBtn) loadScriptBtn.disabled = state.execution.status === "compiling";
    const tickOnceBtn = this.root.querySelector<HTMLButtonElement>("#tick-once");
    if (tickOnceBtn) tickOnceBtn.disabled = !(state.execution.status === "ready" || state.execution.status === "daemon");
    const startDaemonBtn = this.root.querySelector<HTMLButtonElement>("#start-daemon");
    if (startDaemonBtn) startDaemonBtn.disabled = state.execution.status !== "ready";
    const stopDaemonBtn = this.root.querySelector<HTMLButtonElement>("#stop-daemon");
    if (stopDaemonBtn) stopDaemonBtn.disabled = state.execution.status !== "daemon";

    const interactionPan = this.root.querySelector<HTMLButtonElement>("#interaction-pan");
    const interactionSel = this.root.querySelector<HTMLButtonElement>("#interaction-selection");
    if (interactionPan) interactionPan.classList.toggle("is-active", this.graphInteractionMode === "pan");
    if (interactionSel) interactionSel.classList.toggle("is-active", this.graphInteractionMode === "selection");

    const hasSelection = this.selectedNodeIds.length > 0;
    const selectionPanelVisible = hasSelection && this.selectionPanelOpen;

    const toggleSelectionPanelBtn = this.root.querySelector<HTMLButtonElement>("#toggle-selection-panel");
    if (toggleSelectionPanelBtn) {
      toggleSelectionPanelBtn.disabled = !hasSelection;
      toggleSelectionPanelBtn.classList.toggle("is-active", selectionPanelVisible);
      toggleSelectionPanelBtn.setAttribute("aria-pressed", String(selectionPanelVisible));
      toggleSelectionPanelBtn.innerHTML = selectionPanelVisible
        ? `${iconEyeOff()} Hide inspector`
        : `${iconEye()} Show inspector`;
    }

    const selectionSlot = this.root.querySelector<HTMLElement>("[data-selection-panel]");
    if (selectionSlot) {
      selectionSlot.classList.toggle("is-open", selectionPanelVisible);
      if (selectionPanelVisible) {
        const daemonRunning = state.execution.status === "daemon";
        const selectionChanged =
          this.selectedNodeIds.length !== this.lastRenderedSelectedNodeIds.length ||
          !this.selectedNodeIds.every((id, idx) => id === this.lastRenderedSelectedNodeIds[idx]) ||
          this.selectionPanelOpen !== this.lastRenderedSelectionPanelOpen ||
          daemonRunning !== this.lastRenderedDaemonRunning;

        if (selectionChanged) {
          this.lastRenderedSelectedNodeIds = [...this.selectedNodeIds];
          this.lastRenderedSelectionPanelOpen = this.selectionPanelOpen;
          this.lastRenderedDaemonRunning = daemonRunning;

          selectionSlot.innerHTML = this.renderSelectionPanel(state);
          this.nodeInspector.attachListeners();
          this.attachSelectionExtraListeners(state);
        } else {
          // Soltanto aggiornamento selettivo dei testi dinamici per evitare flicker e perdita di focus degli input
          const selectedNodes = this.selectedNodes(state.graph.nodes);
          if (selectedNodes.length > 0) {
            const primaryNode = selectedNodes[0];
            const exportValue = primaryNode.labels.export ?? null;

            const summaryEl = selectionSlot.querySelector<HTMLElement>("[data-inspector-export-summary]");
            const previewEl = selectionSlot.querySelector<HTMLElement>("[data-inspector-export-preview]");
            if (summaryEl) {
              summaryEl.textContent = summarizeInspectorValue(exportValue);
            }
            if (previewEl) {
              previewEl.textContent = formatInspectorJson(exportValue);
            }
          }
        }
      } else {
        this.lastRenderedSelectedNodeIds = [];
        this.lastRenderedSelectionPanelOpen = false;
        this.lastRenderedDaemonRunning = false;
        selectionSlot.innerHTML = "";
      }
    }

    const activeSpeedMs = state.execution.daemonIntervalMs ?? 30;
    for (const btn of this.root.querySelectorAll<HTMLButtonElement>("[data-speed]")) {
      const speedVal = Number(btn.dataset.speed);
      btn.classList.toggle("is-active", speedVal === activeSpeedMs);
    }

    if (this.renderer) {
      this.renderer.update(
        state,
        this.selectedNodeIds,
        this.graphInteractionMode,
        this.graphPan,
        this.visualization,
        this.nodeRenderer,
        this.edgeRenderer,
      );
      this.graphPan = this.renderer.getGraphPan();
    }

    this.recordUiUpdate(renderStartedAt);
  }

  private attachSelectionExtraListeners(state: AppState): void {
    this.bindButton("inspector-start-daemon", () => {
      const activeSpeedBtn = this.root.querySelector<HTMLButtonElement>(".speed-pill.is-active");
      const speed = Number(activeSpeedBtn?.dataset.speed ?? 30);
      this.app.startDaemon(speed);
    });
    this.bindButton("inspector-stop-daemon", () => this.app.stopDaemon());
  }

  private scheduleLiveStatePatch(state: AppState): void {
    this.pendingLiveState = state;
    if (this.livePatchScheduled) return;
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

  /** Mirrors the latest compiler messages into the editor gutter. */
  private syncCompileDiagnostics(state: AppState): void {
    if (state.execution.problems === this.lastRenderedProblems) {
      return;
    }
    this.lastRenderedProblems = state.execution.problems;
    this.codeEditor.setCompileProblems(state.execution.problems, this.app.store.getLastCompileSource());
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
        <div class="settings-group">
          <p class="settings-group-title">Performance Options</p>
          <p class="control-card-summary">Disable expensive rendering features to significantly improve simulation speed in dense networks.</p>
          <label class="settings-switch-label">
            <input id="toggle-render-links" type="checkbox" ${this.visualization.showLinks !== false ? "checked" : ""} />
            <span>Render neighborhood links (connections)</span>
          </label>
        </div>
        <div class="settings-group">
          <p class="settings-group-title">Renderer (JavaScript)</p>
          <p class="control-card-summary">Use the Renderer tab to script node size, visible sensors, and custom renderers in JavaScript.</p>
          <div class="viz-inline-actions">
            <button id="open-renderer-document" class="ghost" type="button">Open Renderer (JS)</button>
          </div>
          <p class="control-card-summary">Current node size: ${this.visualization.nodeSize}px · font size: ${this.visualization.fontSize}px</p>
          <p class="control-card-summary">Active renderers: ${escapeHtml(summarizeActiveRenderers(this.visualization))}</p>
        </div>
      </div>
    `;
  }

  private attachListeners(): void {
    this.bindButton("toggle-theme", () => {
      this.themeManager.toggleTheme((nextTheme) => {
        if (this.codeEditor) {
          this.codeEditor.destroyCodeEditor();
          this.codeEditor.attachCodeEditor(nextTheme);
        }
      });
    });

    this.bindButton("toggle-settings", () => {
      this.visualizationSettingsOpen = !this.visualizationSettingsOpen;
      this.render();
    });

    this.bindButton("reset-view", () => {
      this.graphPan = { x: 0, y: 0 };
      if (this.renderer) {
        this.renderer.setGraphPan(this.graphPan);
      }
      this.render();
    });

    this.bindButton("toggle-selection-panel", () => {
      if (this.selectedNodeIds.length === 0) return;
      this.selectionPanelOpen = !this.selectionPanelOpen;
      this.render();
    });

    this.bindButton("interaction-pan", () => {
      this.graphInteractionMode = "pan";
      this.selectedNodeIds = [];
      this.selectionPanelOpen = false;
      this.render();
    });

    this.bindButton("interaction-selection", () => {
      this.graphInteractionMode = "selection";
      this.render();
    });

    this.bindButton("session-save", () => {
      if (!this.isUserSessionActive()) return;
      const name = this.selectedExample;
      const body = this.codeEditor.getEditorDocument().code;
      const mode = this.codeEditor.getEditorDocument().mode;
      const world = this.codeEditor.getWorldDocument();
      const renderer = this.codeEditor.getRendererDocument();
      this.app.saveUserSession({ name, body, mode, world, renderer });
      this.render();
    });

    this.bindButton("session-save-as", () => {
      const name = prompt("Enter a name for the new file:");
      if (!name) return;
      const trimmed = name.trim();
      if (trimmed.length === 0) return;

      const userSessions = this.app.getUserSessions();
      if (userSessions.some((s) => s.name === trimmed)) {
        alert("A file with this name already exists.");
        return;
      }

      const body = this.codeEditor.getEditorDocument().code;
      const mode = this.codeEditor.getEditorDocument().mode;
      const world = this.codeEditor.getWorldDocument();
      const renderer = this.codeEditor.getRendererDocument();

      this.app.saveUserSession({ name: trimmed, body, mode, world, renderer });
      this.selectedExample = trimmed;
      this.render();
    });

    this.bindButton("session-new", () => {
      const name = prompt("Enter a name for the new file:");
      if (!name) return;
      const trimmed = name.trim();
      if (trimmed.length === 0) return;

      const userSessions = this.app.getUserSessions();
      if (userSessions.some((s) => s.name === trimmed)) {
        alert("A file with this name already exists.");
        return;
      }

      const defaultCode = [
        "// A brand new ScaFi custom file",
        "// Click 'Load' to execute this simulation!",
        "",
        "val gradient = rep(0.0) { d => d + 1.0 }",
        "gradient",
      ].join("\n");

      this.app.saveUserSession({
        name: trimmed,
        body: defaultCode,
        mode: "easy-scala",
        world: undefined,
        renderer: undefined,
      });

      this.selectedExample = trimmed;
      const example = { name: trimmed, body: defaultCode, mode: "easy-scala" as const };
      const exampleConfiguration = buildExampleConfiguration(example);
      this.configurationDraft = configurationToDraft(exampleConfiguration);
      this.codeEditor.loadExample(example, exampleConfiguration);
      this.rendererDocumentError = undefined;
      this.invalidateRendererEvaluator();
      this.app.evolve(exampleConfiguration);
      this.app.resetExecution();
      this.render();
    });

    this.bindButton("session-delete", () => {
      if (!this.isUserSessionActive()) return;
      if (!confirm(`Are you sure you want to delete "${this.selectedExample}"?`)) {
        return;
      }
      this.app.deleteUserSession(this.selectedExample);
      this.selectedExample = "";
      this.render();
    });

    this.bindButton("session-share", () => {
      const code = this.codeEditor.getEditorDocument().code;
      const mode = this.codeEditor.getEditorDocument().mode;
      const world = this.codeEditor.getWorldDocument();
      const renderer = this.codeEditor.getRendererDocument();
      
      const origin = window.location.origin + window.location.pathname;
      const params = new URLSearchParams();
      params.set("code_b64", encodeBase64(code));
      if (mode !== "easy-scala") {
        params.set("mode", mode);
      }
      
      if (world && world.trim().length > 0) {
        params.set("world_b64", encodeBase64(world));
      }
      if (renderer && renderer.trim().length > 0) {
        params.set("renderer_b64", encodeBase64(renderer));
      }

      const isScala3 = this.app.getScalaVersion().startsWith("3.");
      if (isScala3) {
        params.set("scala", "3");
      }
      
      const shareUrl = `${origin}?${params.toString()}`;
      void navigator.clipboard.writeText(shareUrl);
      
      const shareBtn = this.root.querySelector<HTMLButtonElement>("#session-share");
      if (shareBtn) {
        const originalHtml = shareBtn.innerHTML;
        shareBtn.innerHTML = `${iconCheck()} Copied!`;
        shareBtn.classList.add("copied");
        setTimeout(() => {
          shareBtn.innerHTML = originalHtml;
          shareBtn.classList.remove("copied");
        }, 1500);
      }
    });

    this.bindButton("document-tab-code", () => {
      this.codeEditor.setActivePlaygroundDocument("code");
    });
    this.bindButton("document-tab-world", () => {
      this.codeEditor.setActivePlaygroundDocument("world");
    });
    this.bindButton("document-tab-renderer", () => {
      this.codeEditor.setActivePlaygroundDocument("renderer");
    });

    this.bindSelect("example-select", (value) => {
      this.selectedExample = value;
      if (!value) return;
      const example = this.findExample(value);
      if (!example) return;

      const exampleConfiguration = buildExampleConfiguration(example);
      this.configurationDraft = configurationToDraft(exampleConfiguration);

      this.codeEditor.loadExample(example, exampleConfiguration);

      this.rendererDocumentError = undefined;
      this.invalidateRendererEvaluator();
      this.app.evolve(exampleConfiguration);
      this.app.resetExecution();
      this.render();
    });

    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[name="editor-mode"]')) {
      input.addEventListener("change", () => {
        this.codeEditor.switchEditorMode(input.value as EditorDocument["mode"]);
      });
    }

    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[name="scala-version"]')) {
      input.addEventListener("change", () => {
        const selectedVer = input.value === "3" ? "3.7.4" : "2.13.18";
        this.app.saveScalaVersion(selectedVer);
        this.render();
      });
    }

    this.bindButton("load-script", async () => {
      await this.app.loadScript(this.codeEditor.getEditorDocument(), this.codeEditor.getWorldDocument());
      const state = this.app.store.getState();
      if (state.execution.status === "ready") {
        const selectedSpeed = this.root.querySelector<HTMLButtonElement>(".speed-pill.is-active")?.dataset.speed;
        this.app.startDaemon(Number(selectedSpeed ?? 30));
      }
    });

    this.bindButton("open-renderer-document", () => {
      this.codeEditor.setActivePlaygroundDocument("renderer");
      this.visualizationSettingsOpen = false;
      this.render();
    });

    this.root.querySelector<HTMLInputElement>("#toggle-render-links")?.addEventListener("change", (event) => {
      const checked = (event.currentTarget as HTMLInputElement).checked;
      this.visualization.showLinks = checked;
      this.app.store.setLinksEnabled(checked);
      this.patchLiveState(this.app.store.getState());
    });

    this.bindButton("tick-once", () => this.app.tick());
    this.bindButton("start-daemon", () => {
      const selectedSpeed = this.root.querySelector<HTMLButtonElement>(".speed-pill.is-active")?.dataset.speed;
      this.app.startDaemon(Number(selectedSpeed ?? 30));
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

    this.bindButton("collapse-editor", () => {
      this.isEditorCollapsed = true;
      this.isVisualizationCollapsed = false;
      this.updateCollapseClasses();
    });
    this.bindButton("expand-editor", () => {
      this.isEditorCollapsed = false;
      this.updateCollapseClasses();
    });
    this.bindButton("collapse-visualization", () => {
      this.isVisualizationCollapsed = true;
      this.isEditorCollapsed = false;
      this.updateCollapseClasses();
    });
    this.bindButton("expand-visualization", () => {
      this.isVisualizationCollapsed = false;
      this.updateCollapseClasses();
    });

    this.bindButton("mobile-view-code", () => {
      this.setMobileView("code");
    });
    this.bindButton("mobile-view-simulation", () => {
      this.setMobileView("simulation");
    });
  }

  /**
   * Swaps the visible pane on phones. A full render() would tear down and rebuild
   * CodeMirror, so the switch only touches attributes and lets the renderer resize.
   */
  private setMobileView(view: "code" | "simulation"): void {
    if (this.mobileView === view) {
      return;
    }
    this.mobileView = view;
    this.root.querySelector(".playground")?.setAttribute("data-mobile-view", view);
    for (const [id, owned] of [
      ["mobile-view-code", "code"],
      ["mobile-view-simulation", "simulation"],
    ] as const) {
      const button = this.root.querySelector(`#${id}`);
      button?.classList.toggle("is-active", owned === view);
      button?.setAttribute("aria-selected", String(owned === view));
    }
    if (view === "simulation") {
      this.animateCollapseResize();
    }
  }

  private updateCollapseClasses(): void {
    const playground = this.root.querySelector(".playground");
    const panelEditor = this.root.querySelector(".panel-editor");
    const panelVisualization = this.root.querySelector(".panel-visualization");
    const expandEditorBtn = this.root.querySelector("#expand-editor");
    const expandVisualizationBtn = this.root.querySelector("#expand-visualization");

    if (playground) {
      playground.classList.toggle("is-editor-collapsed", this.isEditorCollapsed);
      playground.classList.toggle("is-visualization-collapsed", this.isVisualizationCollapsed);
    }
    if (panelEditor) {
      panelEditor.classList.toggle("is-collapsed", this.isEditorCollapsed);
    }
    if (panelVisualization) {
      panelVisualization.classList.toggle("is-collapsed", this.isVisualizationCollapsed);
    }
    if (expandEditorBtn) {
      expandEditorBtn.setAttribute("aria-hidden", String(!this.isEditorCollapsed));
    }
    if (expandVisualizationBtn) {
      expandVisualizationBtn.setAttribute("aria-hidden", String(!this.isVisualizationCollapsed));
    }

    this.animateCollapseResize();
  }

  private animateCollapseResize(): void {
    const startTime = performance.now();
    const duration = 450; // matching CSS transition time
    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (this.renderer && this.renderer.updateSize()) {
        this.patchLiveState(this.app.store.getState());
      }
      if (elapsed < duration) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
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

  private isUserSessionActive(): boolean {
    if (!this.selectedExample) {
      return false;
    }
    const userSessions = this.app.getUserSessions();
    return userSessions.some((session) => session.name === this.selectedExample);
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

  private syncWorldDocumentFromConfiguration(configuration: SupportConfiguration): void {
    this.codeEditor.setWorldDocument(serializeWorldDocument(configuration));
  }

  private resolveVisualization(state: AppState): VisualizationState {
    const availableSensors = availableSensorNames(this.configurationDraft).filter((sensor) => sensor !== "matrix");
    const fallback = createDefaultVisualizationState();
    fallback.showLinks = this.visualization?.showLinks !== false;
    fallback.visibleSensors = new Set(availableSensors);
    const evaluator = this.getRendererEvaluator();
    if (!evaluator) {
      Promise.resolve().then(() => {
        this.app.store.setLinksEnabled(fallback.showLinks);
      });
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
      const resolvedRendererType =
        output?.rendererType === "lightweight"
          ? "lightweight"
          : "standard";
      if (this.selectedRendererType !== resolvedRendererType) {
        this.selectedRendererType = resolvedRendererType;
        localStorage.setItem("scafi-web-renderer-type", this.selectedRendererType);
      }
      this.nodeRenderer = output?.renderNode;
      this.edgeRenderer = output?.renderEdge;
      const resolved = resolveVisualizationState(fallback, output, availableSensors);
      Promise.resolve().then(() => {
        this.app.store.setLinksEnabled(resolved.showLinks);
      });
      return resolved;
    } catch (error) {
      this.rendererDocumentError = stringifyError(error);
      this.nodeRenderer = undefined;
      this.edgeRenderer = undefined;
      Promise.resolve().then(() => {
        this.app.store.setLinksEnabled(fallback.showLinks);
      });
      return fallback;
    }
  }

  private getRendererEvaluator(): RendererDocumentEvaluator | undefined {
    const rDoc = this.codeEditor.getRendererDocument();
    if (this.rendererEvaluatorSource === rDoc) {
      return this.rendererEvaluator ?? undefined;
    }
    this.rendererEvaluatorSource = rDoc;
    try {
      this.rendererEvaluator = compileRendererDocument(rDoc);
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

  private triggerToggleSensor(sensorName: string): void {
    if (this.selectedNodeIds.length > 0) {
      this.app.toggleSensor(sensorName, this.selectedNodeIds);

      // Aggiorna subito il valore visualizzato nell'input del sensore per un feedback immediato ed evita disallineamenti
      const selectionSlot = this.root.querySelector<HTMLElement>("[data-selection-panel]");
      if (selectionSlot) {
        const escapedName = sensorName.replaceAll('"', '\\"');
        const input = selectionSlot.querySelector<HTMLInputElement>(`[data-runtime-sensor-input="${escapedName}"]`);
        if (input) {
          const state = this.app.store.getState();
          const primaryNode = this.selectedNodes(state.graph.nodes)[0];
          if (primaryNode) {
            const newValue = primaryNode.labels[sensorName];
            if (newValue !== undefined) {
              input.value = String(newValue);
              input.removeAttribute("data-sensor-mixed");
              const small = input.parentElement?.querySelector("small.sensor-mixed-hint");
              if (small) {
                small.remove();
              }
            }
          }
        }
      }

      if (this.app.store.getState().execution.status === "ready") {
        this.app.tick();
      }
    }
  }

  private getSelectedSensorsList(): string[] {
    const state = this.app.store.getState();
    const selectedNodes = this.selectedNodes(state.graph.nodes);
    const seen = new Set<string>();
    const result: string[] = [];
    for (const node of selectedNodes) {
      for (const label of Object.keys(node.labels)) {
        if (label === "export" || label === "matrix") continue;
        if (seen.has(label)) continue;
        seen.add(label);
        result.push(label);
      }
    }
    return result;
  }
}

// Global scope draft utility functions
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
    matrixColor: firstMatrixColor(matrix) ?? "#bb66ff",
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
      deviceShape: { sensors: {}, initialValues: {} },
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

function firstMatrixColor(matrix?: MatrixValue): string | undefined {
  if (!matrix) return undefined;
  return Object.values(matrix.pixels)[0];
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

function parseRuntimeValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.length > 0 && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return value;
}

// Icons
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

function iconSave(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
}

function iconTrash(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
}

function iconFilePlus(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
}

function iconCopy(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
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

function iconShare(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
}

function iconCheck(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function iconChevronLeft(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
}

function iconChevronRight(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
}

function encodeBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    console.error("Base64 encoding failed:", e);
    return "";
  }
}

function decodeBase64(str: string): string {
  try {
    const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(normalized)));
  } catch (e) {
    console.error("Base64 decoding failed:", e);
    return "";
  }
}