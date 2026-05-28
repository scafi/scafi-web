import { parseWorldDocument, tryParseWorldDocument, serializeWorldDocument } from "../services/config/world-document";
import {
  compileRendererDocument,
  createDefaultVisualizationState,
  defaultRendererDocument,
  resolveVisualizationState,
  visualizationToRendererDefaults,
  type EdgeRendererEvaluator,
  type NodeRendererEvaluator,
  type RendererDocumentContext,
  type RendererDocumentEvaluator,
  type VisualizationState,
} from "./renderer-document";

import type {
  EditorDocument,
  ExampleGroup,
  SupportConfiguration,
  Vec2,
} from "../domain/contracts";
import type { AppState } from "../state/app-store";
import { defaultConfiguration, defaultEditorDocument } from "./defaults";
import { ScafiWebApp } from "./scafi-web-app";

// Components
import { ThemeManager } from "./components/theme-manager";
import { CodeEditorComponent } from "./components/code-editor-component";
import { SimulationControlsComponent } from "./components/simulation-controls-component";

// Renderers
import { SvgSimulationRenderer } from "./renderer/svg-simulation-renderer";
import { LightweightSimulationRenderer } from "./renderer/lightweight-simulation-renderer";
import { PixiSimulationRenderer } from "./renderer/pixi-simulation-renderer";
import type { SimulationRenderer } from "./renderer/simulation-renderer";

export class ScafiWebEmbedShell {
  private visualization: VisualizationState = createDefaultVisualizationState();
  private graphPan: Vec2 = { x: 0, y: 0 };
  private graphInteractionMode: "pan" | "selection" = "pan";
  private lastRenderedExecutionStatus: AppState["execution"]["status"] = "idle";
  
  private rendererDocumentError?: string;
  private rendererEvaluatorSource?: string;
  private rendererEvaluator?: RendererDocumentEvaluator | null;
  private nodeRenderer?: NodeRendererEvaluator;
  private edgeRenderer?: EdgeRendererEvaluator;
  
  private pendingLiveState?: AppState;
  private livePatchScheduled = false;

  private readonly themeManager: ThemeManager;
  private readonly codeEditor: CodeEditorComponent;
  private readonly simulationControls: SimulationControlsComponent;

  private renderer!: SimulationRenderer;
  private selectedRendererType: "standard" | "lightweight" | "pixi" = "standard";
  private selectedNodeId: string | null = null;

  // Embed Customizations
  private layout: "split-h" | "split-v" | "sim-only" | "code-only" = "split-h";
  private showControls = true;
  private isEditable = true;
  private autoPlay = false;
  private daemonInterval = 30;
  private isEditorCollapsed = false;
  private showIdOverride: boolean | undefined = undefined;
  private renderMatrixOverride: boolean | undefined = undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {
    this.themeManager = new ThemeManager(root, app);
    this.codeEditor = new CodeEditorComponent(root, app);
    this.simulationControls = new SimulationControlsComponent(root, app);
  }

