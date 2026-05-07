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
});