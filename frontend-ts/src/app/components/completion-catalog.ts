import { snippetCompletion, type Completion } from "@codemirror/autocomplete";

/**
 * The offline completion catalog. It is always available and answers instantly, and it is
 * merged with whatever the Scastie Metals presentation compiler returns for the same
 * position. Entries here should mirror what actually exists in the wrapped runtime.
 */
export interface Suggestion {
  /** The identifier CodeMirror matches the typed prefix against. */
  label: string;
  /** Shown in the list instead of `label` when the signature is more informative. */
  signature?: string;
  /** CodeMirror snippet template with `${}` tab stops. Defaults to `label`. */
  snippet?: string;
  description?: string;
  type: "keyword" | "function" | "class" | "snippet" | "variable" | "namespace";
  isLocal?: boolean;
}

export function mapTypeToCm6Type(type: Suggestion["type"]): string {
  switch (type) {
    case "function":
      return "function";
    case "keyword":
      return "keyword";
    case "class":
      return "class";
    case "snippet":
      return "text";
    case "namespace":
      return "namespace";
    default:
      return "variable";
  }
}

export function toCompletion(suggestion: Suggestion): Completion {
  const base: Completion = {
    label: suggestion.label,
    displayLabel: suggestion.signature ?? suggestion.label,
    detail: suggestion.description,
    type: mapTypeToCm6Type(suggestion.type),
    // Symbols defined in the buffer beat catalog entries with the same score.
    boost: suggestion.isLocal ? 1 : 0,
  };
  const template = suggestion.snippet ?? suggestion.label;
  return template === suggestion.label ? base : snippetCompletion(template, base);
}

/**
 * Traits that may appear on the `//using` line. Every name here was verified to resolve at
 * `class MyProgram extends AggregateProgram with …` inside the wrapped runtime.
 */
export const MIXIN_SUGGESTIONS: Suggestion[] = [
  { label: "StandardSensors", type: "class", description: "mid(), sense, nbrRange, currentPosition, nextRandom" },
  { label: "Actuation", type: "class", description: "LED matrix and colour helpers: ledAll, led, hsl, rgb, hue" },
  { label: "Movement2D", type: "class", description: "goToPoint, explore, clockwiseRotation, velocity, zones" },
  { label: "BlockG", type: "class", description: "Gradient-cast building block: G, distanceTo, broadcast, channel" },
  { label: "BlockC", type: "class", description: "Collection building block: C, summarize" },
  { label: "BlockS", type: "class", description: "Sparse-choice leader election: S" },
  { label: "BlockT", type: "class", description: "Time building block: T, timer, limitedMemory" },
  { label: "BlocksWithGC", type: "class", description: "Blocks combining gradient and collection" },
  { label: "BuildingBlocks", type: "class", description: "The whole standard block library at once" },
  { label: "Gradients", type: "class", description: "Gradient algorithms: classic, BIS, CRF, flex" },
  { label: "FieldUtils", type: "class", description: "includingSelf / excludingSelf neighbourhood folds" },
  { label: "StateManagement", type: "class", description: "rep-based helpers: roundCounter, remember, delay" },
  { label: "GenericUtils", type: "class", description: "Generic utilities shared by the blocks" },
  { label: "ExplicitFields", type: "class", description: "Fields as first-class values" },
  { label: "TimeUtils", type: "class", description: "Time-related utilities" },
  { label: "DynamicCode", type: "class", description: "Runtime-provided aggregate code" },
  { label: "SpawnInterface", type: "class", description: "Process spawning primitives" },
  { label: "CustomSpawn", type: "class", description: "Spawn with custom termination and generation policies" },
  { label: "ProcessDSL", type: "class", description: "DSL for generating processes in space and time" },
  { label: "ReplicatedGossip", type: "class", description: "Replicated gossip processes" },
];

