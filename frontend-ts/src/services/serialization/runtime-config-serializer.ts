import type {
  EncodedSensorValue,
  MatrixValue,
  RuntimeConfig,
  SupportConfiguration,
  Vec2,
} from "../../domain/contracts";

function isMatrixValue(value: unknown): value is MatrixValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      "dimension" in value &&
      "pixels" in value &&
      typeof (value as MatrixValue).dimension === "number",
  );
}

function encodeDeviceValue(value: unknown): EncodedSensorValue {
  if (typeof value === "string") {
    return { kind: "string", value };
  }
  if (typeof value === "number") {
    return { kind: "double", value };
  }
  if (typeof value === "boolean") {
    return { kind: "boolean", value };
  }
  if (isMatrixValue(value)) {
    const pixels = Object.entries(value.pixels)
      .map(([coordinates, color]) => {
        const [i, j] = coordinates.split(":").map((entry) => Number(entry));
        return [[i, j], color] as [[number, number], string];
      })
      .sort((left, right) => left[0][0] - right[0][0] || left[0][1] - right[0][1]);

    return {
      kind: "matrix",
      dimension: value.dimension,
      pixels,
    };
  }

  return { kind: "string", value: String(value) };
}

function sortRecord<T>(record: Record<string, T>): Array<[string, T]> {
  return Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
}

export class RuntimeConfigSerializer {
  serialize(
    config: SupportConfiguration,
    positions: Record<string, Vec2> = {},
    initialValues?: Record<string, Record<string, unknown>>,
  ): RuntimeConfig {
    const runtimeInitialValues = initialValues === undefined ? config.deviceShape.initialValues : initialValues;

    const encodedInitialValues = Object.fromEntries(
      sortRecord(runtimeInitialValues).map(([nodeId, values]) => [
        nodeId,
        Object.fromEntries(sortRecord(values).map(([name, value]) => [name, encodeDeviceValue(value)])),
      ]),
    );

    const encodedSensors = Object.fromEntries(
      sortRecord(config.deviceShape.sensors).map(([name, value]) => [name, encodeDeviceValue(value)]),
    );

    const result: RuntimeConfig = {
      network: { ...config.network },
      neighbour: { range: config.neighbour.range },
      sensors: encodedSensors,
      initialValues: encodedInitialValues,
      seeds: { ...config.seed },
    };

    if (Object.keys(positions).length > 0) {
      result.positions = Object.fromEntries(
        sortRecord(positions).map(([nodeId, point]) => [nodeId, { x: point.x, y: point.y }]),
      );
    }

    return result;
  }

  toJson(
    config: SupportConfiguration,
    positions: Record<string, Vec2> = {},
    initialValues?: Record<string, Record<string, unknown>>,
  ): string {
    return JSON.stringify(this.serialize(config, positions, initialValues));
  }
}