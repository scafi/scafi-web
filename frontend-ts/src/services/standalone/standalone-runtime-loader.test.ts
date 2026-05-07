import { describe, expect, it, vi } from "vitest";
import { StandaloneRuntimeLoader } from "./standalone-runtime-loader";

describe("StandaloneRuntimeLoader", () => {
  it("loads a valid runtime from JavaScript source", async () => {
    const loader = new StandaloneRuntimeLoader();
    const runtime = await loader.loadFromJavascript(`
      const scafiStandalone = {
        loadAndInit() {},
        tick() {},
        setPosition() {},
        setSensorValue() {},
        getState() { return { nodes: [], edges: [] }; },
        dispose() {},
      };
    `);

    expect(runtime.getState()).toEqual({ nodes: [], edges: [] });
  });

  it("rejects runtimes with missing methods", async () => {
    const loader = new StandaloneRuntimeLoader();
    await expect(loader.loadFromJavascript("const scafiStandalone = { tick() {} }; ")).rejects.toThrow(
      /missing method loadAndInit/i,
    );
  });

  it("disposes worker-backed runtimes without rejecting the dispose request", async () => {
    class FakeWorker {
      private readonly listeners = new Map<string, Set<(event: MessageEvent<{ id: number; ok: boolean; value?: unknown }>) => void>>();

      constructor(_url: URL, _options: WorkerOptions) {}

      addEventListener(type: string, listener: (event: MessageEvent<{ id: number; ok: boolean; value?: unknown }>) => void): void {
        const existing = this.listeners.get(type) ?? new Set();
        existing.add(listener);
        this.listeners.set(type, existing);
      }

      postMessage(message: { id: number; type: string }): void {
        queueMicrotask(() => {
          if (message.type === "getState") {
            this.emit("message", { data: { id: message.id, ok: true, value: { nodes: [], edges: [] } } } as MessageEvent<{ id: number; ok: boolean; value?: unknown }>);
            return;
          }
          this.emit("message", { data: { id: message.id, ok: true } } as MessageEvent<{ id: number; ok: boolean; value?: unknown }>);
        });
      }

      terminate(): void {}

      private emit(type: string, event: MessageEvent<{ id: number; ok: boolean; value?: unknown }>): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    const originalWorker = globalThis.Worker;
    vi.stubGlobal("Worker", FakeWorker as unknown as typeof Worker);
    try {
      const loader = new StandaloneRuntimeLoader();
      const runtime = await loader.loadFromJavascript(`
        const scafiStandalone = {
          loadAndInit() {},
          tick() {},
          setPosition() {},
          setSensorValue() {},
          getState() { return { nodes: [], edges: [] }; },
          dispose() {},
        };
      `);

      await expect(runtime.dispose()).resolves.toBeUndefined();
      await expect(runtime.dispose()).resolves.toBeUndefined();
    } finally {
      if (originalWorker) {
        vi.stubGlobal("Worker", originalWorker);
      } else {
        vi.unstubAllGlobals();
      }
    }
  });
});