import { describe, expect, it } from "vitest";
import type { StandaloneRuntimeApi } from "../../domain/contracts";
import { StandaloneSessionManager } from "./session-manager";

class SessionRuntime implements StandaloneRuntimeApi {
  public initializationsCount = 0;
  public positions: Array<[string, number, number]> = [];
  public sensorUpdates: Array<[string, string[], unknown]> = [];

  loadAndInit(): void {
    this.initializationsCount += 1;
  }
  tick(): void {}
  setPosition(nodeId: string, x: number, y: number): void {
    this.positions.push([nodeId, x, y]);
  }
  setSensorValue(sensorName: string, nodeIds: string[], value: unknown): void {
    this.sensorUpdates.push([sensorName, nodeIds, value]);
  }
  getState() {
    return { nodes: [], edges: [] };
  }
  dispose(): void {}
}

describe("StandaloneSessionManager", () => {
  it("reinitializes runtime when overrides arrive before the first tick", async () => {
    const runtime = new SessionRuntime();
    const manager = new StandaloneSessionManager();
    manager.attach(runtime);
    await manager.initialize();

    await manager.setPositions({ "0": { x: 5, y: 6 } });
    await manager.setSensorValue("source", ["0"], true);

    expect(runtime.initializationsCount).toBe(3);
    expect(runtime.positions).toEqual([["0", 5, 6], ["0", 5, 6]]);
    expect(runtime.sensorUpdates).toEqual([["source", ["0"], true]]);
  });

  it("forwards incremental updates after the first tick", async () => {
    const runtime = new SessionRuntime();
    const manager = new StandaloneSessionManager();
    manager.attach(runtime);
    await manager.initialize();
    await manager.tick();

    await manager.setPositions({ "0": { x: 7, y: 8 } });
    await manager.setSensorValue("source", ["0"], true);

    expect(runtime.positions).toEqual([["0", 7, 8]]);
    expect(runtime.sensorUpdates).toEqual([["source", ["0"], true]]);
  });
});