export const CODE_SUGGESTIONS: Suggestion[] = [
  // Core ScaFi constructs
  { label: "rep", signature: "rep(init)(fun)", snippet: "rep(${0})(${old} => ${\n  \n})", description: "State evolution over rounds", type: "snippet" },
  { label: "nbr", signature: "nbr(expr)", snippet: "nbr(${expr})", description: "Observe an expression at each neighbour", type: "function" },
  { label: "mux", signature: "mux(cond)(then)(else)", snippet: "mux(${cond})(${then})(${otherwise})", description: "Branch-free conditional; both sides are evaluated", type: "snippet" },
  { label: "branch", signature: "branch(cond)(then)(else)", snippet: "branch(${cond})(${then})(${otherwise})", description: "Domain partition; only the active side is evaluated", type: "snippet" },
  { label: "share", signature: "share(init)(fun)", snippet: "share(${0})(${nbrField} => ${\n  \n})", description: "Share and evolve a field with the neighbourhood", type: "snippet" },
  { label: "align", signature: "align(key)(expr)", snippet: "align(${key})(${key} => ${expr})", description: "Align the evaluation of an expression by key", type: "snippet" },
  { label: "aggregate", signature: "aggregate(expr)", snippet: "aggregate(${expr})", description: "Align an aggregate sub-computation", type: "function" },

  // Neighbourhood folds
  { label: "foldhood", signature: "foldhood(init)(acc)(expr)", snippet: "foldhood(${0})((a, b) => ${a + b})(${expr})", description: "Fold over the neighbourhood, self included", type: "snippet" },
  { label: "foldhoodPlus", signature: "foldhoodPlus(init)(acc)(expr)", snippet: "foldhoodPlus(${0})((a, b) => ${a + b})(${expr})", description: "Fold over the neighbourhood, self excluded", type: "snippet" },
  { label: "minHood", signature: "minHood(expr)", snippet: "minHood(${expr})", description: "Minimum over the neighbourhood, self included", type: "function" },
  { label: "minHoodPlus", signature: "minHoodPlus(expr)", snippet: "minHoodPlus(${expr})", description: "Minimum over the neighbourhood, self excluded", type: "function" },
  { label: "maxHood", signature: "maxHood(expr)", snippet: "maxHood(${expr})", description: "Maximum over the neighbourhood, self included", type: "function" },
  { label: "maxHoodPlus", signature: "maxHoodPlus(expr)", snippet: "maxHoodPlus(${expr})", description: "Maximum over the neighbourhood, self excluded", type: "function" },
  { label: "sumHood", signature: "sumHood(expr)", snippet: "sumHood(${expr})", description: "Sum over the neighbourhood, self included", type: "function" },
  { label: "sumHoodPlus", signature: "sumHoodPlus(expr)", snippet: "sumHoodPlus(${expr})", description: "Sum over the neighbourhood, self excluded", type: "function" },
  { label: "meanHood", signature: "meanHood(expr)", snippet: "meanHood(${expr})", description: "Average over the neighbourhood", type: "function" },
  { label: "anyHood", signature: "anyHood(expr)", snippet: "anyHood(${expr})", description: "True when any neighbour satisfies the predicate", type: "function" },
  { label: "everyHood", signature: "everyHood(expr)", snippet: "everyHood(${expr})", description: "True when every neighbour satisfies the predicate", type: "function" },

  // Sensors — require `//using StandardSensors`
  { label: "mid", signature: "mid()", snippet: "mid()", description: "The local device identifier", type: "function" },
  { label: "sense", signature: "sense[T](name)", snippet: 'sense[${Boolean}]("${name}")', description: "Read a local sensor declared in the world document", type: "snippet" },
  { label: "nbrRange", signature: "nbrRange()", description: "Distance to the neighbour being observed", type: "function" },
  { label: "nbrDelay", signature: "nbrDelay()", description: "Message delay from the neighbour being observed", type: "function" },
  { label: "nbrLag", signature: "nbrLag()", description: "Time elapsed since the neighbour's last message", type: "function" },
  { label: "nbrVector", signature: "nbrVector()", description: "Direction vector towards the neighbour", type: "function" },
  { label: "currentPosition", signature: "currentPosition()", description: "The device position as a Point2D", type: "function" },
  { label: "nextRandom", signature: "nextRandom()", description: "A random Double in [0, 1)", type: "function" },
  { label: "deltaTime", signature: "deltaTime()", description: "Time elapsed since the previous round", type: "function" },

  // Library blocks — each needs the matching `//using` mixin
  { label: "G", signature: "G(source, field, acc, metric)", snippet: "G(${source}, ${field}, (v: ${Double}) => ${v + nbrRange()}, () => ${nbrRange()})", description: "Gradient-cast (BlockG)", type: "snippet" },
  { label: "S", signature: "S(grain, metric)", snippet: "S(${200}, () => ${nbrRange()})", description: "Sparse-choice leader election (BlockS)", type: "snippet" },
  { label: "C", signature: "C[P, V](potential, acc, local, empty)", snippet: "C[${Double}, ${Double}](${potential}, ${_ + _}, ${local}, ${0.0})", description: "Collection towards a source (BlockC)", type: "snippet" },
  { label: "T", signature: "T(initial, decay)", snippet: "T(${initial})", description: "Countdown timer (BlockT)", type: "snippet" },
  { label: "distanceTo", signature: "distanceTo(source)", snippet: "distanceTo(${source})", description: "Hop-free distance to the nearest source (BlockG)", type: "function" },
  { label: "distanceBetween", signature: "distanceBetween(source, target)", snippet: "distanceBetween(${source}, ${target})", description: "Distance between two regions (BlockG)", type: "function" },
  { label: "broadcast", signature: "broadcast(source, value)", snippet: "broadcast(${source}, ${value})", description: "Spread a value outwards from a source (BlockG)", type: "function" },
  { label: "channel", signature: "channel(source, target, width)", snippet: "channel(${source}, ${target}, ${10.0})", description: "Redundant path between two regions (BlockG)", type: "function" },
  { label: "gradient", signature: "gradient(source)", snippet: "gradient(${source})", description: "Distance field from a source (Gradients)", type: "function" },
  { label: "summarize", signature: "summarize(sink, acc, local, empty)", snippet: "summarize(${sink}, ${_ + _}, ${local}, ${0.0})", description: "Collect and aggregate towards a sink (BlockC)", type: "snippet" },
  { label: "timer", signature: "timer(length)", snippet: "timer(${length})", description: "Countdown from a duration (BlockT)", type: "function" },
  { label: "branchedTimer", signature: "branchedTimer(length)", snippet: "branchedTimer(${length})", description: "Timer restarted on branch changes (BlockT)", type: "function" },

  // Actuation — requires `//using Actuation`
  { label: "ledAll", signature: "ledAll to color", snippet: "ledAll to ${color}", description: "Set every LED of the matrix", type: "snippet" },
  { label: "led", signature: "led(row, col) to color", snippet: "led(${row}, ${col}) to ${color}", description: "Set a single LED", type: "snippet" },
  { label: "ledRow", signature: "ledRow(row) to color", snippet: "ledRow(${row}) to ${color}", description: "Set a row of LEDs", type: "snippet" },
  { label: "ledCol", signature: "ledCol(col) to color", snippet: "ledCol(${col}) to ${color}", description: "Set a column of LEDs", type: "snippet" },
  { label: "ledX", signature: "ledX to color", snippet: "ledX to ${color}", description: "Set both diagonals", type: "snippet" },
  { label: "ledO", signature: "ledO to color", snippet: "ledO to ${color}", description: "Set every LED", type: "snippet" },
  { label: "ledD", signature: "ledD to color", snippet: "ledD to ${color}", description: "Set the main diagonal", type: "snippet" },
  { label: "ledAD", signature: "ledAD to color", snippet: "ledAD to ${color}", description: "Set the anti-diagonal", type: "snippet" },
  { label: "off", description: "LED off (black)", type: "variable" },
  { label: "on", description: "LED on (white)", type: "variable" },
  { label: "hsl", signature: "hsl(h, s, l)", snippet: "hsl(${h}, ${0.5}, ${0.5})", description: "Colour from hue, saturation and lightness in [0, 1]", type: "function" },
  { label: "rgb", signature: "rgb(r, g, b)", snippet: "rgb(${r}, ${g}, ${b})", description: "Colour from 0-255 channels", type: "function" },
  { label: "hue", signature: "hue(h)", snippet: "hue(${h})", description: "Colour from a hue, with default saturation and lightness", type: "function" },

  // Movement — requires `//using Movement2D`
  { label: "goToPoint", signature: "goToPoint(x, y, speed)", snippet: "goToPoint(${x}, ${y}, ${100})", description: "Velocity heading towards a point", type: "function" },
  { label: "explore", signature: "explore(zone, time, range, speed)", snippet: "explore(${zone}, ${50})", description: "Random walk inside a zone", type: "snippet" },
  { label: "clockwiseRotation", signature: "clockwiseRotation(center, speed)", snippet: "clockwiseRotation((${x}, ${y}), ${100})", description: "Velocity rotating clockwise around a centre", type: "function" },
  { label: "anticlockwiseRotation", signature: "anticlockwiseRotation(center, speed)", snippet: "anticlockwiseRotation((${x}, ${y}), ${100})", description: "Velocity rotating anticlockwise around a centre", type: "function" },
  { label: "standStill", description: "Zero velocity", type: "variable" },
  { label: "velocity.set", signature: "velocity.set(component)", snippet: "velocity.set(${component})", description: "Actuate a velocity", type: "function" },
  { label: "position.set", signature: "position.set((x, y))", snippet: "position.set((${x}, ${y}))", description: "Actuate an absolute position", type: "function" },
  { label: "Velocity", signature: "Velocity(x, y)", snippet: "Velocity(${x}, ${y})", description: "A Cartesian velocity", type: "class" },
  { label: "Polar", signature: "Polar(module, angle)", snippet: "Polar(${module}, ${angle})", description: "Velocity component in polar coordinates", type: "class" },
  { label: "Cartesian", signature: "Cartesian(dx, dy)", snippet: "Cartesian(${dx}, ${dy})", description: "Velocity component in Cartesian coordinates", type: "class" },
  { label: "CircularZone", signature: "CircularZone((x, y), radius)", snippet: "CircularZone((${x}, ${y}), ${radius})", description: "A circular exploration zone", type: "class" },
  { label: "RectangularZone", signature: "RectangularZone((x, y), width, height)", snippet: "RectangularZone((${x}, ${y}), ${width}, ${height})", description: "A rectangular exploration zone", type: "class" },

  // Maths and geometry
  { label: "math.sin", snippet: "math.sin(${x})", description: "Sine of x, in radians", type: "function" },
  { label: "math.cos", snippet: "math.cos(${x})", description: "Cosine of x, in radians", type: "function" },
  { label: "math.tan", snippet: "math.tan(${x})", description: "Tangent of x, in radians", type: "function" },
  { label: "math.atan2", snippet: "math.atan2(${y}, ${x})", description: "Arctangent of y / x", type: "function" },
  { label: "math.sqrt", snippet: "math.sqrt(${x})", description: "Square root", type: "function" },
  { label: "math.hypot", snippet: "math.hypot(${x}, ${y})", description: "Hypotenuse length", type: "function" },
  { label: "math.abs", snippet: "math.abs(${x})", description: "Absolute value", type: "function" },
  { label: "math.pow", snippet: "math.pow(${x}, ${y})", description: "x raised to the power of y", type: "function" },
  { label: "math.exp", snippet: "math.exp(${x})", description: "e raised to the power of x", type: "function" },
  { label: "math.log", snippet: "math.log(${x})", description: "Natural logarithm", type: "function" },
  { label: "math.min", snippet: "math.min(${a}, ${b})", description: "Smaller of two values", type: "function" },
  { label: "math.max", snippet: "math.max(${a}, ${b})", description: "Larger of two values", type: "function" },
  { label: "math.Pi", description: "The constant pi", type: "variable" },
  { label: "math.E", description: "The constant e", type: "variable" },
  { label: "Point2D", signature: "Point2D(x, y)", snippet: "Point2D(${x}, ${y})", description: "A point or vector in the plane", type: "class" },

  // Scala
  { label: "val", signature: "val x = ...", snippet: "val ${name} = ${value}", description: "Immutable binding", type: "keyword" },
  { label: "var", signature: "var x = ...", snippet: "var ${name} = ${value}", description: "Mutable binding", type: "keyword" },
  { label: "def", signature: "def f(x) = ...", snippet: "def ${name}(${args}) = ${body}", description: "Method definition", type: "keyword" },
  { label: "if", signature: "if (cond) ... else ...", snippet: "if (${cond}) ${then} else ${otherwise}", description: "Conditional expression", type: "keyword" },
  { label: "match", signature: "expr match { case ... }", snippet: "match {\n  case ${pattern} => ${result}\n}", description: "Pattern match", type: "keyword" },
  { label: "import", snippet: "import ${path}", description: "Import a package or member", type: "keyword" },
  { label: "object", snippet: "object ${Name}", description: "Singleton object", type: "keyword" },
  { label: "class", snippet: "class ${Name}", description: "Class definition", type: "keyword" },
  { label: "trait", snippet: "trait ${Name}", description: "Trait definition", type: "keyword" },
  { label: "Option", signature: "Option[T]", snippet: "Option[${T}]", description: "Optional value", type: "class" },
  { label: "Some", signature: "Some(x)", snippet: "Some(${value})", description: "A present optional value", type: "class" },
  { label: "None", description: "An absent optional value", type: "variable" },
  { label: "List", signature: "List(...)", snippet: "List(${items})", description: "Immutable list", type: "class" },
  { label: "Seq", signature: "Seq(...)", snippet: "Seq(${items})", description: "Immutable sequence", type: "class" },
  { label: "Map", signature: "Map(k -> v)", snippet: "Map(${key} -> ${value})", description: "Immutable map", type: "class" },
];

