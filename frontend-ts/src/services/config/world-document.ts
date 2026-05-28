import type { SupportConfiguration } from "../../domain/contracts";

export function serializeWorldDocument(configuration: SupportConfiguration): string {
  const normalized = normalizeSupportConfiguration(configuration);
  const lines = ["world", serializeNetwork(normalized), `  .radius(${normalized.neighbour.range})`];
  const matrix = normalized.deviceShape.sensors.matrix;
  if (isMatrixValue(matrix) && isUniformMatrix(matrix)) {
    lines.push(`  .matrix(dimension = ${matrix.dimension}, color = ${scalaStringLiteral(firstMatrixColor(matrix))})`);
  } else if (isMatrixValue(matrix)) {
    lines.push(
      `  .matrixPixels(dimension = ${matrix.dimension}, pixels = Seq(${Object.entries(matrix.pixels)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([coordinates, color]) => {
          const [i, j] = coordinates.split(":").map((entry) => Number(entry));
          return `(${i}, ${j}, ${scalaStringLiteral(color)})`;
        })
        .join(", ")}))`,
    );
  }
  for (const [name, value] of Object.entries(normalized.deviceShape.sensors)
    .filter(([name]) => name !== "matrix")
    .sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`  .sensor(${scalaStringLiteral(name)}, ${serializeScalarLiteral(value)})`);
  }
  for (const [nodeId, sensors] of Object.entries(normalized.deviceShape.initialValues).sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true }),
  )) {
    for (const [sensorName, value] of Object.entries(sensors).sort(([left], [right]) => left.localeCompare(right))) {
      lines.push(
        `  .initial(${scalaStringLiteral(nodeId)}, ${scalaStringLiteral(sensorName)}, ${serializeScalarLiteral(value)})`,
      );
    }
  }
  lines.push(
    `  .seed(config = ${normalized.seed.configSeed}L, simulation = ${normalized.seed.simulationSeed}L, randomSensor = ${normalized.seed.randomSensorSeed}L)`,
  );
  return `${lines.join("\n")}\n`;
}

function evaluateExpr(expr: string, vars: Record<string, any>): any {
  let cleaned = expr.trim();
  
  if (Object.prototype.hasOwnProperty.call(vars, cleaned)) {
    return vars[cleaned];
  }
  
  // Handle Range: "A to B"
  if (cleaned.includes("to")) {
    const parts = cleaned.split("to");
    const startVal = evaluateExpr(parts[0], vars);
    const endVal = evaluateExpr(parts[1], vars);
    if (typeof startVal === "number" && !isNaN(startVal) && typeof endVal === "number" && !isNaN(endVal)) {
      return { type: "range", start: Math.floor(startVal), end: Math.floor(endVal) };
    }
  }

  // Detect casting flags at the end
  let asString = false;
  if (/\.toString\s*(?:\(\s*\))?$/.test(cleaned)) {
    asString = true;
    cleaned = cleaned.replace(/\.toString\s*(?:\(\s*\))?$/, "");
  }
  let asInteger = false;
  if (/\.toInt\s*(?:\(\s*\))?$/.test(cleaned)) {
    asInteger = true;
    cleaned = cleaned.replace(/\.toInt\s*(?:\(\s*\))?$/, "");
  }

  // Remove other general .toInt or .toDouble or cast-like calls
  cleaned = cleaned.replace(/\.(?:toInt|toDouble|toString)\b/g, "");

  // Substitute variables in the cleaned expression
  const sortedVarNames = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const name of sortedVarNames) {
    const val = vars[name];
    if (typeof val === "number" || typeof val === "boolean") {
      cleaned = cleaned.replace(new RegExp(`\\b${name}\\b`, "g"), String(val));
    } else if (typeof val === "string") {
      cleaned = cleaned.replace(new RegExp(`\\b${name}\\b`, "g"), JSON.stringify(val));
    }
  }

  // Check if it is a pure arithmetic/numeric expression before evaluating
  let evaluatedValue: any = cleaned;
  if (/^[0-9.+\-*/()\s]+$/.test(cleaned)) {
    try {
      const result = new Function(`return (${cleaned})`)();
      if (typeof result === "number" && !isNaN(result)) {
        evaluatedValue = result;
      }
    } catch {
      // ignore
    }
  } else {
    // String literals
    if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
      evaluatedValue = cleaned.slice(1, -1);
    } else if (cleaned === "true") {
      evaluatedValue = true;
    } else if (cleaned === "false") {
      evaluatedValue = false;
    } else {
      const num = Number(cleaned);
      if (!isNaN(num)) {
        evaluatedValue = num;
      }
    }
  }

  if (typeof evaluatedValue === "number") {
    if (asInteger) {
      evaluatedValue = Math.floor(evaluatedValue);
    }
    if (asString) {
      evaluatedValue = String(evaluatedValue);
    }
  }

  return evaluatedValue;
}

