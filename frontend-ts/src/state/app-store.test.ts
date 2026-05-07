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
      positions?: Record<string, { x: number; y: number }>;
      initialValues?: Record<string, Record<string, unknown>>;
    };
    if (parsed.positions) {
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

  dispose(): void {}
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
});