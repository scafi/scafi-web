import type { StandaloneRuntimeApi } from "../../domain/contracts";

const REQUIRED_METHODS: Array<keyof StandaloneRuntimeApi> = [
  "loadAndInit",
  "tick",
  "setPosition",
  "setSensorValue",
  "getState",
  "dispose",
];

export class StandaloneRuntimeLoader {
  async loadFromJavascript(javascript: string): Promise<StandaloneRuntimeApi> {
    if (typeof Worker !== "undefined") {
      try {
        return await this.loadWorkerRuntime(javascript);
      } catch {
        return this.loadInlineRuntime(javascript);
      }
    }
    return this.loadInlineRuntime(javascript);
  }

  assertRuntimeApi(runtime: unknown): asserts runtime is StandaloneRuntimeApi {
    if (!runtime || typeof runtime !== "object") {
      throw new Error("scafiStandalone not defined");
    }

    for (const method of REQUIRED_METHODS) {
      if (typeof (runtime as Record<string, unknown>)[method] !== "function") {
        throw new Error(`scafiStandalone is missing method ${method}`);
      }
    }
  }

  private loadInlineRuntime(javascript: string): StandaloneRuntimeApi {
    const runtime = new Function(
      `${javascript}\nreturn typeof scafiStandalone !== "undefined" ? scafiStandalone : undefined;`,
    )() as unknown;

    this.assertRuntimeApi(runtime);
    return runtime;
  }

  private async loadWorkerRuntime(javascript: string): Promise<StandaloneRuntimeApi> {
    const worker = new Worker(new URL("./standalone-runtime.worker.ts", import.meta.url), { type: "module" });
    const runtime = new WorkerBackedStandaloneRuntime(worker);
    try {
      await runtime.bootstrap(javascript);
      return runtime;
    } catch (error) {
      await runtime.dispose().catch(() => {});
      throw error;
    }
  }
}

type WorkerCommand =
  | { type: "load-source"; javascript: string }
  | { type: "loadAndInit"; configJson: string }
  | { type: "tick" }
  | { type: "setPosition"; nodeId: string; x: number; y: number }
  | { type: "setSensorValue"; sensorName: string; nodeIds: string[]; value: unknown }
  | { type: "getState"; options?: { excludeEdges?: boolean; compact?: boolean } }
  | { type: "dispose" };

type WorkerRequest = WorkerCommand & { id: number };

type WorkerResponse =
  | { id: number; ok: true; value?: unknown }
  | { id: number; ok: false; error: string };

class WorkerBackedStandaloneRuntime implements StandaloneRuntimeApi {
  private requestId = 0;
  private disposed = false;
  private disposing = false;
  private disposePromise?: Promise<void>;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();

  constructor(private readonly worker: Worker) {
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) {
        return;
      }
      this.pending.delete(response.id);
      if (response.ok) {
        pending.resolve(response.value);
        return;
      }
      pending.reject(new Error(response.error));
    });
    worker.addEventListener("error", (event) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || "Worker runtime failed");
      this.rejectAll(error);
    });
  }

  async bootstrap(javascript: string): Promise<void> {
    await this.request({ type: "load-source", javascript });
  }

  async loadAndInit(configJson: string): Promise<void> {
    await this.request({ type: "loadAndInit", configJson });
  }

  async tick(): Promise<void> {
    await this.request({ type: "tick" });
  }

  async setPosition(nodeId: string, x: number, y: number): Promise<void> {
    await this.request({ type: "setPosition", nodeId, x, y });
  }

  async setSensorValue(sensorName: string, nodeIds: string[], value: unknown): Promise<void> {
    await this.request({ type: "setSensorValue", sensorName, nodeIds, value });
  }

  async getState(options?: { excludeEdges?: boolean; compact?: boolean }) {
    return (await this.request({ type: "getState", options })) as Awaited<ReturnType<StandaloneRuntimeApi["getState"]>>;
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    if (this.disposing) {
      return this.disposePromise;
    }
    this.disposing = true;
    this.disposePromise = (async () => {
      try {
        await this.request({ type: "dispose" }, true);
      } finally {
        this.disposed = true;
        this.disposing = false;
        this.rejectAll(new Error("Worker runtime disposed"));
        this.worker.terminate();
      }
    })();
    return this.disposePromise;
  }

  private request(message: WorkerCommand, allowWhileDisposing = false): Promise<unknown> {
    if (this.disposed || (this.disposing && !allowWhileDisposing)) {
      return Promise.reject(new Error("Worker runtime disposed"));
    }
    const id = this.requestId++;
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, ...message } as WorkerRequest);
    });
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}