  async mount(): Promise<void> {
    const params = new URLSearchParams(window.location.search);

    // 1. Theme Configuration
    const themeParam = params.get("theme");
    const selectedTheme = themeParam === "light" ? "light" : "dark";
    this.themeManager.applyTheme(selectedTheme);

    // 2. Read embed visual configurations
    this.layout = (params.get("layout") as any) || "split-h";
    if (!["split-h", "split-v", "sim-only", "code-only"].includes(this.layout)) {
      this.layout = "split-h";
    }
    this.showControls = params.get("controls") !== "false";
    this.isEditable = params.get("editable") !== "false";
    this.autoPlay = false;
    this.daemonInterval = Number(params.get("interval") ?? 30);
    if (Number.isNaN(this.daemonInterval)) this.daemonInterval = 30;

    const showIdParam = params.get("showId");
    if (showIdParam === "false") {
      this.showIdOverride = false;
    } else if (showIdParam === "true") {
      this.showIdOverride = true;
    }

    const renderMatrixParam = params.get("renderMatrix") ?? params.get("matrix");
    if (renderMatrixParam === "false") {
      this.renderMatrixOverride = false;
    } else if (renderMatrixParam === "true") {
      this.renderMatrixOverride = true;
    }

    const bgParam = params.get("bg");
    const glowParam = params.get("glow");
    if (bgParam === "clean" || glowParam === "false") {
      this.root.classList.add("is-clean-bg");
    }

    this.codeEditor.setReadOnly(!this.isEditable);

    // 3. Load or override script, configuration and renderer
    let initialConfig = defaultConfiguration;
    let initialCode = defaultEditorDocument.code;
    let initialMode: EditorDocument["mode"] = "easy-scala";
    let customRendererDoc = defaultRendererDocument;

    // A. Check for predefined example
    const exampleName = params.get("example");
    if (exampleName) {
      try {
        const examples = await this.app.loadExamples();
        const found = examples
          .flatMap((g) => g.examples)
          .find((e) => e.name.toLowerCase() === exampleName.toLowerCase());
        
        if (found) {
          initialCode = found.body;
          initialConfig = buildExampleConfiguration(found);
          customRendererDoc = found.renderer ?? defaultRendererDocument;
        }
      } catch (err) {
        console.error("Failed to load examples", err);
      }
    }

    // B. Check for explicit code parameter override (raw or b64)
    const codeRaw = params.get("code");
    const codeB64 = params.get("code_b64");
    if (codeRaw) {
      initialCode = codeRaw;
    } else if (codeB64) {
      initialCode = decodeBase64(codeB64);
    }

    const modeParam = params.get("mode");
    if (modeParam === "full-scala" || modeParam === "advanced") {
      initialMode = "full-scala";
    }

    // C. Check for world/config parameter override (raw or b64)
    const worldRaw = params.get("world");
    const worldB64 = params.get("world_b64");
    if (worldRaw) {
      const parsed = tryParseWorldDocument(worldRaw);
      if (parsed) initialConfig = parsed;
    } else if (worldB64) {
      const decoded = decodeBase64(worldB64);
      const parsed = tryParseWorldDocument(decoded);
      if (parsed) initialConfig = parsed;
    }

    // D. Check for custom renderer override
    const rendererRaw = params.get("renderer");
    const rendererB64 = params.get("renderer_b64");
    if (rendererRaw) {
      customRendererDoc = rendererRaw;
    } else if (rendererB64) {
      customRendererDoc = decodeBase64(rendererB64);
    }

    // E. Grid size overrides from query parameters
    const rowsParam = params.get("rows");
    const colsParam = params.get("cols");
    if (rowsParam || colsParam) {
      if (initialConfig.network.kind === "grid") {
        initialConfig = {
          ...initialConfig,
          network: {
            ...initialConfig.network,
            rows: rowsParam ? Number(rowsParam) : initialConfig.network.rows,
            cols: colsParam ? Number(colsParam) : initialConfig.network.cols,
          }
        };
      }
    }
    const gridParam = params.get("grid");
    if (gridParam) {
      const match = gridParam.match(/^(\d+)[xX](\d+)$/);
      if (match && initialConfig.network.kind === "grid") {
        initialConfig = {
          ...initialConfig,
          network: {
            ...initialConfig.network,
            rows: Number(match[1]),
            cols: Number(match[2]),
          }
        };
      }
    }

    // 4. Initialize State
    this.app.store.evolve(initialConfig);
    this.codeEditor.initialize(initialConfig);

    // Swap buffers to our loaded script
    this.codeEditor.loadExample({
      name: exampleName ?? "Custom Embed",
      body: initialCode,
      devices: initialConfig.deviceShape,
      world: serializeWorldDocument(initialConfig),
      renderer: customRendererDoc
    }, initialConfig);

    this.selectedRendererType = "standard";

    // 5. Subscription
    this.app.subscribe((event) => {
      if (event.type === "state-changed") {
        if (this.shouldPatchLiveState(event.state)) {
          this.scheduleLiveStatePatch(event.state);
          return;
        }
      }
      this.render();
    });

    // 6. Perform render & launch initial script compilation
    this.render();
 
    setTimeout(() => {
      void (async () => {
        try {
          await this.app.loadScript({ code: initialCode, mode: initialMode }, serializeWorldDocument(initialConfig));
          if (this.autoPlay) {
            this.app.startDaemon(this.daemonInterval);
          }
        } catch (e) {
          console.error("Initial embed script load failed", e);
        }
      })();
    }, 100);

    window.addEventListener("resize", () => {
      if (this.renderer && this.renderer.updateSize()) {
        this.patchLiveState(this.app.store.getState());
      }
    });

    let isVisible = false;
    let wasDaemonRunning = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        isVisible = entry.isIntersecting;
        const state = this.app.store.getState();
        const isCurrentlyRunning = state.execution.status === "daemon";
        
        if (isVisible) {
          if (wasDaemonRunning && !isCurrentlyRunning) {
            this.app.startDaemon(this.daemonInterval);
          }
        } else {
          if (isCurrentlyRunning) {
            wasDaemonRunning = true;
            this.app.stopDaemon();
          }
        }
      }
    }, { threshold: 0.1 });
    observer.observe(this.root);
  }

  private initRenderer(): void {
    const mountPoint = this.root.querySelector<HTMLElement>("#renderer-mount-point");
    if (!mountPoint) return;

    if (this.renderer) {
      this.renderer.destroy();
    }
    mountPoint.innerHTML = "";

    if (this.selectedRendererType === "pixi") {
      this.renderer = new PixiSimulationRenderer();
    } else if (this.selectedRendererType === "lightweight") {
      this.renderer = new LightweightSimulationRenderer();
    } else {
      this.renderer = new SvgSimulationRenderer();
    }

    this.renderer.setGraphPan(this.graphPan);
    this.renderer.mount(mountPoint);

    this.renderer.setCallbacks({
      onNodeClick: (nodeId) => {
        if (this.selectedNodeId === nodeId) {
          this.selectedNodeId = null;
        } else {
          this.selectedNodeId = nodeId;
        }
        this.patchLiveState(this.app.store.getState());
      },
      onNodesDragged: (movedPositions) => {
        if (this.isEditable) {
          this.app.moveNodes(movedPositions);
        }
      },
      onViewportPanned: (pan) => {
        this.graphPan = pan;
      },
      onSelectionApplied: (selectedIds) => {
        if (selectedIds.length > 0) {
          this.selectedNodeId = selectedIds[0];
        } else {
          this.selectedNodeId = null;
        }
        this.patchLiveState(this.app.store.getState());
      },
      onSelectionCleared: () => {
        this.selectedNodeId = null;
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
    this.pendingLiveState = undefined;
    this.livePatchScheduled = false;

    this.codeEditor.destroyCodeEditor();

    const state = this.app.store.getState();
    this.visualization = this.resolveVisualization(state);
    const status = state.execution.status;
    const isLoaded = status === "ready" || status === "daemon";

    const collapsedClass = this.isEditorCollapsed ? "editor-collapsed" : "";
    this.root.innerHTML = `
      <div class="embed-shell theme-${this.themeManager.getTheme()} layout-${this.layout} ${collapsedClass}">
        ${this.showControls ? `
          <header class="embed-toolbar">
            <div class="embed-logo-block">
              <span class="embed-brand">ScaFi</span>
              <div class="embed-status">${this.simulationControls.renderStatusStrip(state)}</div>
            </div>
            <div class="embed-actions">
              <button id="load-script" class="embed-btn primary" ${disabled(status === "compiling")}>${iconPlay()} Compile</button>
              <button id="tick-once" class="embed-btn" ${disabled(!(status === "ready" || status === "daemon"))}>${iconSkipForward()} Step</button>
              <button id="start-daemon" class="embed-btn" ${disabled(status !== "ready")}>${iconPlay()} Run</button>
              <button id="stop-daemon" class="embed-btn" ${disabled(status !== "daemon")}>${iconSquare()} Stop</button>
              
              <div class="embed-divider"></div>
              
              <div class="embed-speed-group">
                ${this.renderSpeedOption("Slow", 60, state.execution.daemonIntervalMs === 60)}
                ${this.renderSpeedOption("Normal", 30, state.execution.daemonIntervalMs === 30 || !state.execution.daemonIntervalMs)}
                ${this.renderSpeedOption("Fast", 10, state.execution.daemonIntervalMs === 10)}
              </div>
            </div>
          </header>
        ` : ""}

        <div class="embed-content">
          ${this.layout !== "sim-only" ? `
            <div class="embed-pane-editor">
              <div class="editor-surface">
                <textarea id="code-editor" spellcheck="false">${escapeHtml(this.codeEditor.getActiveEditorText())}</textarea>
              </div>
            </div>
          ` : ""}
          
          ${this.layout !== "code-only" ? `
            <div class="embed-pane-viz ${!isLoaded ? "viz-unloaded" : ""}">
              <div id="renderer-mount-point" style="width:100%; height:100%;"></div>
              
              <div class="embed-viz-controls">
                ${this.layout !== "sim-only" ? `
                  <button id="toggle-editor" class="embed-icon-btn" title="${this.isEditorCollapsed ? "Mostra codice" : "Nascondi codice / Ingrandisci"}" style="${this.isEditorCollapsed ? "color: var(--accent);" : ""}">
                    ${iconCode()}
                  </button>
                ` : ""}
                <button id="toggle-interaction-mode" class="embed-icon-btn" title="${this.graphInteractionMode === "pan" ? "Modalità Selezione (muovi nodi)" : "Modalità Navigazione (pan vista)"}" style="${this.graphInteractionMode === "selection" ? "color: var(--accent-cool); border-color: var(--accent-cool);" : ""}">
                  ${this.graphInteractionMode === "pan" ? iconMove() : iconMousePointer()}
                </button>
                 <button id="floating-toggle-daemon" class="embed-icon-btn" title="${status === "daemon" ? "Ferma Simulazione" : "Avvia Simulazione"}" ${disabled(status !== "ready" && status !== "daemon")}>
                  ${status === "daemon" ? iconSquare() : iconPlay()}
                </button>
                <button id="restart-simulation" class="embed-icon-btn" title="Riavvia Simulazione" ${disabled(status === "compiling")}>
                  ${iconRestart()}
                </button>
                <button id="reset-view" class="embed-icon-btn" title="Reset view">${iconRotateCcw()}</button>
              </div>

              ${status === "compiling" ? `
                <div class="embed-loading-overlay">
                  <div class="embed-spinner"></div>
                  <span>Compiling script...</span>
                </div>
              ` : ""}

              ${state.execution.error ? `
                <div class="embed-error-banner">
                  <span>${escapeHtml(state.execution.error)}</span>
                </div>
              ` : ""}
            </div>
          ` : ""}
        </div>
      </div>
    `;

    this.lastRenderedExecutionStatus = status;

    // Attach CodeMirror if active
    if (this.layout !== "sim-only") {
      this.codeEditor.attachCodeEditor(this.themeManager.getTheme());
    }

    // Attach Pixi/SVG renderer if active
    if (this.layout !== "code-only") {
      this.initRenderer();
    }

    this.attachListeners();
    this.patchLiveState(state);
  }

  private renderSpeedOption(label: string, intervalMs: number, active: boolean): string {
    return `<button class="embed-speed-pill ${active ? "is-active" : ""}" data-speed="${intervalMs}">${label}</button>`;
  }

  private shouldPatchLiveState(state: AppState): boolean {
    const wasLive = this.lastRenderedExecutionStatus === "daemon" || this.lastRenderedExecutionStatus === "ready";
    const isLive = state.execution.status === "daemon" || state.execution.status === "ready";
    return wasLive && isLive && this.root.childElementCount > 0;
  }

  private patchLiveState(state: AppState): void {
    this.visualization = this.resolveVisualization(state);
    this.lastRenderedExecutionStatus = state.execution.status;

    if (this.showControls) {
      const statusContainer = this.root.querySelector<HTMLElement>(".embed-status");
      if (statusContainer) {
        statusContainer.innerHTML = this.simulationControls.renderStatusStrip(state);
      }

      const loadScriptBtn = this.root.querySelector<HTMLButtonElement>("#load-script");
      if (loadScriptBtn) loadScriptBtn.disabled = state.execution.status === "compiling";
      const tickOnceBtn = this.root.querySelector<HTMLButtonElement>("#tick-once");
      if (tickOnceBtn) tickOnceBtn.disabled = !(state.execution.status === "ready" || state.execution.status === "daemon");
      const startDaemonBtn = this.root.querySelector<HTMLButtonElement>("#start-daemon");
      if (startDaemonBtn) startDaemonBtn.disabled = state.execution.status !== "ready";
      const stopDaemonBtn = this.root.querySelector<HTMLButtonElement>("#stop-daemon");
      if (stopDaemonBtn) stopDaemonBtn.disabled = state.execution.status !== "daemon";

      const activeSpeedMs = state.execution.daemonIntervalMs ?? 30;
      for (const btn of this.root.querySelectorAll<HTMLButtonElement>("[data-speed]")) {
        const speedVal = Number(btn.dataset.speed);
        btn.classList.toggle("is-active", speedVal === activeSpeedMs);
      }
    }

    const floatingToggleBtn = this.root.querySelector<HTMLButtonElement>("#floating-toggle-daemon");
    if (floatingToggleBtn) {
      floatingToggleBtn.disabled = state.execution.status !== "ready" && state.execution.status !== "daemon";
      floatingToggleBtn.title = state.execution.status === "daemon" ? "Ferma Simulazione" : "Avvia Simulazione";
      floatingToggleBtn.innerHTML = state.execution.status === "daemon" ? iconSquare() : iconPlay();
    }

    const restartBtn = this.root.querySelector<HTMLButtonElement>("#restart-simulation");
    if (restartBtn) {
      restartBtn.disabled = state.execution.status === "compiling";
    }

    const errorBanner = this.root.querySelector<HTMLElement>(".embed-error-banner");
    if (errorBanner) {
      if (state.execution.error) {
        errorBanner.style.display = "flex";
        errorBanner.querySelector("span")!.textContent = state.execution.error;
      } else {
        errorBanner.style.display = "none";
      }
    }

    if (this.layout !== "code-only" && this.renderer) {
      this.renderer.update(
        state,
        this.selectedNodeId ? [this.selectedNodeId] : [],
        this.graphInteractionMode,
        this.graphPan,
        this.visualization,
        this.nodeRenderer,
        this.edgeRenderer,
      );
      this.graphPan = this.renderer.getGraphPan();
    }
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

  private attachListeners(): void {
    if (this.showControls) {
      this.bindButton("load-script", () => {
        const activeText = this.codeEditor.getActiveEditorText();
        const activeMode = this.codeEditor.getActiveEditorMode();
        const worldDoc = serializeWorldDocument(this.app.store.getState().configuration);
        void this.app.loadScript({ code: activeText, mode: activeMode }, worldDoc);
      });

      this.bindButton("tick-once", () => {
        void this.app.tick();
      });

      this.bindButton("start-daemon", () => {
        const activeSpeedBtn = this.root.querySelector<HTMLButtonElement>(".embed-speed-pill.is-active");
        const speed = Number(activeSpeedBtn?.dataset.speed ?? 30);
        this.app.startDaemon(speed);
      });

      this.bindButton("stop-daemon", () => {
        this.app.stopDaemon();
      });

      for (const btn of this.root.querySelectorAll<HTMLButtonElement>("[data-speed]")) {
        btn.addEventListener("click", () => {
          const speed = Number(btn.dataset.speed);
          if (this.app.store.getState().execution.status === "daemon") {
            this.app.startDaemon(speed);
          } else {
            this.app.store.startDaemon(speed);
            this.app.store.stopDaemon();
          }
          this.patchLiveState(this.app.store.getState());
        });
      }
    }

    this.bindButton("floating-toggle-daemon", () => {
      const state = this.app.store.getState();
      if (state.execution.status === "daemon") {
        this.app.stopDaemon();
      } else if (state.execution.status === "ready") {
        const activeSpeedBtn = this.root.querySelector<HTMLButtonElement>(".embed-speed-pill.is-active") ||
                               this.root.querySelector<HTMLButtonElement>(".speed-pill.is-active");
        const speed = Number(activeSpeedBtn?.dataset.speed ?? 30);
        this.app.startDaemon(speed);
      }
    });

    this.bindButton("reset-view", () => {
      this.graphPan = { x: 0, y: 0 };
      if (this.renderer) {
        this.renderer.setGraphPan(this.graphPan);
      }
      this.patchLiveState(this.app.store.getState());
    });

    this.bindButton("activate-simulation", () => {
      const activeText = this.codeEditor.getActiveEditorText();
      const activeMode = this.codeEditor.getActiveEditorMode();
      const worldDoc = serializeWorldDocument(this.app.store.getState().configuration);
      void (async () => {
        try {
          await this.app.loadScript({ code: activeText, mode: activeMode }, worldDoc);
          this.app.startDaemon(this.daemonInterval);
        } catch (e) {
          console.error("Manual activation failed", e);
        }
      })();
    });

    this.bindButton("toggle-editor", () => {
      this.isEditorCollapsed = !this.isEditorCollapsed;
      this.render();
      // Force immediate resize of canvas to fill the newly available space
      if (this.renderer) {
        this.renderer.updateSize();
        this.patchLiveState(this.app.store.getState());
      }
    });

    this.bindButton("toggle-interaction-mode", () => {
      this.graphInteractionMode = this.graphInteractionMode === "pan" ? "selection" : "pan";
      this.render();
    });

    this.bindButton("restart-simulation", () => {
      const activeText = this.codeEditor.getActiveEditorText();
      const activeMode = this.codeEditor.getActiveEditorMode();
      const worldDoc = serializeWorldDocument(this.app.store.getState().configuration);
      void (async () => {
        try {
          this.app.resetExecution();
          await this.app.loadScript({ code: activeText, mode: activeMode }, worldDoc);
          if (this.app.store.getState().execution.status === "ready") {
            this.app.startDaemon(this.daemonInterval);
          }
        } catch (e) {
          console.error("Auto restart and play failed", e);
        }
      })();
    });

    window.addEventListener("keydown", (event) => {
      if (this.selectedNodeId && this.isEditable && event.key === "1") {
        const activeEl = document.activeElement;
        if (activeEl && (
          activeEl.tagName === "TEXTAREA" || 
          activeEl.tagName === "INPUT" || 
          activeEl.classList.contains("cm-content")
        )) {
          return;
        }
        this.app.toggleSensor("sensor", [this.selectedNodeId]);
        if (this.app.store.getState().execution.status === "ready") {
          this.app.tick();
        }
      }
    });
  }

  private bindButton(id: string, callback: () => void): void {
    const btn = this.root.querySelector<HTMLButtonElement>(`#${id}`);
    if (btn) {
      btn.addEventListener("click", callback);
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
      this.rendererDocumentError = error instanceof Error ? error.message : String(error);
      return undefined;
    }
  }

  private resolveVisualization(state: AppState): VisualizationState {
    const availableSensors = Object.keys(state.configuration.deviceShape.sensors).filter((sensor) => sensor !== "matrix");
    const fallback = createDefaultVisualizationState();
    if (this.showIdOverride !== undefined) {
      fallback.showId = this.showIdOverride;
    }
    if (this.renderMatrixOverride !== undefined) {
      fallback.renderMatrix = this.renderMatrixOverride;
    }
    fallback.visibleSensors = new Set(availableSensors);
    const evaluator = this.getRendererEvaluator();
    if (!evaluator) {
      return fallback;
    }

    const context: RendererDocumentContext = {
      graph: state.graph,
      execution: state.execution,
      selectedNodeIds: [],
      availableSensors,
      defaults: visualizationToRendererDefaults(fallback),
    };

    try {
      this.rendererDocumentError = undefined;
      const output = evaluator(context);
      const resolvedRendererType =
        output?.rendererType === "pixi"
          ? "pixi"
          : output?.rendererType === "lightweight"
            ? "lightweight"
            : "standard";
      if (this.selectedRendererType !== resolvedRendererType) {
        this.selectedRendererType = resolvedRendererType;
      }
      this.nodeRenderer = output?.renderNode;
      this.edgeRenderer = output?.renderEdge;
      return resolveVisualizationState(fallback, output, availableSensors);
    } catch (error) {
      this.rendererDocumentError = error instanceof Error ? error.message : String(error);
      this.nodeRenderer = undefined;
      this.edgeRenderer = undefined;
      return fallback;
    }
  }
}

// Helpers
function buildExampleConfiguration(example: any): SupportConfiguration {
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

function decodeBase64(str: string): string {
  try {
    const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(normalized)));
  } catch (e) {
    console.error("Base64 decoding failed:", e);
    return "";
  }
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

function iconPlay(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

function iconSkipForward(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`;
}

function iconSquare(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`;
}

function iconRotateCcw(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
}

function iconCode(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
}

function iconPlayLarge(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

function iconMove(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>`;
}

function iconMousePointer(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`;
}

function iconRestart(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M16 3h5v5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 21H3v-5"/></svg>`;
}
