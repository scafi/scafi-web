import type { EditorDocument, SupportConfiguration } from "../domain/contracts";

export const defaultConfiguration: SupportConfiguration = {
  network: {
    kind: "grid",
    rows: 10,
    cols: 10,
    stepX: 60,
    stepY: 60,
    tolerance: 10,
  },
  neighbour: {
    range: 70,
  },
  deviceShape: {
    sensors: {
      matrix: {
        dimension: 3,
        pixels: {
          "0:0": "#bb86fc",
          "0:1": "#bb86fc",
          "0:2": "#bb86fc",
          "1:0": "#bb86fc",
          "1:1": "#bb86fc",
          "1:2": "#bb86fc",
          "2:0": "#bb86fc",
          "2:1": "#bb86fc",
          "2:2": "#bb86fc",
        },
      },
      source: false,
      obstacle: false,
      target: false,
    },
    initialValues: {},
  },
  seed: {
    configSeed: Date.now(),
    simulationSeed: Date.now(),
    randomSensorSeed: Date.now(),
  },
};

export const defaultEditorDocument: EditorDocument = {
  code: '"hello scafi"',
  mode: "easy-scala",
};