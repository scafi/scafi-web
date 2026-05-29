import { describe, expect, it } from "vitest";
import { ScastieService, type EventSourceLike } from "./scastie-service";

class FakeEventSource implements EventSourceLike {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  close(): void {}

  emitMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

describe("ScastieService", () => {
  it("builds the Scala.js payload from easy Scala mode", () => {
    const service = new ScastieService({ wrapCode: (code, world) => `wrapped(${world})(${code})` });
    const payload = service.buildPayload("// using Foo, Bar\nmid()", "easy-scala", "world.dsl");
    expect(payload.SbtInputs.code).toContain("wrapped(world.dsl)");
    expect(payload.SbtInputs.code).toContain("class MyProgram extends AggregateProgram with Foo with Bar");
    expect(payload.SbtInputs.target.Js.scalaJsVersion).toBe("1.21.0");
  });

  it("parses a successful SSE completion", async () => {
    const fakeEventSource = new FakeEventSource();
    const service = new ScastieService({
      eventSourceFactory: () => fakeEventSource,
    });

    const promise = service.waitForJs("snippet");
    fakeEventSource.emitMessage({
      isDone: true,
      compilationInfos: [{ message: "warn", severity: {} }],
      scalaJsContent: "console.log('ok');",
    });

    await expect(promise).resolves.toEqual({
      javascript: "console.log('ok');",
      warnings: ["warn"],
      errors: [],
      runtimeError: undefined,
    });
  });

  it("uses localStorage to cache and retrieve compilation results", async () => {
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { for (const k in store) delete store[k]; },
    };
    
    const originalLocalStorage = (globalThis as any).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    try {
      const fakeEventSource = new FakeEventSource();
      let postRunCalled = 0;
      const service = new ScastieService({
        eventSourceFactory: () => fakeEventSource,
      });
      service.postRun = async () => {
        postRunCalled++;
        setTimeout(() => {
          fakeEventSource.emitMessage({
            isDone: true,
            scalaJsContent: "console.log('cached-js');",
          });
        }, 0);
        return "snippet-123";
      };

      const compilePromise = service.compile("val x = 1", "full-scala");
      const result1 = await compilePromise;

      expect(result1.javascript).toBe("console.log('cached-js');");
      expect(postRunCalled).toBe(1);

      const result2 = await service.compile("val x = 1", "full-scala");
      expect(result2.javascript).toBe("console.log('cached-js');");
      expect(postRunCalled).toBe(1);
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(globalThis, "localStorage", {
          value: originalLocalStorage,
          writable: true,
          configurable: true,
        });
      } else {
        delete (globalThis as any).localStorage;
      }
    }
  });
});