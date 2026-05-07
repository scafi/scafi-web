import { describe, expect, it } from "vitest";
import type { StandaloneRuntimeApi, SupportConfiguration } from "../../domain/contracts";
import { StandaloneSessionManager } from "./session-manager";

class SessionRuntime implements StandaloneRuntimeApi {
  public initializations: string[] = [];
  public positions: Array<[string, number, number]> = [];
  public sensorUpdates: Array<[string, string[], unknown]> = [];

  loadAndInit(configJson: string): void {
    this.initializations.push(configJson);
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

const configuration: SupportConfiguration = {
  network: {
    kind: "grid",
    rows: 1,
    cols: 1,
    stepX: 10,
    stepY: 10,
    tolerance: 0,
  },
  neighbour: { range: 20 },
  deviceShape: {
    sensors: { source: false },
    initialValues: {},
  },
  seed: {
    configSeed: 0,
    simulationSeed: 0,
    randomSensorSeed: 0,
  },
};

describe("StandaloneSessionManager", () => {
  it("reinitializes runtime when overrides arrive before the first tick", async () => {
    const runtime = new SessionRuntime();
    const manager = new StandaloneSessionManager();
    manager.attach(runtime);
    await manager.initialize(configuration, { "0": { x: 0, y: 0 } }, { "0": { source: false } });

    await manager.setPositions({ "0": { x: 5, y: 6 } });
    await manager.setSensorValue("source", ["0"], true);

    expect(runtime.initializations).toHaveLength(3);
    expect(runtime.initializations[1]).toContain('"0":{"x":5,"y":6}');
    expect(runtime.initializations[2]).toContain('"source":{"kind":"boolean","value":true}');
  });

  it("forwards incremental updates after the first tick", async () => {
    const runtime = new SessionRuntime();
    const manager = new StandaloneSessionManager();
    manager.attach(runtime);
    await manager.initialize(configuration, { "0": { x: 0, y: 0 } }, { "0": { source: false } });
    await manager.tick();

    await manager.setPositions({ "0": { x: 7, y: 8 } });
    await manager.setSensorValue("source", ["0"], true);

    expect(runtime.positions).toEqual([["0", 7, 8]]);
    expect(runtime.sensorUpdates).toEqual([["source", ["0"], true]]);
  });
});