/**
 * The world document is compiled as calls on `WorldDocumentBuilder`, defined in
 * `ScafiStandaloneRuntime.template.scala`. Only methods that exist there belong here.
 */
export const WORLD_SUGGESTIONS: Suggestion[] = [
  { label: "grid", signature: "grid(rows, cols, stepX, stepY, tolerance)", snippet: "grid(rows = ${10}, cols = ${10}, stepX = ${60}, stepY = ${60}, tolerance = ${10})", description: "Lay the devices out on a perturbed grid", type: "function" },
  { label: "random", signature: "random(min, max, howMany)", snippet: "random(min = ${0}, max = ${500}, howMany = ${50})", description: "Scatter devices at random within a square", type: "function" },
  { label: "radius", signature: "radius(range)", snippet: "radius(${70})", description: "Neighbourhood communication range", type: "function" },
  { label: "matrix", signature: "matrix(dimension, color)", snippet: 'matrix(dimension = ${3}, color = "${#bb66ff}")', description: "Give every device an LED matrix of a uniform colour", type: "function" },
  { label: "matrixPixels", signature: "matrixPixels(dimension, pixels)", snippet: 'matrixPixels(dimension = ${3}, pixels = Seq((${0}, ${0}, "${#bb66ff}")))', description: "Give every device an LED matrix with explicit pixels", type: "function" },
  { label: "sensor", signature: "sensor(name, value)", snippet: 'sensor("${name}", ${false})', description: "Declare a sensor with a value shared by every device", type: "function" },
  { label: "randomSensor", signature: "randomSensor(name, min, max)", snippet: 'randomSensor("${name}", ${0.0}, ${1.0})', description: "Declare a sensor with a random per-device value", type: "function" },
  { label: "initial", signature: "initial(nodeId, sensorName, value)", snippet: 'initial("${1}", "${name}", ${true})', description: "Override a sensor on one device", type: "function" },
  { label: "position", signature: "position(nodeId, x, y)", snippet: 'position("${1}", ${0.0}, ${0.0})', description: "Pin one device to an absolute position", type: "function" },
  { label: "positions", signature: "positions(entries)", snippet: 'positions(Seq("${1}" -> (${0.0}, ${0.0})))', description: "Pin several devices at once", type: "function" },
  { label: "seed", signature: "seed(config, simulation, randomSensor)", snippet: "seed(config = ${0}L, simulation = ${0}L, randomSensor = ${0}L)", description: "Fix the three random seeds", type: "function" },
  { label: "seeds", signature: "seeds(config)", snippet: "seeds(${config})", description: "Set the seeds from a raw JS object", type: "function" },
  { label: "neighbour", signature: "neighbour(config)", snippet: "neighbour(${config})", description: "Set the neighbourhood policy from a raw JS object", type: "function" },
  { label: "networkConfig", signature: "networkConfig(config)", snippet: "networkConfig(${config})", description: "Set the network layout from a raw JS object", type: "function" },
  { label: "deploy", signature: "deploy(deployment)", snippet: "deploy(RuntimeDeployment((network, incoming) => ${positions}))", description: "Compute device positions programmatically", type: "function" },
  { label: "configure", signature: "configure(update)", snippet: "configure(builder => ${builder})", description: "Apply a final transformation to the builder", type: "function" },
  { label: "sensorEncoded", signature: "sensorEncoded(name, value)", snippet: 'sensorEncoded("${name}", ${value})', description: "Declare a sensor from an already-encoded JS value", type: "function" },
  { label: "sensorsEncoded", signature: "sensorsEncoded(entries)", snippet: 'sensorsEncoded("${name}" -> ${value})', description: "Declare several encoded sensors at once", type: "function" },
  { label: "initialEncoded", signature: "initialEncoded(nodeId, sensorName, value)", snippet: 'initialEncoded("${1}", "${name}", ${value})', description: "Override a sensor from an already-encoded JS value", type: "function" },
  { label: "world", description: "The builder every world document starts from", type: "variable" },
  { label: "RuntimeDeployment", signature: "RuntimeDeployment((network, incoming) => ...)", snippet: "RuntimeDeployment((network, incoming) => ${positions})", description: "A programmatic device deployment", type: "class" },
  { label: "point", signature: "point(x, y)", snippet: "point(${x}, ${y})", description: "A position literal for a deployment", type: "function" },
];