export function preprocessWorldDocument(document: string): string {
  let content = document;
  const variables: Record<string, any> = {};

  // Parse lines: val <name> = <expr>
  const valRegex = /val\s+(?<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?<expr>[^\n;]+)/g;
  let valMatch;
  while ((valMatch = valRegex.exec(content)) !== null) {
    const name = valMatch.groups?.name;
    const expr = valMatch.groups?.expr.trim();
    if (name && expr) {
      variables[name] = evaluateExpr(expr, variables);
    }
  }

  // Remove val declarations so they don't interfere with the rest of the parsing
  content = content.replace(/val\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^\n;]+;?\n?/g, "");

  // Parse and unroll loops: for (i <- 31 to 38) { ... } or for (i <- range_var) { ... }
  const forRegex = /for\s*\(\s*(?<loopVar>[a-zA-Z_][a-zA-Z0-9_]*)\s*<-\s*(?<rangeExpr>[^)]+)\)\s*\{(?<body>[\s\S]*?)\}/g;
  let forMatch;
  while ((forMatch = forRegex.exec(content)) !== null) {
    const matchedText = forMatch[0];
    const loopVar = forMatch.groups?.loopVar;
    const rangeExpr = forMatch.groups?.rangeExpr.trim();
    const body = forMatch.groups?.body;
    if (loopVar && rangeExpr && body) {
      let start = 0;
      let end = -1;
      const resolvedRange = evaluateExpr(rangeExpr, variables);
      if (resolvedRange && resolvedRange.type === "range") {
        start = resolvedRange.start;
        end = resolvedRange.end;
      }

      if (!isNaN(start) && !isNaN(end) && end >= start) {
        let expanded = "";
        for (let i = start; i <= end; i++) {
          let instance = body;
          instance = instance.replace(new RegExp(`${loopVar}\\.toString`, "g"), `"${i}"`);
          instance = instance.replace(new RegExp(`"\\s*\\+\\s*${loopVar}\\s*\\+\\s*"`, "g"), String(i));
          instance = instance.replace(new RegExp(`\\b${loopVar}\\b`, "g"), String(i));
          expanded += instance + "\n";
        }
        content = content.replace(matchedText, expanded);
        forRegex.lastIndex = 0;
      } else {
        content = content.replace(matchedText, "");
        forRegex.lastIndex = 0;
      }
    }
  }

  // Substitute variables inside parameter lists
  for (const [name, val] of Object.entries(variables)) {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      const escapedVal = typeof val === "string" ? `"${val}"` : String(val);
      
      // Substitute for .initial(name, ...)
      const initialRegex = new RegExp(`\\.initial\\(\\s*${name}\\s*,`, "g");
      content = content.replace(initialRegex, `.initial(${escapedVal},`);

      // Substitute for rows = name
      const rowsRegex = new RegExp(`\\brows\\s*=\\s*${name}\\b`, "g");
      content = content.replace(rowsRegex, `rows = ${escapedVal}`);

      // Substitute for cols = name
      const colsRegex = new RegExp(`\\bcols\\s*=\\s*${name}\\b`, "g");
      content = content.replace(colsRegex, `cols = ${escapedVal}`);

      // Substitute for .radius(name)
      const radiusRegex = new RegExp(`\\.radius\\(\\s*${name}\\s*\\)`, "g");
      content = content.replace(radiusRegex, `.radius(${escapedVal})`);
    }
  }

  return content;
}

