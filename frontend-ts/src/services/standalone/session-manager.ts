import type { StandaloneRuntimeApi, StandaloneState, SupportConfiguration, Vec2 } from "../../domain/contracts";
import { RuntimeConfigSerializer } from "../serialization/runtime-config-serializer";

type SensorOverrideMap = Record<string, Record<string, unknown>>;

export interface StandaloneSession {
  generation: number;
  runtime: StandaloneRuntimeApi;
}

export class StandaloneSessionManager {
  private generation = 0;
  private session?: StandaloneSession;
  private pendingPositions: Record<string, Vec2> = {};
  private pendingSensors: SensorOverrideMap = {};
  private started = false;
  private lastConfiguration?: SupportConfiguration;
  private lastBasePositions: Record<string, Vec2> = {};
  private lastBaseSensors: SensorOverrideMap = {};

  constructor(private readonly serializer = new RuntimeConfigSerializer()) {}

  nextGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  async clear(): Promise<void> {
    this.generation += 1;
    await Promise.resolve(this.session?.runtime.dispose());
    this.session = undefined;
    this.pendingPositions = {};
    this.pendingSensors = {};
    this.started = false;
    this.lastConfiguration = undefined;
    this.lastBasePositions = {};
    this.lastBaseSensors = {};
  }

  attach(runtime: StandaloneRuntimeApi): StandaloneSession {
    const session = { generation: this.nextGeneration(), runtime };
    void Promise.resolve(this.session?.runtime.dispose()).catch(() => {});
    this.session = session;
    this.started = false;
    return session;
  }

  async initialize(config: SupportConfiguration, positions: Record<string, Vec2>, sensors?: SensorOverrideMap): Promise<void> {
    const active = this.requireSession();
    this.started = false;
    this.lastConfiguration = config;
    this.lastBasePositions = { ...positions };
    this.lastBaseSensors = this.mergeSensors({}, sensors ?? {});
    const effectiveSensors = sensors
      ? this.mergeSensors(sensors, this.pendingSensors)
      : Object.keys(this.pendingSensors).length > 0
        ? this.mergeSensors({}, this.pendingSensors)
        : undefined;
    const configJson = this.serializer.toJson(
      config,
      { ...positions, ...this.pendingPositions },
      effectiveSensors,
    );
    await Promise.resolve(active.runtime.loadAndInit(configJson));
  }

  async tick(): Promise<void> {
    const active = this.requireSession();
    this.started = true;
    await Promise.resolve(active.runtime.tick());
  }

  async setPositions(positionMap: Record<string, Vec2>): Promise<void> {
    const active = this.requireSession();
    this.pendingPositions = { ...this.pendingPositions, ...positionMap };
    if (this.started) {
      for (const [nodeId, position] of Object.entries(positionMap)) {
        await Promise.resolve(active.runtime.setPosition(nodeId, position.x, position.y));
      }
      return;
    }

    await this.reinitializePendingState();
  }

  async setSensorValue(sensorName: string, nodeIds: string[], value: unknown): Promise<void> {
    const active = this.requireSession();
    for (const nodeId of nodeIds) {
      this.pendingSensors[nodeId] = {
        ...(this.pendingSensors[nodeId] ?? {}),
        [sensorName]: value,
      };
    }
    if (this.started) {
      await Promise.resolve(active.runtime.setSensorValue(sensorName, nodeIds, value));
      return;
    }

    await this.reinitializePendingState();
  }

  async getState(options?: { excludeEdges?: boolean; compact?: boolean }): Promise<StandaloneState> {
    return await Promise.resolve(this.requireSession().runtime.getState(options));
  }

  private mergeSensors(base: SensorOverrideMap, overrides: SensorOverrideMap): SensorOverrideMap {
    const merged: SensorOverrideMap = { ...base };
    for (const [nodeId, values] of Object.entries(overrides)) {
      merged[nodeId] = { ...(merged[nodeId] ?? {}), ...values };
    }
    return merged;
  }

  private async reinitializePendingState(): Promise<void> {
    if (!this.lastConfiguration) {
      return;
    }

    await this.initialize(this.lastConfiguration, this.lastBasePositions, this.lastBaseSensors);
  }

  private requireSession(): StandaloneSession {
    if (!this.session) {
      throw new Error("No standalone session attached");
    }
    return this.session;
  }
}