export const RENDERER_SUGGESTIONS: Suggestion[] = [
  { label: "graph", description: "Network graph snapshot holding nodes and edges", type: "variable" },
  { label: "defaults", description: "Default visualization settings", type: "variable" },
  { label: "selectedNodeIds", description: "Identifiers of the currently selected nodes", type: "variable" },
  { label: "availableSensors", description: "Sensors present in the simulation", type: "variable" },
  { label: "execution", description: "Simulation execution state", type: "variable" },

  { label: "RendererKit.composeNode", snippet: "RendererKit.composeNode(context, ${parts})", description: "Compose several node behaviours", type: "function" },
  { label: "RendererKit.composeEdge", snippet: "RendererKit.composeEdge(context, ${parts})", description: "Compose several edge behaviours", type: "function" },
  { label: "RendererKit.node.matrix", snippet: "RendererKit.node.matrix()", description: "Draw the LED matrix on each node", type: "function" },
  { label: "RendererKit.node.selectedRing", snippet: "RendererKit.node.selectedRing(${options})", description: "Ring around the selected nodes", type: "function" },
  { label: "RendererKit.node.exportText", snippet: "RendererKit.node.exportText(${options})", description: "Label each node with its exported value", type: "function" },
  { label: "RendererKit.node.sensorDot", snippet: 'RendererKit.node.sensorDot("${sensor}")', description: "Dot shown while a sensor is active", type: "function" },
  { label: "RendererKit.node.booleans", snippet: "RendererKit.node.booleans()", description: "Boolean status indicators", type: "function" },
  { label: "RendererKit.node.gradient", snippet: "RendererKit.node.gradient()", description: "Colour nodes by their gradient value", type: "function" },
  { label: "RendererKit.node.exportEffect", snippet: "RendererKit.node.exportEffect()", description: "Ripple effect when a value is exported", type: "function" },
  { label: "RendererKit.node.velocityArrow", snippet: "RendererKit.node.velocityArrow(${options})", description: "Arrow showing the motion vector", type: "function" },
  { label: "RendererKit.node.sizeRange", snippet: 'RendererKit.node.sizeRange(${0}, ${100}, ${5}, ${20}, "${export}")', description: "Map a value range onto node sizes", type: "function" },
  { label: "RendererKit.node.custom", snippet: "RendererKit.node.custom(ctx => {\n  ${}\n})", description: "Fully custom node drawing routine", type: "snippet" },
  { label: "RendererKit.edge.highlightNeighborhood", snippet: "RendererKit.edge.highlightNeighborhood(${0.6})", description: "Thicken edges in the selected neighbourhood", type: "function" },
  { label: "RendererKit.edge.muteNonNeighborhood", snippet: "RendererKit.edge.muteNonNeighborhood(${0.24})", description: "Dim edges outside the selected neighbourhood", type: "function" },
  { label: "RendererKit.edge.custom", snippet: "RendererKit.edge.custom(ctx => {\n  ${}\n})", description: "Fully custom edge drawing routine", type: "snippet" },

  { label: "ctx.beginPath", snippet: "ctx.beginPath()", description: "Start a new path", type: "function" },
  { label: "ctx.arc", snippet: "ctx.arc(${x}, ${y}, ${r}, 0, 2 * Math.PI)", description: "Add a circular arc to the path", type: "function" },
  { label: "ctx.fill", snippet: "ctx.fill()", description: "Fill the current path", type: "function" },
  { label: "ctx.stroke", snippet: "ctx.stroke()", description: "Stroke the current path", type: "function" },
  { label: "ctx.fillStyle", snippet: 'ctx.fillStyle = "${color}"', description: "Set the fill colour", type: "variable" },
  { label: "ctx.strokeStyle", snippet: 'ctx.strokeStyle = "${color}"', description: "Set the stroke colour", type: "variable" },
  { label: "ctx.lineWidth", snippet: "ctx.lineWidth = ${width}", description: "Set the stroke width", type: "variable" },
  { label: "ctx.font", snippet: 'ctx.font = "${12px sans-serif}"', description: "Set the font", type: "variable" },
  { label: "ctx.fillText", snippet: 'ctx.fillText("${text}", ${x}, ${y})', description: "Draw text", type: "function" },
];

