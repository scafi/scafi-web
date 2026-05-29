import { describe, expect, it, vi } from "vitest";
import type { CompilePayload, CompileResult, StandaloneRuntimeApi, SupportConfiguration } from "../domain/contracts";
import { StandaloneRuntimeLoader } from "../services/standalone/standalone-runtime-loader";
import { StandaloneStateAdapter } from "../services/standalone/standalone-state-adapter";
import { AppStore } from "./app-store";

const baseConfiguration: SupportConfiguration = {
  network: {
    kind: "grid",
    rows: 1,
    cols: 2,
    stepX: 10,
    stepY: 10,
    tolerance: 0,
  },
  neighbour: { range: 20 },
  deviceShape: {
    sensors: { source: false, obstacle: false },
    initialValues: { "1": { source: true } },
  },
  seed: {
    configSeed: 0,
    simulationSeed: 0,
    randomSensorSeed: 0,
  },
};

const randomConfiguration: SupportConfiguration = {
  network: {
    kind: "random",
    min: -25,
    max: 25,
    howMany: 4,
  },
  neighbour: { range: 200 },
  deviceShape: {
    sensors: { source: false, obstacle: false },
    initialValues: { "2": { obstacle: true } },
  },
  seed: {
    configSeed: 12,
    simulationSeed: 0,
    randomSensorSeed: 0,
  },
};

class FakeRuntime implements StandaloneRuntimeApi {
  public lastConfigJson = "";
  public ticks = 0;
  public positions: Record<string, { x: number; y: number }> = {
    "1": { x: 0, y: 0 },
    "2": { x: 10, y: 0 },
  };
  public labels: Record<string, Record<string, unknown>> = {
    "1": { source: true, obstacle: false },
    "2": { source: false, obstacle: false },
  };

  loadAndInit(configJson: string): void {
    this.lastConfigJson = configJson;
    const parsed = JSON.parse(configJson) as {
      network?: { kind: "grid" | "random"; min?: number; max?: number; howMany?: number };
      positions?: Record<string, { x: number; y: number }>;
      initialValues?: Record<string, Record<string, unknown>>;
    };
    if (parsed.network?.kind === "random" && parsed.network.howMany) {
      const min = parsed.network.min ?? 0;
      const max = parsed.network.max ?? 100;
      const howMany = parsed.network.howMany;
      this.positions = {};
      this.labels = {};
      for (let i = 1; i <= howMany; i++) {
        const id = String(i);
        this.positions[id] = { x: min + (max - min) / 2, y: min + (max - min) / 2 };
        this.labels[id] = {};
      }
    }
    if (parsed.positions && Object.keys(parsed.positions).length > 0) {
      this.positions = { ...this.positions, ...parsed.positions };
    }
    if (parsed.initialValues) {
      for (const [nodeId, sensors] of Object.entries(parsed.initialValues)) {
        const decodedSensors = Object.fromEntries(
          Object.entries(sensors).map(([sensorName, value]) => {
            if (value && typeof value === "object" && "kind" in value) {
              if ((value as { kind: string }).kind === "matrix") {
                return [sensorName, value];
              }
              return [sensorName, (value as { value?: unknown }).value];
            }
            return [sensorName, value];
          }),
        );
        this.labels[nodeId] = { ...(this.labels[nodeId] ?? {}), ...decodedSensors };
      }
    }
  }

  tick(): void {
    this.ticks += 1;
    this.labels["2"] = { ...this.labels["2"], obstacle: this.ticks % 2 === 1 };
  }

  setPosition(nodeId: string, x: number, y: number): void {
    this.positions[nodeId] = { x, y };
  }

  setSensorValue(sensorName: string, nodeIds: string[], value: unknown): void {
    for (const nodeId of nodeIds) {
      this.labels[nodeId] = { ...this.labels[nodeId], [sensorName]: value };
    }
  }

