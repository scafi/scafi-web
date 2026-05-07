import { describe, expect, it } from "vitest";
import { RuntimeConfigSerializer } from "./runtime-config-serializer";

describe("RuntimeConfigSerializer", () => {
  it("encodes sensors, initial values and positions with stable key ordering", () => {
    const serializer = new RuntimeConfigSerializer();
    const json = serializer.toJson(
      {
        network: {
          kind: "grid",
          rows: 2,
          cols: 3,
          stepX: 60,
          stepY: 60,
          tolerance: 10,
        },
        neighbour: { range: 70 },
        deviceShape: {
          sensors: {
            boolSensor: false,
            textSensor: "hello",
            matrix: {
              dimension: 2,
              pixels: {
                "1:0": "#00ff00",
                "0:1": "#ff0000",
              },
            },
          },
          initialValues: {
            b: { boolSensor: true },
            a: { textSensor: "x" },
          },
        },
        seed: {
          configSeed: 1,
          simulationSeed: 2,
          randomSensorSeed: 3,
        },
      },
      {
        b: { x: 2, y: 1 },
        a: { x: 1, y: 0 },
      },
    );

    expect(json).toContain('"positions":{"a":{"x":1,"y":0},"b":{"x":2,"y":1}}');
    expect(json).toContain('"kind":"matrix"');
    expect(json).toContain('[[0,1],"#ff0000"]');
    expect(json).toContain('[[1,0],"#00ff00"]');
  });
});