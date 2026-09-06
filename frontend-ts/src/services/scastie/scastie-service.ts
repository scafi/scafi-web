import type {
  CompileAction,
  CompileEdit,
  CompilePayload,
  CompileProblem,
  CompileResult,
  CompileSeverity,
  ScastieProblem,
  ScastieSeverity,
  SseProgressEvent,
} from "../../domain/contracts";
import { wrapStandaloneRuntimeCodeWithMap } from "./runtime-template";
import {
  buildWrappedSource,
  type RuntimeWrapper,
  type ScalaSourceMode,
  type WrappedSource,
} from "./source-map";

export type { ScalaSourceMode };

const SCAFI_ARTIFACTS = ["scafi-core", "scafi-commons", "scafi-simulator"] as const;

export interface ScalaJsTarget {
  Js: { scalaVersion: string; scalaJsVersion: string };
}

export function buildScalaJsTarget(scalaVersion: string, scalaJsVersion: string): ScalaJsTarget {
  return { Js: { scalaVersion, scalaJsVersion } };
}

/**
 * Builds the scafi dependency set. `target` is the target the artifacts are resolved against,
 * which is not necessarily the build target: `/api/run` resolves them against `Scala2`/`Scala3`
 * while the Metals endpoints expect the same `Js` target as the build.
 */
export interface ScalaDependency<Target> {
  groupId: string;
  artifact: string;
  target: Target;
  version: string;
  isAutoResolve: true;
}

export function buildScafiDependencies<Target>(
  target: Target,
  scafiVersion: string,
): Array<ScalaDependency<Target>> {
  return SCAFI_ARTIFACTS.map((artifact) => ({
    groupId: "it.unibo.scafi",
    artifact,
    target,
    version: scafiVersion,
    isAutoResolve: true as const,
  }));
}

/** Thrown when Scastie finished without producing JavaScript. Carries every positioned message. */
export class CompilationFailedError extends Error {
  readonly problems: CompileProblem[];
  readonly warnings: string[];
  readonly errors: string[];

  constructor(message: string, problems: CompileProblem[], warnings: string[], errors: string[]) {
    super(message);
    this.name = "CompilationFailedError";
    this.problems = problems;
    this.warnings = warnings;
    this.errors = errors;
  }
}

function readSeverity(severity: ScastieSeverity): CompileSeverity {
  if (severity && typeof severity === "object") {
    if ("Error" in severity) {
      return "error";
    }
    if ("Info" in severity) {
      return "info";
    }
  }
  return "warning";
}

function readPosition(value: number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * `Problem` positions are 1-based lines and 1-based columns, but the edits inside
 * `Problem.actions` keep BSP's 0-based lines and characters (scastie's
 * `BspClient.diagnosticToProblem` adds one to the former and not to the latter).
 * Both are normalised here to 1-based lines with 0-based columns.
 */
function readActions(problem: ScastieProblem): CompileAction[] {
  return (problem.actions ?? []).flatMap((action) => {
    const edits: CompileEdit[] = (action.edit?.changes ?? []).flatMap((change) => {
      const start = change.range?.start;
      const end = change.range?.end;
      if (!start || !end || typeof start.line !== "number" || typeof end.line !== "number") {
        return [];
      }
      return [{
        startLine: start.line + 1,
        startColumn: start.character ?? 0,
        endLine: end.line + 1,
        endColumn: end.character ?? 0,
        newText: change.newText ?? "",
      }];
    });
    if (!action.title || edits.length === 0) {
      return [];
    }
    return [{ title: action.title, description: action.description ?? undefined, edits }];
  });
}

export function toCompileProblem(problem: ScastieProblem): CompileProblem {
  const startColumn = readPosition(problem.startColumn);
  const endColumn = readPosition(problem.endColumn);
  return {
    severity: readSeverity(problem.severity),
    message: problem.message ?? "Unknown compiler message",
    line: readPosition(problem.line),
    endLine: readPosition(problem.endLine),
    startColumn: startColumn === undefined ? undefined : Math.max(0, startColumn - 1),
    endColumn: endColumn === undefined ? undefined : Math.max(0, endColumn - 1),
    actions: readActions(problem),
  };
}

export interface ScastieServiceOptions {
  baseUrl?: string;
  scafiVersion?: string;
  scalaVersion?: string;
  scalaJsVersion?: string;
  wrapRuntime?: RuntimeWrapper;
  fetchImpl?: typeof fetch;
  eventSourceFactory?: (url: string) => EventSourceLike;
}

export interface EventSourceLike {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
}

const DEFAULTS = {
  baseUrl: "https://scastie.scala-lang.org",
  scafiVersion: "1.8.0",
  scalaVersion: "2.13.18",
  scalaJsVersion: "1.22.0",
};

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return fetchImpl;
  }
  return globalThis.fetch.bind(globalThis);
}