export function parseWorldDocument(document: string): SupportConfiguration {
  const preprocessed = preprocessWorldDocument(document);
  const trimmed = preprocessed.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(preprocessed) as SupportConfiguration;
    return normalizeSupportConfiguration(parsed);
  }

  const network = parseNetwork(trimmed);
  const radius = capture(trimmed, /\.radius\((?<value>[^)]+)\)/, "World document requires .radius(...)");
  const matrix = parseMatrix(trimmed);
  const parsedSensors = Object.fromEntries(
    Array.from(trimmed.matchAll(/\.sensor\(\s*"(?<name>(?:\\.|[^"\\])*)"\s*,\s*(?<value>[^)]+)\)/g), (match) => [
      unescapeScalaString(match.groups?.name ?? ""),
      parseScalarLiteral(match.groups?.value ?? ""),
    ]),
  );
  const parsedRandomSensors = Object.fromEntries(
    Array.from(trimmed.matchAll(/\.randomSensor\(\s*"(?<name>(?:\\.|[^"\\])*)"\s*,\s*(?<min>[^,]+)\s*,\s*(?<max>[^)]+)\)/g), (match) => [
      unescapeScalaString(match.groups?.name ?? ""),
      parseScalarLiteral(match.groups?.min ?? "0.0"),
    ]),
  );
  const sensors = { ...parsedSensors, ...parsedRandomSensors };
  const initialValues = Array.from(
    trimmed.matchAll(
      /\.initial\(\s*"(?<nodeId>(?:\\.|[^"\\])*)"\s*,\s*"(?<sensor>(?:\\.|[^"\\])*)"\s*,\s*(?<value>[^)]+)\)/g,
    ),
  ).reduce<Record<string, Record<string, unknown>>>((accumulator, match) => {
    const nodeId = unescapeScalaString(match.groups?.nodeId ?? "");
    const sensorName = unescapeScalaString(match.groups?.sensor ?? "");
    const currentNode = accumulator[nodeId] ?? {};
    currentNode[sensorName] = parseScalarLiteral(match.groups?.value ?? "");
    accumulator[nodeId] = currentNode;
    return accumulator;
  }, {});
  const seedMatch = trimmed.match(
    /\.seed\(\s*config\s*=\s*(?<config>[^,]+),\s*simulation\s*=\s*(?<simulation>[^,]+),\s*randomSensor\s*=\s*(?<randomSensor>[^)]+)\)/,
  );
  const seeds = seedMatch?.groups
    ? {
        configSeed: parseNumericLiteral(seedMatch.groups.config, ".seed(config = ...) requires a numeric literal"),
        simulationSeed: parseNumericLiteral(
          seedMatch.groups.simulation,
          ".seed(simulation = ...) requires a numeric literal",
        ),
        randomSensorSeed: parseNumericLiteral(
          seedMatch.groups.randomSensor,
          ".seed(randomSensor = ...) requires a numeric literal",
        ),
      }
    : { configSeed: 0, simulationSeed: 0, randomSensorSeed: 0 };

  return normalizeSupportConfiguration({
    network,
    neighbour: { range: parseNumericLiteral(radius, ".radius(...) requires a numeric literal") },
    deviceShape: {
      sensors: matrix ? { matrix, ...sensors } : sensors,
      initialValues,
    },
    seed: seeds,
  });
}

export function tryParseWorldDocument(document: string): SupportConfiguration | undefined {
  try {
    return parseWorldDocument(document);
  } catch {
    return undefined;
  }
}

