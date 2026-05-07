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

export interface StandaloneState {
  nodes: StandaloneNodeState[];
  edges: Array<[string, string]> | Array<{ from: string; to: string }>;
}

export interface StandaloneRuntimeApi {
  loadAndInit(configJson: string): MaybePromise<void>;
  tick(): MaybePromise<void>;
  setPosition(nodeId: string, x: number, y: number): MaybePromise<void>;
  setSensorValue(sensorName: string, nodeIds: string[], value: unknown): MaybePromise<void>;
  getState(): MaybePromise<StandaloneState>;
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
      target: { Scala2: { scalaVersion: string } };
      version: string;
      isAutoResolve: true;
    }>;
    librariesFromList: [];
    sbtConfigExtra: string;
    sbtPluginsConfigExtra: string;
    isShowingInUserProfile: boolean;
  };
}

export interface CompileDiagnostics {
  warnings: string[];
  errors: string[];
  runtimeError?: string;
}

export interface CompileResult extends CompileDiagnostics {
  javascript: string;
}

export interface SseProgressEvent {
  isDone?: boolean;
  compilationInfos?: Array<{
    message?: string;
    severity?: { Error?: unknown } | unknown;
  }>;
  runtimeError?: { message?: string } | null;
  scalaJsContent?: string | null;
}

export interface ExampleDefinition {
  name: string;
  body: string;
  devices: DeviceShapeConfiguration;
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