const SCALA_KEYWORDS = new Set([
  "abstract", "case", "catch", "class", "def", "do", "else", "extends",
  "false", "final", "finally", "for", "forSome", "if", "implicit", "import",
  "lazy", "match", "new", "null", "object", "override", "package", "private",
  "protected", "return", "sealed", "super", "this", "throw", "trait", "true",
  "try", "type", "val", "var", "while", "with", "yield",
]);

/** Symbols the user has defined in the buffer, so they complete before they compile. */
export function extractLocalSuggestions(code: string, tab: "code" | "world" | "renderer"): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();

  const add = (name: string, type: Suggestion["type"], snippet?: string, description?: string) => {
    if (seen.has(name) || SCALA_KEYWORDS.has(name)) {
      return;
    }
    seen.add(name);
    suggestions.push({ label: name, snippet, description, type, isLocal: true });
  };

  const lines = code.split("\n");

  if (tab === "code" || tab === "world") {
    const defRegex = /\bdef\s+([a-zA-Z0-9$_]+)\s*(\([^)]*\))?/g;
    const bindingRegex = /\b(val|var)\s+([a-zA-Z0-9$_]+)\b/g;
    const typeRegex = /\b(class|object|trait)\s+([a-zA-Z0-9$_]+)\b/g;
    const parenLambdaRegex = /\(\s*([a-zA-Z0-9$_\s,:]+)\s*\)\s*=>/g;
    const singleLambdaRegex = /\b([a-zA-Z0-9$_]+)\s*=>/g;
    const isCaseBranch = (line: string, index: number) => {
      const before = line.slice(0, index).trim();
      return before.endsWith("case") || /\bcase\s+[a-zA-Z0-9$_().\s]*$/.test(before);
    };

    for (const line of lines) {
      for (const match of line.matchAll(defRegex)) {
        const name = match[1];
        if (name === "main") continue;
        const params = match[2] ?? "()";
        add(name, "function", `${name}${params === "()" ? "()" : "(${})"}`, `Local method: def ${name}${params}`);
      }
      for (const match of line.matchAll(bindingRegex)) {
        add(match[2], "variable", undefined, `Local ${match[1] === "val" ? "value" : "variable"}: ${match[1]} ${match[2]}`);
      }
      for (const match of line.matchAll(typeRegex)) {
        add(match[2], "class", undefined, `Local ${match[1]}: ${match[1]} ${match[2]}`);
      }
      for (const match of line.matchAll(parenLambdaRegex)) {
        if (isCaseBranch(line, match.index ?? 0)) continue;
        for (const parameter of match[1].split(",")) {
          const name = parameter.split(":")[0].trim();
          if (name !== "_" && /^[a-zA-Z0-9$_]+$/.test(name)) {
            add(name, "variable", undefined, `Lambda parameter: ${name}`);
          }
        }
      }
      for (const match of line.matchAll(singleLambdaRegex)) {
        if (isCaseBranch(line, match.index ?? 0)) continue;
        if (match[1] !== "_") {
          add(match[1], "variable", undefined, `Lambda parameter: ${match[1]}`);
        }
      }
    }
    return suggestions;
  }

  const jsFunctionRegex = /\bfunction\s+([a-zA-Z0-9$_]+)\s*(\([^)]*\))?/g;
  const jsBindingRegex = /\b(?:const|let|var)\s+([a-zA-Z0-9$_]+)\b/g;
  for (const line of lines) {
    for (const match of line.matchAll(jsFunctionRegex)) {
      const params = match[2] ?? "()";
      add(match[1], "function", `${match[1]}${params === "()" ? "()" : "(${})"}`, `Local function: ${match[1]}${params}`);
    }
    for (const match of line.matchAll(jsBindingRegex)) {
      add(match[1], "variable", undefined, `Local variable: ${match[1]}`);
    }
  }
  return suggestions;
}