function normalizeSupportConfiguration(configuration: SupportConfiguration): SupportConfiguration {
  if (configuration.network.kind === "grid") {
    return {
      network: {
        kind: "grid",
        rows: Number(configuration.network.rows),
        cols: Number(configuration.network.cols),
        stepX: Number(configuration.network.stepX),
        stepY: Number(configuration.network.stepY),
        tolerance: Number(configuration.network.tolerance),
      },
      neighbour: { range: Number(configuration.neighbour.range) },
      deviceShape: normalizeDeviceShape(configuration.deviceShape),
      seed: normalizeSeeds(configuration.seed),
    };
  }

  return {
    network: {
      kind: "random",
      min: Number(configuration.network.min),
      max: Number(configuration.network.max),
      howMany: Number(configuration.network.howMany),
    },
    neighbour: { range: Number(configuration.neighbour.range) },
    deviceShape: normalizeDeviceShape(configuration.deviceShape),
    seed: normalizeSeeds(configuration.seed),
  };
}

function normalizeDeviceShape(configuration: SupportConfiguration["deviceShape"]): SupportConfiguration["deviceShape"] {
  return {
    sensors: { ...(configuration.sensors ?? {}) },
    initialValues: Object.fromEntries(
      Object.entries(configuration.initialValues ?? {}).map(([nodeId, values]) => [nodeId, { ...values }]),
    ),
  };
}

function normalizeSeeds(configuration: SupportConfiguration["seed"]): SupportConfiguration["seed"] {
  return {
    configSeed: Number(configuration.configSeed),
    simulationSeed: Number(configuration.simulationSeed),
    randomSensorSeed: Number(configuration.randomSensorSeed),
  };
}

function serializeNetwork(configuration: SupportConfiguration): string {
  if (configuration.network.kind === "grid") {
    return `  .grid(rows = ${configuration.network.rows}, cols = ${configuration.network.cols}, stepX = ${configuration.network.stepX}, stepY = ${configuration.network.stepY}, tolerance = ${configuration.network.tolerance})`;
  }
  return `  .random(min = ${configuration.network.min}, max = ${configuration.network.max}, howMany = ${configuration.network.howMany})`;
}

function parseNetwork(document: string): SupportConfiguration["network"] {
  const grid = document.match(
    /\.grid\(\s*rows\s*=\s*(?<rows>[^,]+),\s*cols\s*=\s*(?<cols>[^,]+),\s*stepX\s*=\s*(?<stepX>[^,]+),\s*stepY\s*=\s*(?<stepY>[^,]+),\s*tolerance\s*=\s*(?<tolerance>[^)]+)\)/,
  );
  if (grid?.groups) {
    return {
      kind: "grid",
      rows: parseNumericLiteral(grid.groups.rows, ".grid(rows = ...) requires a numeric literal"),
      cols: parseNumericLiteral(grid.groups.cols, ".grid(cols = ...) requires a numeric literal"),
      stepX: parseNumericLiteral(grid.groups.stepX, ".grid(stepX = ...) requires a numeric literal"),
      stepY: parseNumericLiteral(grid.groups.stepY, ".grid(stepY = ...) requires a numeric literal"),
      tolerance: parseNumericLiteral(grid.groups.tolerance, ".grid(tolerance = ...) requires a numeric literal"),
    };
  }
  const random = document.match(
    /\.random\(\s*min\s*=\s*(?<min>[^,]+),\s*max\s*=\s*(?<max>[^,]+),\s*howMany\s*=\s*(?<howMany>[^)]+)\)/,
  );
  if (random?.groups) {
    return {
      kind: "random",
      min: parseNumericLiteral(random.groups.min, ".random(min = ...) requires a numeric literal"),
      max: parseNumericLiteral(random.groups.max, ".random(max = ...) requires a numeric literal"),
      howMany: parseNumericLiteral(random.groups.howMany, ".random(howMany = ...) requires a numeric literal"),
    };
  }
  throw new Error("World document requires either .grid(...) or .random(...)");
}

