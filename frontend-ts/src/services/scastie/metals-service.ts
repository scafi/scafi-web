import { buildScalaJsTarget, buildScafiDependencies, type ScalaDependency, type ScalaJsTarget } from "./scastie-service";

/**
 * Client for Scastie's Metals presentation-compiler endpoints
 * (`org.scastie.metals.ScastieMetalsRoutes`). They are served from the same origin as the
 * compile API with `Access-Control-Allow-Origin: *`, so the browser can call them directly.
 *
 * `/metals/diagnostics` is deliberately not used: the public instance answers it with an
 * empty list even for outright type errors, so live diagnostics come from compilation instead.
 */

const DEFAULT_BASE_URL = "https://scastie.scala-lang.org";

/** Mirrors `EditRange`: 1-based lines, 0-based characters. */
export interface MetalsEditRange {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export interface MetalsInsertInstructions {
  text: string;
  editRange: MetalsEditRange;
}

/** Mirrors `org.scastie.api.CompletionItemDTO`. */
export interface MetalsCompletionItem {
  label: string;
  detail: string;
  tpe: string;
  order?: number | null;
  instructions: MetalsInsertInstructions;
  additionalInsertInstructions: MetalsInsertInstructions[];
  symbol?: string | null;
}

export interface MetalsCompletionList {
  items: MetalsCompletionItem[];
  isIncomplete: boolean;
}

/** `content` is markdown: expression type, symbol signature and the scaladoc. */
export interface MetalsHover {
  from?: number;
  to?: number;
  content?: string;
}

interface MetalsOptions {
  dependencies: Array<ScalaDependency<ScalaJsTarget>>;
  scalaTarget: ScalaJsTarget;
}

interface LspRequest {
  options: MetalsOptions;
  offsetParams: { content: string; offset: number; isWorksheetMode: false };
  clientUuid?: string;
}

/** Responses are circe `Either` encodings: `{"Right": …}` or `{"Left": {"NoResult": {…}}}`. */
type MetalsResponse<T> = { Right?: T; Left?: unknown };

export interface MetalsServiceOptions {
  baseUrl?: string;
  scalaVersion: string;
  scalaJsVersion: string;
  scafiVersion: string;
  fetchImpl?: typeof fetch;
  clientUuid?: string;
}

export class MetalsService {
  private readonly baseUrl: string;
  private readonly scalaJsVersion: string;
  private readonly scafiVersion: string;
  private readonly fetchImpl: typeof fetch;
  private readonly clientUuid: string;
  private scalaVersion: string;
  private supported?: Promise<boolean>;

  constructor(options: MetalsServiceOptions) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.scalaVersion = options.scalaVersion;
    this.scalaJsVersion = options.scalaJsVersion;
    this.scafiVersion = options.scafiVersion;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.clientUuid = options.clientUuid ?? `scafi-web-${Math.random().toString(36).slice(2, 10)}`;
  }

  setScalaVersion(scalaVersion: string): void {
    if (scalaVersion === this.scalaVersion) {
      return;
    }
    this.scalaVersion = scalaVersion;
    // The supported-configuration answer is per target, so it has to be asked again.
    this.supported = undefined;
  }

  private buildOptions(): MetalsOptions {
    // Unlike `/api/run`, the Metals endpoints expect the artifacts to carry the build target.
    const scalaTarget = buildScalaJsTarget(this.scalaVersion, this.scalaJsVersion);
    return { dependencies: buildScafiDependencies(scalaTarget, this.scafiVersion), scalaTarget };
  }

  private async post<T>(endpoint: string, body: unknown, signal?: AbortSignal): Promise<T | undefined> {
    const response = await this.fetchImpl(`${this.baseUrl}/metals/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = (await response.json()) as MetalsResponse<T>;
    // A `Left` is a normal "no result here" answer, not a transport failure.
    return "Right" in parsed ? parsed.Right : undefined;
  }

  /**
   * Whether Metals can serve this scala/scafi configuration at all. Memoised because it is
   * the gate in front of every other call and the answer only changes with the Scala version.
   */
  isConfigurationSupported(): Promise<boolean> {
    this.supported ??= this.post<boolean>("isConfigurationSupported", this.buildOptions())
      .then((value) => value === true)
      .catch(() => false);
    return this.supported;
  }

  private request(code: string, offset: number): LspRequest {
    return {
      options: this.buildOptions(),
      offsetParams: { content: code, offset, isWorksheetMode: false },
      clientUuid: this.clientUuid,
    };
  }

  async complete(code: string, offset: number, signal?: AbortSignal): Promise<MetalsCompletionList | undefined> {
    if (!(await this.isConfigurationSupported())) {
      return undefined;
    }
    return this.post<MetalsCompletionList>("complete", this.request(code, offset), signal);
  }

  async hover(code: string, offset: number, signal?: AbortSignal): Promise<MetalsHover | undefined> {
    if (!(await this.isConfigurationSupported())) {
      return undefined;
    }
    return this.post<MetalsHover>("hover", this.request(code, offset), signal);
  }
}
