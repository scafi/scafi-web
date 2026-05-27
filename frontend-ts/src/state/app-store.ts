import type {
  CompileResult,
  GraphSnapshot,
  MaybePromise,
  NodeId,
  StandaloneRuntimeApi,
  StandaloneState,
  SupportConfiguration,
  Vec2,
} from "../domain/contracts";
import { ScastieService, type ScalaSourceMode } from "../services/scastie/scastie-service";
import { RuntimeConfigSerializer } from "../services/serialization/runtime-config-serializer";
import { StandaloneRuntimeLoader } from "../services/standalone/standalone-runtime-loader";
import { StandaloneSessionManager } from "../services/standalone/session-manager";
import { StandaloneStateAdapter } from "../services/standalone/standalone-state-adapter";

type SensorMap = Record<string, Record<string, unknown>>;

interface BackendDevice {
  id: NodeId;
  position: Vec2;
  sensors: Record<string, unknown>;
}

interface BackendState {
  devices: Map<NodeId, BackendDevice>;
  neighbours: Map<NodeId, Set<NodeId>>;
  exports: Map<NodeId, unknown>;
}

export interface AppState {
  configuration: SupportConfiguration;
  graph: GraphSnapshot;
  execution: {
    status: "idle" | "compiling" | "ready" | "daemon" | "error";
    generation: number;
    lastCompiledJavascript?: string;
    warnings: string[];
    error?: string;
    daemonIntervalMs?: number;
  };
  standalone: {
    active: boolean;
    authoritative: boolean;
  };
}

export interface AppStoreDependencies {
  scastie: Pick<ScastieService, "compile" | "buildPayload">;
  runtimeLoader: {
    loadFromJavascript(javascript: string): MaybePromise<StandaloneRuntimeApi>;
  };
  stateAdapter: Pick<StandaloneStateAdapter, "toGraph">;
  sessionManager?: StandaloneSessionManager;
  serializer?: RuntimeConfigSerializer;
  timerFactory?: (callback: () => void | Promise<void>, intervalMs: number) => { cancel(): void };
}

function createCooperativeTimer(callback: () => void | Promise<void>, intervalMs: number): { cancel(): void } {
  let cancelled = false;
  let handle: ReturnType<typeof setTimeout> | undefined;

  const scheduleNext = () => {
    handle = setTimeout(async () => {
      if (cancelled) {
        return;
      }
      await callback();
      if (!cancelled) {
        scheduleNext();
      }
    }, intervalMs);
  };

  scheduleNext();

  return {
    cancel() {
      cancelled = true;
      if (handle !== undefined) {
        clearTimeout(handle);
      }
    },
  };
}

export class AppStore {
  private readonly listeners = new Set<(state: AppState) => void>();
  private readonly sessionManager: StandaloneSessionManager;
  private readonly serializer: RuntimeConfigSerializer;
  private readonly timerFactory: NonNullable<AppStoreDependencies["timerFactory"]>;
  private backend: BackendState;
  private state: AppState;
  private daemon?: { cancel(): void };
  private pendingSensorChanges = new Map<NodeId, Map<string, unknown>>();
  private pendingPositionChanges = new Map<NodeId, Vec2>();

  constructor(
    private readonly dependencies: AppStoreDependencies,
    initialConfiguration: SupportConfiguration,
  ) {
    this.sessionManager = dependencies.sessionManager ?? new StandaloneSessionManager();
    this.serializer = dependencies.serializer ?? new RuntimeConfigSerializer();
    this.timerFactory = dependencies.timerFactory ?? createCooperativeTimer;
    this.backend = buildBackend(initialConfiguration);
    this.state = {
      configuration: initialConfiguration,
      graph: graphFromBackend(this.backend),
      execution: {
        status: "idle",
        generation: 0,
        warnings: [],
      },
      standalone: {
        active: false,
        authoritative: false,
      },
    };
  }

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  evolve(configuration: SupportConfiguration): void {
    this.stopDaemon();
    this.backend = buildBackend(configuration);
    this.pendingSensorChanges.clear();
    this.pendingPositionChanges.clear();
    this.state = {
      ...this.state,
      configuration,
      graph: graphFromBackend(this.backend),
      execution: {
        ...this.state.execution,
        status: this.state.standalone.active ? "ready" : "idle",
        error: undefined,
      },
    };
    if (this.state.standalone.active) {
      void this.reinitializeStandaloneSession(configuration);
    }
    this.emit();
  }

