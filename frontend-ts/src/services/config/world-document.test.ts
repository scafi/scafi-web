import { describe, expect, it } from "vitest";

import { defaultConfiguration } from "../../app/defaults";
import { parseWorldDocument, serializeWorldDocument, tryParseWorldDocument } from "./world-document";

describe("world-document", () => {
  it("round-trips a support configuration through the persisted world document", () => {
    const configuration = {
      ...defaultConfiguration,
      network: {
        kind: "grid" as const,
        rows: 4,
        cols: 6,
        stepX: 40,
        stepY: 35,
        tolerance: 2,
      },
      neighbour: {
        range: 55,
      },
      deviceShape: {
        sensors: {
          ...defaultConfiguration.deviceShape.sensors,
          source: true,
        },
        initialValues: {
          "1": {
            source: true,
          },
        },
      },
      seed: {
        configSeed: 1,
        simulationSeed: 2,
        randomSensorSeed: 3,
      },
    };

    const document = serializeWorldDocument(configuration);

    expect(parseWorldDocument(document)).toEqual(configuration);
  });

  it("rejects non-literal numeric world arguments for local parsing while allowing callers to preserve the document", () => {
    const document = `val x = 30
world
  .grid(rows = y, cols = y, stepX = 60, stepY = 60, tolerance = 10)
  .radius(70)
  .matrix(dimension = 3, color = "#bb86fc")
  .seed(config = 0, simulation = 0, randomSensor = 0)
`;

    expect(() => parseWorldDocument(document)).toThrow(/numeric literal/);
    expect(tryParseWorldDocument(document)).toBeUndefined();
  });

  it("parses a world document containing .randomSensor", () => {
    const document = `world
  .grid(rows = 10, cols = 10, stepX = 60.0, stepY = 60.0, tolerance = 10.0)
  .radius(70)
  .randomSensor("temperature", 10.0, 30.0)
  .matrix(dimension = 3, color = "#bb86fc")
  .seed(config = 0L, simulation = 0L, randomSensor = 0L)`;
    const config = parseWorldDocument(document);
    expect(config).toBeDefined();
    expect(config.neighbour.range).toBe(70);
    expect(config.deviceShape.sensors).toHaveProperty("temperature", 10.0);
  });

  it("preprocesses world documents with Scala variables and loops", () => {
    const document = `val wall1 = 31 to 33
val targetId = "100"
var w = world
  .grid(rows = 10, cols = 10, stepX = 60, stepY = 60, tolerance = 10)
  .radius(70)
  .sensor("obstacle", false)
  .sensor("source", false)
  .sensor("target", false)
  .initial("1", "source", true)
  .initial(targetId, "target", true)
  .seed(config = 0, simulation = 0, randomSensor = 0)

for (i <- wall1) {
  w = w.initial(i.toString, "obstacle", true)
}
w
`;

    const config = parseWorldDocument(document);
    expect(config.deviceShape.initialValues["31"]?.obstacle).toBe(true);
    expect(config.deviceShape.initialValues["32"]?.obstacle).toBe(true);
    expect(config.deviceShape.initialValues["33"]?.obstacle).toBe(true);
    expect(config.deviceShape.initialValues["100"]?.target).toBe(true);
  });

  it("preprocesses world documents with percentage-based math and variables", () => {
    const document = `val rows = 10
val cols = 10
val wall1Row = (rows * 0.3).toInt
val wall1Start = wall1Row * cols + 1
val wall1End = wall1Row * cols + (cols * 0.8).toInt
val wall1 = wall1Start to wall1End
val targetId = (rows * cols).toString

var w = world
  .grid(rows = rows, cols = cols, stepX = 60, stepY = 60, tolerance = 10)
  .radius(70)
  .sensor("obstacle", false)
  .sensor("source", false)
  .sensor("target", false)
  .initial("1", "source", true)
  .initial(targetId, "target", true)
  .seed(config = 0, simulation = 0, randomSensor = 0)

for (i <- wall1) {
  w = w.initial(i.toString, "obstacle", true)
}
w
`;

    const config = parseWorldDocument(document);
    expect(config.network.kind).toBe("grid");
    // @ts-ignore
    expect(config.network.rows).toBe(10);
    // @ts-ignore
    expect(config.network.cols).toBe(10);
    expect(config.deviceShape.initialValues["31"]?.obstacle).toBe(true);
    expect(config.deviceShape.initialValues["38"]?.obstacle).toBe(true);
    expect(config.deviceShape.initialValues["100"]?.target).toBe(true);
  });
});