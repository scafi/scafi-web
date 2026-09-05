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
    expect(payload.SbtInputs.target.Js.scalaJsVersion).toBe("1.22.0");
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

  it("evicts oldest items from localStorage when quota is exceeded", async () => {
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      length: 0,
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        if (Object.keys(store).length >= 2 && !store[key]) {
          const err = new Error("Quota exceeded");
          err.name = "QuotaExceededError";
          throw err;
        }
        store[key] = value;
        mockLocalStorage.length = Object.keys(store).length;
      },
      removeItem: (key: string) => {
        delete store[key];
        mockLocalStorage.length = Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] || null,
      clear: () => {
        for (const k in store) delete store[k];
        mockLocalStorage.length = 0;
      },
    };

    const originalLocalStorage = (globalThis as any).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    try {
      const fakeEventSource = new FakeEventSource();
      const service = new ScastieService({
        eventSourceFactory: () => fakeEventSource,
      });

      mockLocalStorage.setItem("scafi_compiled_old", JSON.stringify({
        result: { javascript: "console.log('old');", warnings: [], errors: [] },
        timestamp: 1000,
      }));
      mockLocalStorage.setItem("scafi_compiled_newer", JSON.stringify({
        result: { javascript: "console.log('newer');", warnings: [], errors: [] },
        timestamp: 2000,
      }));

      service.postRun = async () => {
        setTimeout(() => {
          fakeEventSource.emitMessage({
            isDone: true,
            scalaJsContent: "console.log('brand-new');",
          });
        }, 0);
        return "snippet-brand-new";
      };

      const result = await service.compile("val x = 3", "full-scala");
      expect(result.javascript).toBe("console.log('brand-new');");

      expect(store["scafi_compiled_old"]).toBeUndefined();
      expect(store["scafi_compiled_newer"]).toBeDefined();
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

  it("handles backward compatibility for uncompressed cached items", async () => {
    const mockLocalStorage = {
      getItem: () => JSON.stringify({
        result: { javascript: "console.log('old-uncompressed');", warnings: [], errors: [] },
        timestamp: Date.now()
      }),
      setItem: () => {},
    };
    
    const originalLocalStorage = (globalThis as any).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    try {
      const service = new ScastieService();
      const result = await service.compile("val x = 4", "full-scala");
      expect(result.javascript).toBe("console.log('old-uncompressed');");
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

  it("compresses cache payloads if CompressionStream is supported", async () => {
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
    };
    
    const originalLocalStorage = (globalThis as any).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    try {
      const fakeEventSource = new FakeEventSource();
      const service = new ScastieService({
        eventSourceFactory: () => fakeEventSource,
      });

      service.postRun = async () => {
        setTimeout(() => {
          fakeEventSource.emitMessage({
            isDone: true,
            scalaJsContent: "console.log('to-be-compressed');",
          });
        }, 0);
        return "snippet-compress";
      };

      const result = await service.compile("val x = 99", "full-scala");
      expect(result.javascript).toBe("console.log('to-be-compressed');");

      const cacheKeys = Object.keys(store);
      expect(cacheKeys.length).toBe(1);
      const cachedVal = JSON.parse(store[cacheKeys[0]]);
      
      const isCompressionAvailable = typeof globalThis !== "undefined" && 
                                     "CompressionStream" in globalThis && 
                                     "DecompressionStream" in globalThis &&
                                     typeof Blob !== "undefined" &&
                                     typeof Response !== "undefined";
                                     
      if (isCompressionAvailable) {
        expect(cachedVal.compressed).toBe(true);
        expect(cachedVal.result.javascript).not.toBe("console.log('to-be-compressed');");
        
        // Verify decompression path
        const retrieveResult = await service.compile("val x = 99", "full-scala");
        expect(retrieveResult.javascript).toBe("console.log('to-be-compressed');");
      } else {
        expect(cachedVal.compressed).toBe(false);
        expect(cachedVal.result.javascript).toBe("console.log('to-be-compressed');");
      }
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