function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export class ScastieService {
  private readonly baseUrl: string;
  private readonly scafiVersion: string;
  private scalaVersion: string;
  private readonly scalaJsVersion: string;
  private readonly wrapRuntime: RuntimeWrapper;
  private readonly fetchImpl: typeof fetch;
  private readonly eventSourceFactory: (url: string) => EventSourceLike;

  constructor(options: ScastieServiceOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULTS.baseUrl;
    this.scafiVersion = options.scafiVersion ?? DEFAULTS.scafiVersion;
    this.scalaVersion = options.scalaVersion ?? DEFAULTS.scalaVersion;
    this.scalaJsVersion = options.scalaJsVersion ?? DEFAULTS.scalaJsVersion;
    this.wrapRuntime = options.wrapRuntime ?? wrapStandaloneRuntimeCodeWithMap;
    this.fetchImpl = resolveFetch(options.fetchImpl);
    this.eventSourceFactory =
      options.eventSourceFactory ??
      ((url) => new EventSource(url) as unknown as EventSourceLike);
  }

  getScalaVersion(): string {
    return this.scalaVersion;
  }

  setScalaVersion(scalaVersion: string): void {
    this.scalaVersion = scalaVersion;
  }

  /**
   * The exact source sent to Scastie, together with the mapping back to editor coordinates
   * so that compiler positions and completion offsets refer to the same text.
   */
  buildSource(code: string, mode: ScalaSourceMode, worldDocument?: string): WrappedSource {
    return buildWrappedSource(code, mode, worldDocument, this.wrapRuntime);
  }

  getScafiDependencies() {
    const isScala3 = this.scalaVersion.startsWith("3.");
    const targetDependency = isScala3
      ? { Scala3: { scalaVersion: this.scalaVersion } }
      : { Scala2: { scalaVersion: this.scalaVersion } };
    return buildScafiDependencies(targetDependency, this.scafiVersion);
  }

  getScafiVersion(): string {
    return this.scafiVersion;
  }

  getScalaJsVersion(): string {
    return this.scalaJsVersion;
  }

  buildPayload(code: string, mode: ScalaSourceMode, worldDocument?: string): CompilePayload {
    return {
      SbtInputs: {
        isWorksheetMode: false,
        code: this.buildSource(code, mode, worldDocument).code,
        target: buildScalaJsTarget(this.scalaVersion, this.scalaJsVersion),
        libraries: this.getScafiDependencies(),
        librariesFromList: [],
        sbtConfigExtra: 'scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked")',
        sbtPluginsConfigExtra: "",
        isShowingInUserProfile: false,
      },
    };
  }

  async compile(code: string, mode: ScalaSourceMode, worldDocument?: string): Promise<CompileResult> {
    const serializedInput = `${mode}:${worldDocument ?? ""}:${code}`;
    const hash = cyrb53(serializedInput);
    const cacheKey = `scafi_compiled_${hash}`;

    try {
      if (typeof globalThis !== "undefined" && globalThis.localStorage) {
        const cached = globalThis.localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          let result: CompileResult | undefined;
          if (parsed && typeof parsed.javascript === "string") {
            result = parsed as CompileResult;
          } else if (parsed && parsed.result && typeof parsed.result.javascript === "string") {
            if (parsed.compressed) {
              if (isCompressionSupported) {
                try {
                  const decompressedJs = await decompressString(parsed.result.javascript);
                  result = { ...parsed.result, javascript: decompressedJs };
                } catch (decErr) {
                  console.warn("[ScastieService] Failed to decompress cached item", decErr);
                }
              } else {
                console.warn("[ScastieService] Compression is not supported in this environment, cannot decompress cached item.");
              }
            } else {
              result = parsed.result as CompileResult;
            }

            if (result && typeof result.javascript === "string") {
              // Update timestamp on cache hit to maintain LRU without recompressing
              try {
                const updatedPayload = { ...parsed, timestamp: Date.now() };
                globalThis.localStorage.setItem(cacheKey, JSON.stringify(updatedPayload));
              } catch { /* ignore */ }
            }
          }

          if (result && typeof result.javascript === "string") {
            console.log(`[ScastieService] Serving cached compilation for ${hash}`);
            return result;
          }
        }
      }
    } catch (e) {
      console.warn("[ScastieService] Failed to read from localStorage cache", e);
    }

    console.log(`[ScastieService] Cache miss for hash ${hash}. Compiling via Scastie...`);

    const payload = this.buildPayload(code, mode, worldDocument);
    const snippetId = await this.postRun(payload);
    const result = await this.waitForJs(snippetId);

    try {
      if (typeof globalThis !== "undefined" && globalThis.localStorage && result && !result.runtimeError && result.errors.length === 0) {
        await saveToLocalStorageWithEviction(cacheKey, result);
        console.log(`[ScastieService] Cached successful compilation for ${hash}`);
      }
    } catch (e) {
      console.warn("[ScastieService] Failed to write to localStorage cache", e);
    }

    return result;
  }

  async postRun(payload: CompilePayload): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Scastie run request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { base64UUID?: string };
    if (!body.base64UUID) {
      throw new Error("Scastie response does not contain base64UUID");
    }

    return body.base64UUID;
  }

  waitForJs(snippetId: string): Promise<CompileResult> {
    return new Promise<CompileResult>((resolve, reject) => {
      const warnings: string[] = [];
      const errors: string[] = [];
      const problems: CompileProblem[] = [];
      let runtimeError: string | undefined;
      const eventSource = this.eventSourceFactory(`${this.baseUrl}/api/progress-sse/${snippetId}`);

      const close = () => {
        eventSource.close();
      };

      const failureMessage = (fallback: string): string =>
        errors.at(-1) ?? runtimeError ?? warnings.at(-1) ?? fallback;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data) as SseProgressEvent;
        for (const info of data.compilationInfos ?? []) {
          const problem = toCompileProblem(info);
          problems.push(problem);
          if (problem.severity === "error") {
            errors.push(problem.message);
          } else {
            warnings.push(problem.message);
          }
        }

        if (data.runtimeError?.message) {
          runtimeError = data.runtimeError.message;
        }

        if (data.isDone) {
          close();
          const javascript = data.scalaJsContent;
          if (javascript && javascript.length > 0) {
            resolve({ javascript, warnings, errors, problems, runtimeError });
            return;
          }
          const allMessages = [...errors, ...warnings].filter(Boolean);
          if (allMessages.length > 0) {
            console.error("[Scastie] Compilation failed with details:", allMessages);
          }
          reject(
            new CompilationFailedError(
              `Compilation failed: ${failureMessage("Unknown error")}`,
              problems,
              warnings,
              errors,
            ),
          );
        }
      };

      eventSource.onerror = () => {
        close();
        reject(new Error("SSE connection error"));
      };
    });
  }
}