  previewCompiledSource(code: string, mode: ScalaSourceMode, worldDocument?: string): string {
    return this.dependencies.scastie.buildPayload(code, mode, worldDocument).SbtInputs.code;
  }

  async loadScript(code: string, mode: ScalaSourceMode, worldDocument?: string): Promise<void> {
    this.stopDaemon();
    this.pendingSensorChanges.clear();
    this.pendingPositionChanges.clear();
    const generation = this.state.execution.generation + 1;
    this.patch({
      execution: {
        ...this.state.execution,
        status: "compiling",
        generation,
        error: undefined,
        warnings: [],
      },
      standalone: {
        active: false,
        authoritative: false,
      },
    });
    await this.sessionManager.clear();

    let compiled: CompileResult;
    try {
      compiled = await this.dependencies.scastie.compile(code, mode, worldDocument);
    } catch (error) {
      if (generation !== this.state.execution.generation) {
        return;
      }
      this.patch({
        execution: {
          ...this.state.execution,
          status: "error",
          error: stringifyError(error),
        },
      });
      return;
    }

    if (generation !== this.state.execution.generation) {
      return;
    }

    if (compiled.javascript.length < 1000) {
      this.patch({
        execution: {
          ...this.state.execution,
          status: "error",
          warnings: compiled.warnings,
          error: `Compilation returned short content (${compiled.javascript.length} bytes)`,
        },
      });
      return;
    }

    try {
      const runtime = await this.dependencies.runtimeLoader.loadFromJavascript(compiled.javascript);
      if (generation !== this.state.execution.generation) {
        await Promise.resolve(runtime.dispose());
        return;
      }
      await this.attachStandaloneRuntime(runtime, compiled, generation);
    } catch (error) {
      if (generation !== this.state.execution.generation) {
        return;
      }
      this.patch({
        execution: {
          ...this.state.execution,
          status: "error",
          warnings: compiled.warnings,
          error: stringifyError(error),
        },
      });
    }
  }

  async tick(expectedGeneration = this.state.execution.generation): Promise<void> {
    this.ensureStandaloneReady();
    await this.sessionManager.tick();
    if (!this.isStandaloneGenerationCurrent(expectedGeneration)) {
      return;
    }
    const runtimeState = await this.sessionManager.getState();
    if (!this.isStandaloneGenerationCurrent(expectedGeneration)) {
      return;
    }
    this.syncFromRuntimeState(runtimeState);
  }

  startDaemon(intervalMs: number): void {
    this.ensureStandaloneReady();
    this.stopDaemon();
    const daemonGeneration = this.state.execution.generation;
    this.daemon = this.timerFactory(async () => {
      if (!this.isStandaloneGenerationCurrent(daemonGeneration) || this.state.execution.status !== "daemon") {
        return;
      }
      try {
        await this.tick(daemonGeneration);
      } catch (error) {
        if (!this.isStandaloneGenerationCurrent(daemonGeneration) || this.state.execution.status !== "daemon") {
          return;
        }
        this.stopDaemon();
        this.patch({
          execution: {
            ...this.state.execution,
            status: "error",
            error: stringifyError(error),
          },
        });
      }
    }, intervalMs);
    this.patch({
      execution: {
        ...this.state.execution,
        status: "daemon",
        daemonIntervalMs: intervalMs,
      },
    });
  }

  stopDaemon(): void {
    this.daemon?.cancel();
    this.daemon = undefined;
    if (this.state.execution.status === "daemon") {
      this.patch({
        execution: {
          ...this.state.execution,
          status: this.state.standalone.active ? "ready" : "idle",
          daemonIntervalMs: undefined,
        },
      });
    }
  }

  resetExecution(): void {
    this.stopDaemon();
    this.pendingSensorChanges.clear();
    this.pendingPositionChanges.clear();
    void this.sessionManager.clear();
    this.patch({
      execution: {
        ...this.state.execution,
        status: "idle",
        error: undefined,
        warnings: [],
      },
      standalone: {
        active: false,
        authoritative: false,
      },
    });
  }