function parseMatrix(document: string): SupportConfiguration["deviceShape"]["sensors"]["matrix"] | undefined {
  const matrix = document.match(
    /\.matrix\(\s*dimension\s*=\s*(?<dimension>[^,]+),\s*color\s*=\s*"(?<color>(?:\\.|[^"\\])*)"\s*\)/,
  );
  if (matrix?.groups) {
    return createMatrixValue(
      parseNumericLiteral(matrix.groups.dimension, ".matrix(dimension = ...) requires a numeric literal"),
      unescapeScalaString(matrix.groups.color),
    );
  }

  const matrixPixels = document.match(
    /\.matrixPixels\(\s*dimension\s*=\s*(?<dimension>[^,]+),\s*pixels\s*=\s*Seq\((?<pixels>[\s\S]*?)\)\s*\)(?=\s*\.|\s*$)/,
  );
  if (!matrixPixels?.groups) {
    return undefined;
  }
  const pixels = Object.fromEntries(
    Array.from(
      matrixPixels.groups.pixels.matchAll(/\(\s*(?<i>[^,]+),\s*(?<j>[^,]+),\s*"(?<color>(?:\\.|[^"\\])*)"\s*\)/g),
      (match) => [
        `${parseNumericLiteral(match.groups?.i ?? "", ".matrixPixels(...) coordinates require numeric literals")}:${parseNumericLiteral(match.groups?.j ?? "", ".matrixPixels(...) coordinates require numeric literals")}`,
        unescapeScalaString(match.groups?.color ?? ""),
      ],
    ),
  );
  return {
    dimension: parseNumericLiteral(matrixPixels.groups.dimension, ".matrixPixels(dimension = ...) requires a numeric literal"),
    pixels,
  };
}

function capture(document: string, pattern: RegExp, errorMessage: string): string {
  const matched = document.match(pattern)?.groups?.value;
  if (!matched) {
    throw new Error(errorMessage);
  }
  return matched;
}

function serializeScalarLiteral(value: unknown): string {
  if (typeof value === "string") {
    return scalaStringLiteral(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return scalaStringLiteral(String(value));
}

function parseScalarLiteral(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return JSON.parse(trimmed);
  }
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  return trimmed;
}

function parseNumericLiteral(value: string, errorMessage: string): number {
  const cleaned = value.trim().replace(/[Ll]$/, "");
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) {
    throw new Error(errorMessage);
  }
  return numeric;
}

function scalaStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function unescapeScalaString(value: string): string {
  return JSON.parse(`"${value}"`);
}

function firstMatrixColor(value: unknown): string {
  if (!value || typeof value !== "object" || !("pixels" in value)) {
    return "#bb86fc";
  }
  const first = Object.values((value as { pixels: Record<string, string> }).pixels)[0];
  return first ?? "#bb86fc";
}

function isUniformMatrix(value: unknown): value is { dimension: number; pixels: Record<string, string> } {
  if (!value || typeof value !== "object" || !("dimension" in value) || !("pixels" in value)) {
    return false;
  }
  const pixels = Object.values((value as { pixels: Record<string, string> }).pixels);
  return pixels.length === 0 || pixels.every((entry) => entry === pixels[0]);
}

function isMatrixValue(value: unknown): value is { dimension: number; pixels: Record<string, string> } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "dimension" in value &&
      "pixels" in value &&
      typeof (value as { dimension: unknown }).dimension === "number",
  );
}

function createMatrixValue(dimension: number, color: string): { dimension: number; pixels: Record<string, string> } {
  const pixels: Record<string, string> = {};
  for (let i = 0; i < dimension; i += 1) {
    for (let j = 0; j < dimension; j += 1) {
      pixels[`${i}:${j}`] = color;
    }
  }
  return { dimension, pixels };
}