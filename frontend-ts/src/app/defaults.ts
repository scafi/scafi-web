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
          "0:0": "#bb66ff",
          "0:1": "#bb66ff",
          "0:2": "#bb66ff",
          "1:0": "#bb66ff",
          "1:1": "#bb66ff",
          "1:2": "#bb66ff",
          "2:0": "#bb66ff",
          "2:1": "#bb66ff",
          "2:2": "#bb66ff",
        },
      },
      source: false,
      obstacle: false,
      target: false,
    },
    initialValues: {},
  },
  seed: {
    configSeed: 0,
    simulationSeed: 0,
    randomSensorSeed: 0,
  },
};

export const defaultEditorDocument: EditorDocument = {
  code: '"hello scafi"',
  mode: "easy-scala",
};