  moveNodes(positionMap: Record<NodeId, Vec2>): void {
    for (const [id, position] of Object.entries(positionMap)) {
      const device = this.backend.devices.get(id);
      if (device) {
        this.backend.devices.set(id, { ...device, position });
        this.pendingPositionChanges.set(id, { ...position });
      }
    }
    this.refreshLocalGraph();
    if (this.state.standalone.active) {
      void this.syncStandalonePositions(positionMap);
    }
  }

  changeSensor(sensorName: string, nodeIds: NodeId[], value: unknown): void {
    if (nodeIds.length === 0) {
      return;
    }
    for (const nodeId of nodeIds) {
      const device = this.backend.devices.get(nodeId);
      if (device) {
        this.backend.devices.set(nodeId, {
          ...device,
          sensors: { ...device.sensors, [sensorName]: value },
        });
        const nodePending = this.pendingSensorChanges.get(nodeId) ?? new Map<string, unknown>();
        nodePending.set(sensorName, value);
        this.pendingSensorChanges.set(nodeId, nodePending);
      }
    }
    this.refreshLocalGraph();
    if (this.state.standalone.active) {
      void this.syncStandaloneSensors(sensorName, nodeIds, value);
    }
  }

  toggleSensor(sensorName: string, nodeIds: NodeId[]): void {
    if (nodeIds.length === 0) {
      return;
    }
    const byValue = new Map<boolean, NodeId[]>();
    for (const nodeId of nodeIds) {
      const currentValue = this.backend.devices.get(nodeId)?.sensors[sensorName];
      if (typeof currentValue === "boolean") {
        const group = byValue.get(currentValue) ?? [];
        group.push(nodeId);
        byValue.set(currentValue, group);
      }
    }
    for (const [currentValue, ids] of byValue.entries()) {
      this.changeSensor(sensorName, ids, !currentValue);
    }
  }

  dispose(): void {
    this.stopDaemon();
    void this.sessionManager.clear();
  }

  private async attachStandaloneRuntime(runtime: StandaloneRuntimeApi, result: CompileResult, generation: number): Promise<void> {
    this.sessionManager.attach(runtime);
    await this.sessionManager.initialize(runtimeBootstrapConfiguration(this.state.configuration), {}, {});
    this.syncFromRuntimeState(await this.sessionManager.getState());
    if (generation !== this.state.execution.generation) {
      await this.sessionManager.clear();
      return;
    }
    this.patch({
      execution: {
        ...this.state.execution,
        status: "ready",
        warnings: result.warnings,
        lastCompiledJavascript: result.javascript,
        error: result.runtimeError,
      },
      standalone: {
        active: true,
        authoritative: true,
      },
    });
  }

  private async reinitializeStandaloneSession(configuration: SupportConfiguration): Promise<void> {
    const generation = this.state.execution.generation;
    try {
      await this.sessionManager.initialize(configuration, this.currentPositions(), this.currentSensorValues());
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      const runtimeState = await this.sessionManager.getState();
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      this.syncFromRuntimeState(runtimeState);
    } catch (error) {
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      this.handleStandaloneError(error);
    }
  }

  private async syncStandalonePositions(positionMap: Record<NodeId, Vec2>): Promise<void> {
    const generation = this.state.execution.generation;
    if (!this.isStandaloneGenerationCurrent(generation)) {
      return;
    }
    try {
      await this.sessionManager.setPositions(positionMap);
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      const runtimeState = await this.sessionManager.getState();
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      this.syncFromRuntimeState(runtimeState);
    } catch (error) {
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      this.handleStandaloneError(error);
    }
  }

  private async syncStandaloneSensors(sensorName: string, nodeIds: NodeId[], value: unknown): Promise<void> {
    const generation = this.state.execution.generation;
    if (!this.isStandaloneGenerationCurrent(generation)) {
      return;
    }
    try {
      await this.sessionManager.setSensorValue(sensorName, nodeIds, value);
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      const runtimeState = await this.sessionManager.getState();
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      this.syncFromRuntimeState(runtimeState);
    } catch (error) {
      if (!this.isStandaloneGenerationCurrent(generation)) {
        return;
      }
      this.handleStandaloneError(error);
    }
  }

