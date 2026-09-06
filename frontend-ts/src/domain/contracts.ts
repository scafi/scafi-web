export type NodeId = string;

export type MaybePromise<T> = T | Promise<T>;

export interface Vec2 {
  x: number;
  y: number;
}

export interface MatrixValue {
  dimension: number;
  pixels: Record<string, string>;
}

export type EncodedSensorValue =
  | { kind: "boolean"; value: boolean }
  | { kind: "double"; value: number }
  | { kind: "string"; value: string }
  | { kind: "matrix"; dimension: number; pixels: Array<[[number, number], string]> };

export interface GraphNode {
  id: NodeId;
  position: Vec2;
  labels: Record<string, unknown>;
}

export interface GraphEdge {
  from: NodeId;
  to: NodeId;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface StandaloneNodeState {
  id: string;
  x: number;
  y: number;
  labels?: Record<string, unknown>;
}

export interface StandardStandaloneState {
  compact?: false;
  nodes: StandaloneNodeState[];
  edges: Array<[string, string]> | Array<{ from: string; to: string }>;
}

export interface CompactStandaloneState {
  compact: true;
  nodes: Array<[string, number, number, Record<string, unknown>]>;
  edges: string[];
}

export type StandaloneState = StandardStandaloneState | CompactStandaloneState;

export interface StandaloneRuntimeApi {
  loadAndInit(): MaybePromise<void>;
  tick(): MaybePromise<void>;
  setPosition(nodeId: string, x: number, y: number): MaybePromise<void>;
  setSensorValue(sensorName: string, nodeIds: string[], value: unknown): MaybePromise<void>;
  getState(options?: { excludeEdges?: boolean; compact?: boolean }): MaybePromise<StandaloneState>;
  dispose(): MaybePromise<void>;
}

export interface GridNetworkConfiguration {
  kind: "grid";
  rows: number;
  cols: number;
  stepX: number;
  stepY: number;
  tolerance: number;
}

export interface RandomNetworkConfiguration {
  kind: "random";
  min: number;
  max: number;
  howMany: number;
}

export type NetworkConfiguration = GridNetworkConfiguration | RandomNetworkConfiguration;

export interface SpatialRadiusConfiguration {
  range: number;
}

export interface SimulationSeeds {
  configSeed: number;
  simulationSeed: number;
  randomSensorSeed: number;
}

export interface DeviceShapeConfiguration {
  sensors: Record<string, unknown>;
  initialValues: Record<string, Record<string, unknown>>;
}

export interface SupportConfiguration {
  network: NetworkConfiguration;
  neighbour: SpatialRadiusConfiguration;
  deviceShape: DeviceShapeConfiguration;
  seed: SimulationSeeds;
}

export interface RuntimeConfig {
  network: Record<string, unknown>;
  neighbour: Record<string, unknown>;
  sensors: Record<string, EncodedSensorValue>;
  initialValues: Record<string, Record<string, EncodedSensorValue>>;
  seeds: SimulationSeeds;
  positions?: Record<string, Vec2>;
}

export interface CompilePayload {
  SbtInputs: {
    isWorksheetMode: boolean;
    code: string;
    target: {
      Js: {
        scalaVersion: string;
        scalaJsVersion: string;
      };
    };
    libraries: Array<{
      groupId: string;
      artifact: string;
      target: { Scala2: { scalaVersion: string } } | { Scala3: { scalaVersion: string } };
      version: string;
      isAutoResolve: true;
    }>;
    librariesFromList: [];
    sbtConfigExtra: string;
    sbtPluginsConfigExtra: string;
    isShowingInUserProfile: boolean;
  };
}

export type CompileSeverity = "error" | "warning" | "info";

/** A text edit proposed by the Scala compiler, in wrapped-source coordinates. */
export interface CompileEdit {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  newText: string;
}

/** A compiler quick fix: a title plus the edits that apply it. */
export interface CompileAction {
  title: string;
  description?: string;
  edits: CompileEdit[];
}

/**
 * One compiler message with the position information Scastie already sends.
 * Positions are 1-based lines / 0-based columns into the wrapped source and are
 * absent when the compiler could not attribute the message to a location.
 */
export interface CompileProblem {
  severity: CompileSeverity;
  message: string;
  line?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
  actions: CompileAction[];
}

export interface CompileDiagnostics {
  warnings: string[];
  errors: string[];
  problems: CompileProblem[];
  runtimeError?: string;
}

export interface CompileResult extends CompileDiagnostics {
  javascript: string;
}

/** Mirrors `org.scastie.api.Severity`, which is encoded as a single-key object. */
export type ScastieSeverity = { Error?: unknown; Warning?: unknown; Info?: unknown } | unknown;

/** Mirrors `org.scastie.api.Problem`. Optional fields arrive as `null` when empty. */
export interface ScastieProblem {
  message?: string;
  severity?: ScastieSeverity;
  line?: number | null;
  endLine?: number | null;
  startColumn?: number | null;
  endColumn?: number | null;
  actions?: Array<{
    title?: string;
    description?: string | null;
    edit?: {
      changes?: Array<{
        range?: {
          start?: { line?: number; character?: number };
          end?: { line?: number; character?: number };
        };
        newText?: string;
      }>;
    } | null;
  }> | null;
}

export interface SseProgressEvent {
  isDone?: boolean;
  compilationInfos?: ScastieProblem[];
  runtimeError?: { message?: string } | null;
  scalaJsContent?: string | null;
}

export interface ExampleDefinition {
  name: string;
  body: string;
  world?: string;
  renderer?: string;
  mode?: "easy-scala" | "full-scala";
}

export interface UserSession {
  name: string;
  body: string;
  mode: "easy-scala" | "full-scala";
  world?: string;
  renderer?: string;
}


export interface ExampleGroup {
  groupName: string;
  examples: ExampleDefinition[];
}

export interface EditorDocument {
  code: string;
  mode: "easy-scala" | "full-scala";
}