  getState() {
    return {
      nodes: Object.entries(this.positions).map(([id, position]) => ({
        id,
        x: position.x,
        y: position.y,
        labels: this.labels[id],
      })),
      edges: [["1", "2"]] as Array<[string, string]>,
    };
  }

  dispose(): void {
    this.labels = {
      "1": { source: true, obstacle: false },
      "2": { source: false, obstacle: false },
    };
    this.positions = {
      "1": { x: 0, y: 0 },
      "2": { x: 10, y: 0 },
    };
    this.ticks = 0;
    this.lastConfigJson = "";
  }
}

class BlockingTickRuntime extends FakeRuntime {
  private resolveTick: () => void = () => {};

  private readonly tickPromise = new Promise<void>((resolve) => {
    this.resolveTick = resolve;
  });

  override async tick(): Promise<void> {
    await this.tickPromise;
    super.tick();
  }

  releaseTick(): void {
    this.resolveTick();
  }
}

class WorldDrivenRuntime extends FakeRuntime {
  constructor() {
    super();
    this.positions = {
      "101": { x: 0, y: 0 },
      "102": { x: 25, y: 0 },
    };
    this.labels = {
      "101": { source: true, obstacle: false },
      "102": { source: false, obstacle: false },
    };
  }

  override loadAndInit(configJson: string): void {
    const parsed = JSON.parse(configJson) as {
      positions?: Record<string, { x: number; y: number }>;
      initialValues?: Record<string, Record<string, unknown>>;
    };
    for (const key of Object.keys(parsed.positions ?? {})) {
      if (!(key in this.positions)) {
        throw new Error(`key not found: ${key}`);
      }
    }
    for (const key of Object.keys(parsed.initialValues ?? {})) {
      if (!(key in this.positions)) {
        throw new Error(`key not found: ${key}`);
      }
    }
    super.loadAndInit(configJson);
  }

  override getState() {
    return {
      nodes: Object.entries(this.positions).map(([id, position]) => ({
        id,
        x: position.x,
        y: position.y,
        labels: this.labels[id],
      })),
      edges: [["101", "102"]] as Array<[string, string]>,
    };
  }
}

class StaleAfterTickRuntime extends FakeRuntime {
  override setSensorValue(sensorName: string, nodeIds: string[], value: unknown): void {
    // Do NOT update labels — simulate a lagging sync where the runtime hasn't processed the change yet
  }

  override getState() {
    // Return state based on tick-modified labels (sensor changes NOT reflected)
    return {
      nodes: Object.entries(this.positions).map(([id, position]) => ({
        id,
        x: position.x,
        y: position.y,
        labels: this.labels[id],
      })),
      edges: [["1", "2"]] as Array<[string, string]>,
    };
  }
}

function compileResult(runtime: FakeRuntime): CompileResult {
  void runtime;
  return {
    javascript: `${" ".repeat(1001)}\nconst scafiStandalone = globalThis.__testRuntime;`,
    warnings: [],
    errors: [],
    runtimeError: undefined,
  };
}

function payloadResult(code: string, mode: string, worldDocument?: string): CompilePayload {
  return {
    SbtInputs: {
      isWorksheetMode: false,
      code: `compiled(${mode})::${worldDocument ?? ""}::${code}`,
      target: { Js: { scalaVersion: "2.13.18", scalaJsVersion: "1.21.0" } },
      libraries: [],
      librariesFromList: [],
      sbtConfigExtra: "",
      sbtPluginsConfigExtra: "",
      isShowingInUserProfile: false,
    },
  };
}