  private syncFromRuntimeState(state: StandaloneState): void {
    const parsed = this.dependencies.stateAdapter.toGraph(state);
    if (!parsed) {
      throw new Error("Standalone state is malformed");
    }
    this.backend = backendFromGraph(parsed.graph);

    for (const [nodeId, sensors] of this.pendingSensorChanges) {
      const device = this.backend.devices.get(nodeId);
      if (!device) {
        continue;
      }
      for (const [sensorName, pendingValue] of sensors) {
        if (device.sensors[sensorName] !== pendingValue) {
          device.sensors[sensorName] = pendingValue;
        }
      }
    }

    for (const [nodeId, pendingPos] of this.pendingPositionChanges) {
      const device = this.backend.devices.get(nodeId);
      if (!device) {
        continue;
      }
      if (device.position.x !== pendingPos.x || device.position.y !== pendingPos.y) {
        device.position = { ...pendingPos };
      }
    }

    this.patch({
      graph: graphFromBackend(this.backend, parsed.graph.edges),
      execution: {
        ...this.state.execution,
        warnings: parsed.warnings,
      },
      standalone: {
        active: true,
        authoritative: true,
      },
    });
  }

  private currentPositions(): Record<NodeId, Vec2> {
    const positions: Record<NodeId, Vec2> = {};
    for (const [id, device] of this.backend.devices.entries()) {
      positions[id] = { ...device.position };
    }
    return positions;
  }

  private currentSensorValues(): SensorMap {
    const tracked = trackedSensorNames(this.state.configuration);
    const values: SensorMap = {};
    for (const [id, device] of this.backend.devices.entries()) {
      const sensors: Record<string, unknown> = {};
      let hasTracked = false;
      for (const [sensorName, value] of Object.entries(device.sensors)) {
        if (tracked.has(sensorName)) {
          sensors[sensorName] = value;
          hasTracked = true;
        }
      }
      if (hasTracked) {
        values[id] = sensors;
      }
    }
    return values;
  }

  private refreshLocalGraph(): void {
    this.patch({
      graph: graphFromBackend(this.backend, this.state.graph.edges),
      standalone: {
        ...this.state.standalone,
        authoritative: false,
      },
    });
  }

  private ensureStandaloneReady(): void {
    if (!this.state.standalone.active) {
      throw new Error("No standalone session attached");
    }
  }

  private isStandaloneGenerationCurrent(expectedGeneration: number): boolean {
    return this.state.standalone.active && this.state.execution.generation === expectedGeneration;
  }

  private handleStandaloneError(error: unknown): void {
    this.patch({
      execution: {
        ...this.state.execution,
        status: "error",
        error: stringifyError(error),
      },
    });
  }

  private patch(patch: Partial<AppState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function backendFromGraph(graph: GraphSnapshot): BackendState {
  const devices = new Map<NodeId, BackendDevice>();
  const neighbours = new Map<NodeId, Set<NodeId>>();
  const exports = new Map<NodeId, unknown>();

  for (const node of graph.nodes) {
    const sensors = { ...node.labels };
    delete sensors.export;

    devices.set(node.id, {
      id: node.id,
      position: { ...node.position },
      sensors,
    });
    if ("export" in node.labels) {
      exports.set(node.id, node.labels.export);
    }
    neighbours.set(node.id, new Set<NodeId>());
  }

  for (const edge of graph.edges) {
    neighbours.get(edge.from)?.add(edge.to);
    neighbours.get(edge.to)?.add(edge.from);
  }

  return { devices, neighbours, exports };
}

function runtimeBootstrapConfiguration(configuration: SupportConfiguration): SupportConfiguration {
  return {
    network: { ...configuration.network },
    neighbour: { ...configuration.neighbour },
    deviceShape: {
      sensors: {},
      initialValues: {},
    },
    seed: { ...configuration.seed },
  };
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function computeNeighbours(
  positions: Map<NodeId, Vec2>,
  range: number
): Map<NodeId, Set<NodeId>> {
  const neighbours = new Map<NodeId, Set<NodeId>>();
  for (const id of positions.keys()) {
    neighbours.set(id, new Set<NodeId>());
  }

  if (range <= 0) {
    return neighbours;
  }

  const cellSize = range;
  const grid = new Map<string, { id: NodeId; position: Vec2 }[]>();

  const getCellKey = (cx: number, cy: number) => `${cx},${cy}`;

  for (const [id, position] of positions.entries()) {
    const cx = Math.floor(position.x / cellSize);
    const cy = Math.floor(position.y / cellSize);
    const key = getCellKey(cx, cy);
    let cell = grid.get(key);
    if (!cell) {
      cell = [];
      grid.set(key, cell);
    }
    cell.push({ id, position });
  }

  const rangeSq = range * range;
  for (const [id, position] of positions.entries()) {
    const cx = Math.floor(position.x / cellSize);
    const cy = Math.floor(position.y / cellSize);
    const linked = neighbours.get(id)!;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const otherCell = grid.get(getCellKey(cx + dx, cy + dy));
        if (!otherCell) {
          continue;
        }
        for (const other of otherCell) {
          if (other.id === id) {
            continue;
          }
          const distDx = position.x - other.position.x;
          const distDy = position.y - other.position.y;
          const distSq = distDx * distDx + distDy * distDy;
          if (distSq <= rangeSq) {
            linked.add(other.id);
          }
        }
      }
    }
  }

  return neighbours;
}

function buildBackend(configuration: SupportConfiguration): BackendState {
  const devices = new Map<NodeId, BackendDevice>();
  const neighbours = new Map<NodeId, Set<NodeId>>();
  const exports = new Map<NodeId, unknown>();

  if (configuration.network.kind === "grid") {
    const { rows, cols, stepX, stepY, tolerance } = configuration.network;
    const range = configuration.neighbour.range;
    const random = seededRandom(configuration.seed.configSeed);
    const positions = new Map<NodeId, Vec2>();

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const id = String(row * cols + col + 1);
        const tx = tolerance > 0 ? (random() - 0.5) * tolerance : 0;
        const ty = tolerance > 0 ? (random() - 0.5) * tolerance : 0;
        positions.set(id, { x: col * stepX + tx, y: row * stepY + ty });
      }
    }

