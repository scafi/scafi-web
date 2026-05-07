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
  .grid(rows = x, cols = x, stepX = 60, stepY = 60, tolerance = 10)
  .radius(70)
  .matrix(dimension = 3, color = "#bb86fc")
  .seed(config = 0, simulation = 0, randomSensor = 0)
`;

    expect(() => parseWorldDocument(document)).toThrow(/numeric literal/);
    expect(tryParseWorldDocument(document)).toBeUndefined();
  });
});