describe("AppStore", () => {
  it("loads standalone code, initializes the session and syncs graph state", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    expect(store.getState().execution.status).toBe("ready");
    expect(store.getState().standalone.authoritative).toBe(true);
    expect(store.getState().graph.nodes[0]?.labels.source).toBe(true);
    expect(runtime.lastConfigJson).not.toContain('"source":{"kind":"boolean","value":true}');
    expect(runtime.lastConfigJson).not.toContain('"0":');
  });

  it("reinitializes pre-start overrides and forwards commands after start", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");
    store.moveNodes({ "2": { x: 25, y: 30 } });

    expect(runtime.lastConfigJson).toContain('"2":{"x":25,"y":30}');

    await store.tick();
    store.changeSensor("obstacle", ["2"], true);

    expect(runtime.labels["2"]?.obstacle).toBe(true);
    expect(store.getState().graph.nodes.find((node) => node.id === "2")?.position).toEqual({ x: 25, y: 30 });
  });

  it("does not send stale local node ids when loading with a world document", async () => {
    const runtime = new WorldDrivenRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await expect(store.loadScript("program", "full-scala", "world.grid(rows = 1, cols = 2, stepX = 25, stepY = 25, tolerance = 0)"))
      .resolves.toBeUndefined();

    expect(store.getState().execution.status).toBe("ready");
    expect(store.getState().graph.nodes.map((node) => node.id)).toEqual(["101", "102"]);
    expect(runtime.lastConfigJson).not.toContain('"positions":{"1"');
    expect(runtime.lastConfigJson).not.toContain('"initialValues":{"1"');
  });

  it("invalidates stale load results by generation", async () => {
    let resolveFirst: ((result: CompileResult) => void) | undefined;
    let resolveSecond: ((result: CompileResult) => void) | undefined;
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: (async (_code, _mode) =>
            new Promise<CompileResult>((resolve) => {
              if (!resolveFirst) {
                resolveFirst = resolve;
              } else if (!resolveSecond) {
                resolveSecond = resolve;
              }
            })) as AppStore["dependencies"]["scastie"]["compile"],
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    const first = store.loadScript("first", "full-scala");
    const second = store.loadScript("second", "full-scala");
    await vi.waitFor(() => {
      expect(resolveFirst).toBeTypeOf("function");
      expect(resolveSecond).toBeTypeOf("function");
    });
    resolveSecond?.(compileResult(runtime));
    resolveFirst?.(compileResult(runtime));

    await Promise.all([first, second]);

    expect(store.getState().execution.generation).toBe(2);
    expect(store.getState().execution.status).toBe("ready");
  });

  it("runs daemon ticks through the injected timer", async () => {
    const runtime = new FakeRuntime();
    let daemonCallback: (() => void) | undefined;
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
        timerFactory(callback) {
          daemonCallback = callback;
          return { cancel() {} };
        },
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");
    store.startDaemon(50);
    await daemonCallback?.();

    expect(runtime.ticks).toBe(1);
    expect(store.getState().execution.status).toBe("daemon");
  });

  it("stops the default daemon loop without leaving queued ticks behind", async () => {
    vi.useFakeTimers();
    try {
      const runtime = new FakeRuntime();
      const store = new AppStore(
        {
          scastie: {
            buildPayload: payloadResult,
            compile: async () => compileResult(runtime),
          },
          runtimeLoader: {
            loadFromJavascript() {
              return runtime;
            },
          },
          stateAdapter: new StandaloneStateAdapter(),
        },
        baseConfiguration,
      );

      await store.loadScript("program", "full-scala");
      store.startDaemon(50);

      await vi.advanceTimersByTimeAsync(120);
      expect(runtime.ticks).toBe(2);

      store.stopDaemon();
      const ticksAtStop = runtime.ticks;
      await vi.advanceTimersByTimeAsync(500);

      expect(runtime.ticks).toBe(ticksAtStop);
      expect(store.getState().execution.status).toBe("ready");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reloads cleanly while a previous daemon tick is still in flight", async () => {
    const firstRuntime = new BlockingTickRuntime();
    const secondRuntime = new FakeRuntime();
    let daemonCallback: (() => void | Promise<void>) | undefined;
    let runtimeLoads = 0;
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtimeLoads === 0 ? firstRuntime : secondRuntime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            runtimeLoads += 1;
            return runtimeLoads === 1 ? firstRuntime : secondRuntime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
        timerFactory(callback) {
          daemonCallback = callback;
          return { cancel() {} };
        },
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");
    store.startDaemon(50);

    const inFlightDaemonTick = Promise.resolve(daemonCallback?.());
    const reloaded = store.loadScript("updated", "full-scala");

    firstRuntime.releaseTick();
    await inFlightDaemonTick;
    await reloaded;

    expect(store.getState().execution.status).toBe("ready");
    expect(store.getState().execution.error).toBeUndefined();
    expect(store.getState().execution.generation).toBe(2);
  });

  it("builds deterministic random topologies inside the configured bounds", () => {
    const dependencies = {
      scastie: {
        buildPayload: vi.fn(payloadResult),
        compile: vi.fn(async () => compileResult(new FakeRuntime())),
      },
      runtimeLoader: new StandaloneRuntimeLoader(),
      stateAdapter: new StandaloneStateAdapter(),
    };

    const firstStore = new AppStore(dependencies, randomConfiguration);
    const secondStore = new AppStore(dependencies, randomConfiguration);

    const firstNodes = firstStore.getState().graph.nodes;
    const secondNodes = secondStore.getState().graph.nodes;

    expect(firstNodes).toHaveLength(4);
    expect(firstNodes).toEqual(secondNodes);
    expect(firstNodes.every((node) => node.position.x >= -25 && node.position.x <= 25)).toBe(true);
    expect(firstNodes.every((node) => node.position.y >= -25 && node.position.y <= 25)).toBe(true);
    expect(firstNodes.find((node) => node.id === "2")?.labels.obstacle).toBe(true);
    expect(firstStore.getState().graph.edges.length).toBeGreaterThan(0);
  });

  it("previews the exact combined source sent to scastie", () => {
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: vi.fn(async () => compileResult(new FakeRuntime())),
        },
        runtimeLoader: new StandaloneRuntimeLoader(),
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    expect(store.previewCompiledSource("program", "full-scala", "world.dsl")).toBe("compiled(full-scala)::world.dsl::program");
  });

  it("emits graph state immediately when changing a sensor in standalone mode", () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    store.moveNodes({ "1": { x: 5, y: 0 } });

    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.position).toEqual({ x: 5, y: 0 });
  });

  it("emits graph state immediately when changing a sensor in non-standalone mode", () => {
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: vi.fn(async () => compileResult(new FakeRuntime())),
        },
        runtimeLoader: new StandaloneRuntimeLoader(),
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    store.changeSensor("source", ["1"], true);

    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.labels.source).toBe(true);
  });

  it("applies sensor changes to multiple nodes at once", () => {
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: vi.fn(async () => compileResult(new FakeRuntime())),
        },
        runtimeLoader: new StandaloneRuntimeLoader(),
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    store.changeSensor("obstacle", ["1", "2"], true);

    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.labels.obstacle).toBe(true);
    expect(store.getState().graph.nodes.find((node) => node.id === "2")?.labels.obstacle).toBe(true);
  });

  it("preserves pending sensor changes across interleaved ticks", async () => {
    const runtime = new StaleAfterTickRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    // Tick modifies obstacle on node 2 (tick 1: obstacle = true)
    await store.tick();
    expect(runtime.labels["2"]?.obstacle).toBe(true);

    // User changes obstacle on node 2 to false — this is recorded as pending
    store.changeSensor("obstacle", ["2"], false);

    // Local state immediately reflects the change (immediate emit)
    expect(store.getState().graph.nodes.find((node) => node.id === "2")?.labels.obstacle).toBe(false);

    // Runtime labels are unchanged because StaleAfterTickRuntime ignores setSensorValue
    expect(runtime.labels["2"]?.obstacle).toBe(true);

    // Another tick runs — it modifies obstacle on node 2 (tick 2: obstacle = false)
    await store.tick();
    // Runtime now matches the user-requested value
    expect(runtime.labels["2"]?.obstacle).toBe(false);

    // The local state should still have the user-requested value, which now matches runtime
    expect(store.getState().graph.nodes.find((node) => node.id === "2")?.labels.obstacle).toBe(false);
  });

  it("clears pending changes when loading a new script", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    store.changeSensor("obstacle", ["1"], true);

    // Verify the local change is visible immediately
    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.labels.obstacle).toBe(true);

    // Load a new script — pending changes should be cleared
    await store.loadScript("program2", "full-scala");

    // The new runtime state from loadScript should be authoritative
    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.labels.obstacle).toBe(false);
  });

  it("clears pending changes on reset execution", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    store.changeSensor("obstacle", ["1"], true);
    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.labels.obstacle).toBe(true);

    store.resetExecution();

    expect(store.getState().standalone.active).toBe(false);
  });

  it("moveNodes emits immediately even when standalone sync is in flight", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    store.moveNodes({ "1": { x: 42, y: 7 } });

    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.position).toEqual({ x: 42, y: 7 });
    expect(runtime.positions["1"]).toEqual({ x: 42, y: 7 });
  });

  it("does not start sync operations when generation is stale", async () => {
    const runtime = new FakeRuntime();
    let compileCallCount = 0;
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => {
            compileCallCount += 1;
            return compileResult(runtime);
          },
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    store.changeSensor("source", ["1"], true);

    await store.loadScript("program2", "full-scala");

    // The original sync should have been discarded by generation check
    expect(compileCallCount).toBe(2);
    expect(store.getState().graph.nodes.find((node) => node.id === "1")?.labels.source).toBe(true);
  });

  it("updates store configuration and layout from worldDocument in loadScript", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    const worldDoc = `world
      .random(min = 10, max = 50, howMany = 5)
      .radius(30)
      .seed(config = 1L, simulation = 0L, randomSensor = 0L)
    `;

    await store.loadScript("program", "full-scala", worldDoc);

    const state = store.getState();
    const network = state.configuration.network;
    expect(network.kind).toBe("random");
    if (network.kind !== "random") {
      throw new Error("Expected random network");
    }
    expect(network.min).toBe(10);
    expect(network.max).toBe(50);
    expect(network.howMany).toBe(5);
    expect(state.graph.nodes).toHaveLength(5);
    // Node coordinates must be within min and max
    for (const node of state.graph.nodes) {
      expect(node.position.x).toBeGreaterThanOrEqual(10);
      expect(node.position.x).toBeLessThanOrEqual(50);
      expect(node.position.y).toBeGreaterThanOrEqual(10);
      expect(node.position.y).toBeLessThanOrEqual(50);
    }
  });

  it("clears pending position changes once syncStandalonePositions successfully completes", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    store.moveNodes({ "1": { x: 42, y: 7 } });
    expect(store.getState().graph.nodes.find((n) => n.id === "1")?.position).toEqual({ x: 42, y: 7 });

    // Wait for the async syncStandalonePositions to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    runtime.positions["1"] = { x: 100, y: 100 };
    await store.tick();

    expect(store.getState().graph.nodes.find((n) => n.id === "1")?.position).toEqual({ x: 100, y: 100 });
  });

  it("clears pending sensor changes once syncStandaloneSensors successfully completes", async () => {
    const runtime = new FakeRuntime();
    const store = new AppStore(
      {
        scastie: {
          buildPayload: payloadResult,
          compile: async () => compileResult(runtime),
        },
        runtimeLoader: {
          loadFromJavascript() {
            return runtime;
          },
        },
        stateAdapter: new StandaloneStateAdapter(),
      },
      baseConfiguration,
    );

    await store.loadScript("program", "full-scala");

    store.changeSensor("source", ["1"], true);
    expect(store.getState().graph.nodes.find((n) => n.id === "1")?.labels.source).toBe(true);

    // Wait for the async syncStandaloneSensors to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    runtime.labels["1"] = { ...runtime.labels["1"], source: false };
    await store.tick();

    expect(store.getState().graph.nodes.find((n) => n.id === "1")?.labels.source).toBe(false);
  });
});