import type { CompilePayload, CompileResult, SseProgressEvent } from "../../domain/contracts";
import { convertEasyScalaToFull } from "./easy-scala";

export type ScalaSourceMode = "easy-scala" | "full-scala";

export interface ScastieServiceOptions {
  baseUrl?: string;
  scafiVersion?: string;
  scalaVersion?: string;
  scalaJsVersion?: string;
  wrapCode?: (code: string, worldDocument?: string) => string;
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
  scafiVersion: "1.1.0",
  scalaVersion: "2.13.18",
  scalaJsVersion: "1.21.0",
};

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return fetchImpl;
  }
  return globalThis.fetch.bind(globalThis);
}

export class ScastieService {
  private readonly baseUrl: string;
  private readonly scafiVersion: string;
  private readonly scalaVersion: string;
  private readonly scalaJsVersion: string;
  private readonly wrapCode: (code: string, worldDocument?: string) => string;
  private readonly fetchImpl: typeof fetch;
  private readonly eventSourceFactory: (url: string) => EventSourceLike;

  constructor(options: ScastieServiceOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULTS.baseUrl;
    this.scafiVersion = options.scafiVersion ?? DEFAULTS.scafiVersion;
    this.scalaVersion = options.scalaVersion ?? DEFAULTS.scalaVersion;
    this.scalaJsVersion = options.scalaJsVersion ?? DEFAULTS.scalaJsVersion;
    this.wrapCode = options.wrapCode ?? ((code) => code);
    this.fetchImpl = resolveFetch(options.fetchImpl);
    this.eventSourceFactory =
      options.eventSourceFactory ??
      ((url) => new EventSource(url) as unknown as EventSourceLike);
  }

  normalizeSource(code: string, mode: ScalaSourceMode): string {
    return mode === "easy-scala" ? convertEasyScalaToFull(code) : code;
  }

  buildPayload(code: string, mode: ScalaSourceMode, worldDocument?: string): CompilePayload {
    const normalized = this.normalizeSource(code, mode);
    const wrapped = this.wrapCode(normalized, worldDocument);
    const scala2Target = { scalaVersion: this.scalaVersion };

    const dependency = (artifact: string) => ({
      groupId: "it.unibo.scafi",
      artifact,
      target: { Scala2: scala2Target },
      version: this.scafiVersion,
      isAutoResolve: true as const,
    });

    return {
      SbtInputs: {
        isWorksheetMode: false,
        code: wrapped,
        target: {
          Js: {
            scalaVersion: this.scalaVersion,
            scalaJsVersion: this.scalaJsVersion,
          },
        },
        libraries: [dependency("scafi-core"), dependency("scafi-commons"), dependency("scafi-simulator")],
        librariesFromList: [],
        sbtConfigExtra: 'scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked")',
        sbtPluginsConfigExtra: "",
        isShowingInUserProfile: false,
      },
    };
  }

  async compile(code: string, mode: ScalaSourceMode, worldDocument?: string): Promise<CompileResult> {
    const payload = this.buildPayload(code, mode, worldDocument);
    const snippetId = await this.postRun(payload);
    return this.waitForJs(snippetId);
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
          const message = info.message ?? "Unknown compiler message";
          const severity = info.severity;
          if (severity && typeof severity === "object" && "Error" in severity) {
            errors.push(message);
          } else {
            warnings.push(message);
          }
        }

        if (data.runtimeError?.message) {
          runtimeError = data.runtimeError.message;
        }

        if (data.isDone) {
          close();
          const javascript = data.scalaJsContent;
          if (javascript && javascript.length > 0) {
            resolve({ javascript, warnings, errors, runtimeError });
            return;
          }
          const allMessages = [...errors, ...warnings].filter(Boolean);
          if (allMessages.length > 0) {
            console.error("[Scastie] Compilation failed with details:", allMessages);
          }
          reject(new Error(`Compilation failed: ${failureMessage("Unknown error")}`));
        }
      };

      eventSource.onerror = () => {
        close();
        reject(new Error("SSE connection error"));
      };
    });
  }
}