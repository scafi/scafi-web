import { describe, expect, it } from "vitest";
import { MemoryKeyValueStore } from "../browser/key-value-store";
import { ConfigRepository } from "./config-repository";

describe("ConfigRepository", () => {
  it("persists configuration and editor document", () => {
    const repository = new ConfigRepository(new MemoryKeyValueStore());
    repository.saveConfiguration({
      network: { kind: "grid", rows: 1, cols: 1, stepX: 10, stepY: 10, tolerance: 0 },
      neighbour: { range: 20 },
      deviceShape: { sensors: { source: false }, initialValues: {} },
      seed: { configSeed: 1, simulationSeed: 2, randomSensorSeed: 3 },
    });
    repository.saveEditorDocument({ code: "mid()", mode: "easy-scala" });
    repository.saveWorldDocument('{"network":{"kind":"grid"}}');
    repository.saveRendererDocument('return { nodeSize: 14 };');

    expect(repository.loadConfiguration()?.network.kind).toBe("grid");
    expect(repository.loadEditorDocument()).toEqual({ code: "mid()", mode: "easy-scala" });
    expect(repository.loadWorldDocument()).toBe('{"network":{"kind":"grid"}}');
    expect(repository.loadRendererDocument()).toBe('return { nodeSize: 14 };');
  });
});