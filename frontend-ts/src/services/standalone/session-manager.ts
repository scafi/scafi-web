import type { StandaloneRuntimeApi, StandaloneState, Vec2 } from "../../domain/contracts";

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
  }

  attach(runtime: StandaloneRuntimeApi): StandaloneSession {
    const session = { generation: this.nextGeneration(), runtime };
    void Promise.resolve(this.session?.runtime.dispose()).catch(() => {});
    this.session = session;
    this.started = false;
    return session;
  }

  async initialize(): Promise<void> {
    const active = this.requireSession();
    this.started = false;
    await Promise.resolve(active.runtime.loadAndInit());

    // Apply any overridden/dragged positions accumulated
    for (const [nodeId, position] of Object.entries(this.pendingPositions)) {
      await Promise.resolve(active.runtime.setPosition(nodeId, position.x, position.y));
    }
    // Apply any overridden sensor values accumulated
    for (const [nodeId, values] of Object.entries(this.pendingSensors)) {
      for (const [sensorName, value] of Object.entries(values)) {
        await Promise.resolve(active.runtime.setSensorValue(sensorName, [nodeId], value));
      }
    }
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

  private async reinitializePendingState(): Promise<void> {
    await this.initialize();
  }

  private requireSession(): StandaloneSession {
    if (!this.session) {
      throw new Error("No standalone session attached");
    }
    return this.session;
  }
}