async function saveToLocalStorageWithEviction(key: string, result: CompileResult): Promise<void> {
  if (typeof globalThis === "undefined" || !globalThis.localStorage) return;
  const storage = globalThis.localStorage;

  let finalResult = result;
  let compressed = false;

  if (isCompressionSupported) {
    try {
      const compressedJs = await compressString(result.javascript);
      finalResult = { ...result, javascript: compressedJs };
      compressed = true;
    } catch (compErr) {
      console.warn("[ScastieService] Failed to compress compilation result, saving uncompressed", compErr);
    }
  }

  const cacheWrapper = {
    result: finalResult,
    compressed,
    timestamp: Date.now()
  };
  const serialized = JSON.stringify(cacheWrapper);

  try {
    storage.setItem(key, serialized);
    return;
  } catch (e: any) {
    const isQuotaError = e.name === "QuotaExceededError" || 
                         e.name === "NS_ERROR_DOM_QUOTA_REACHED" || 
                         e.code === 22 || 
                         e.code === 1014;
    if (!isQuotaError) {
      throw e;
    }
  }

  console.warn("[ScastieService] LocalStorage quota exceeded. Evicting old compiled scripts...");
  
  const scafiKeys: { key: string; timestamp: number }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith("scafi_compiled_")) {
      let timestamp = 0;
      try {
        const val = storage.getItem(k);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed.timestamp === "number") {
            timestamp = parsed.timestamp;
          }
        }
      } catch {
        // ignore parsing errors
      }
      scafiKeys.push({ key: k, timestamp });
    }
  }

  scafiKeys.sort((a, b) => a.timestamp - b.timestamp);

  for (const entry of scafiKeys) {
    if (entry.key === key) continue;
    storage.removeItem(entry.key);
    console.log(`[ScastieService] Evicted cached compilation: ${entry.key}`);
    try {
      storage.setItem(key, serialized);
      console.log("[ScastieService] Successfully cached compilation after eviction");
      return;
    } catch (e: any) {
      const isQuotaError = e.name === "QuotaExceededError" || 
                           e.name === "NS_ERROR_DOM_QUOTA_REACHED" || 
                           e.code === 22 || 
                           e.code === 1014;
      if (!isQuotaError) {
        throw e;
      }
    }
  }

  throw new Error("Failed to write to localStorage cache even after evicting all other ScaFi cache items.");
}

const isCompressionSupported = typeof globalThis !== "undefined" && 
                               "CompressionStream" in globalThis && 
                               "DecompressionStream" in globalThis &&
                               typeof Blob !== "undefined" &&
                               typeof Response !== "undefined";

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  }
}

async function base64ToBlob(base64: string): Promise<Blob> {
  try {
    const response = await fetch(`data:application/octet-stream;base64,${base64}`);
    return await response.blob();
  } catch {
    const binaryString = typeof atob !== "undefined" 
      ? atob(base64) 
      : Buffer.from(base64, "base64").toString("binary");
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: "application/octet-stream" });
  }
}

async function compressString(str: string): Promise<string> {
  const stream = new Blob([str]).stream();
  const compressedStream = stream.pipeThrough(new (globalThis as any).CompressionStream("gzip"));
  const response = new Response(compressedStream);
  return blobToBase64(await response.blob());
}

async function decompressString(base64: string): Promise<string> {
  const blob = await base64ToBlob(base64);
  const decompressedStream = blob.stream().pipeThrough(new (globalThis as any).DecompressionStream("gzip"));
  const response = new Response(decompressedStream);
  return (await response.blob()).text();
}