    for (const [id, position] of positions.entries()) {
      const sensors = { ...configuration.deviceShape.sensors };
      devices.set(id, { id, position, sensors });
    }

    const computed = computeNeighbours(positions, range);
    for (const [id, linked] of computed.entries()) {
      neighbours.set(id, linked);
    }
  } else if (configuration.network.kind === "random") {
    const { min, max, howMany } = configuration.network;
    const range = configuration.neighbour.range;
    const random = seededRandom(configuration.seed.configSeed);
    const positions = new Map<NodeId, Vec2>();
    const span = max - min;

    for (let index = 0; index < howMany; index += 1) {
      const id = String(index + 1);
      positions.set(id, {
        x: min + random() * span,
        y: min + random() * span,
      });
    }

    for (const [id, position] of positions.entries()) {
      const sensors = { ...configuration.deviceShape.sensors };
      devices.set(id, { id, position, sensors });
    }

    const computed = computeNeighbours(positions, range);
    for (const [id, linked] of computed.entries()) {
      neighbours.set(id, linked);
    }
  }

  for (const [id, initialSensors] of Object.entries(configuration.deviceShape.initialValues)) {
    const device = devices.get(id);
    if (device) {
      devices.set(id, {
        ...device,
        sensors: { ...device.sensors, ...initialSensors },
      });
    }
  }

  return { devices, neighbours, exports };
}

function graphFromBackend(backend: BackendState, existingEdges?: { from: NodeId; to: NodeId }[]): GraphSnapshot {
  return {
    nodes: Array.from(backend.devices.values()).map((device) => ({
      id: device.id,
      position: { ...device.position },
      labels: backend.exports.has(device.id)
        ? { ...device.sensors, export: backend.exports.get(device.id) }
        : { ...device.sensors },
    })),
    edges: existingEdges ?? Array.from(backend.neighbours.entries()).flatMap(([id, ids]) =>
      Array.from(ids).map((otherId) => ({ from: id, to: otherId })),
    ),
  };
}

function trackedSensorNames(configuration: SupportConfiguration): Set<string> {
  const names = new Set(Object.keys(configuration.deviceShape.sensors));
  for (const sensors of Object.values(configuration.deviceShape.initialValues)) {
    for (const sensorName of Object.keys(sensors)) {
      names.add(sensorName);
    }
  }
  return names;
}

function seededRandom(seed: number): () => number {
  let current = seed;
  return () => {
    current = Math.sin(current + 1) * 10000;
    return current - Math.floor(current);
  };
}