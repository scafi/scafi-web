import { describe, expect, it, vi } from "vitest";
import { ScafiWebApp } from "./scafi-web-app";
import type { ExampleGroup, SupportConfiguration } from "../domain/contracts";

describe("ScafiWebApp", () => {
  it("coordinates repository, examples and store through a UI-friendly facade", async () => {
    const store = {
      subscribe: vi.fn(() => () => {}),
      evolve: vi.fn(),
      previewCompiledSource: vi.fn(() => "compiled-source"),
      loadScript: vi.fn(async () => {}),
      moveNodes: vi.fn(),
      changeSensor: vi.fn(),
      toggleSensor: vi.fn(),
      tick: vi.fn(),
      startDaemon: vi.fn(),
      stopDaemon: vi.fn(),
      dispose: vi.fn(),
    };
    const configRepository = {
      loadConfiguration: vi.fn(() => undefined),
      saveConfiguration: vi.fn(),
      loadEditorDocument: vi.fn(() => undefined),
      saveEditorDocument: vi.fn(),
      loadWorldDocument: vi.fn(() => undefined),
      saveWorldDocument: vi.fn(),
      loadRendererDocument: vi.fn(() => undefined),
      saveRendererDocument: vi.fn(),
      loadUserSessions: vi.fn(() => []),
      saveUserSessions: vi.fn(),
    };
    const examples: ExampleGroup[] = [{ groupName: "Basic", examples: [] }];
    const exampleService = {
      loadExamples: vi.fn(async () => examples),
    };

    const app = new ScafiWebApp(store as never, configRepository as never, exampleService as never);
    const received: string[] = [];
    app.subscribe((event) => {
      received.push(event.type);
    });

    const configuration: SupportConfiguration = {
      network: { kind: "grid", rows: 1, cols: 1, stepX: 10, stepY: 10, tolerance: 0 },
      neighbour: { range: 20 },
      deviceShape: { sensors: {}, initialValues: {} },
      seed: { configSeed: 1, simulationSeed: 2, randomSensorSeed: 3 },
    };
    const editor = { code: "mid()", mode: "easy-scala" as const };
    const world = '{"network":{"kind":"grid"}}';
    const renderer = 'return { nodeSize: 14 };';

    expect(app.loadPersistedConfiguration(configuration)).toEqual(configuration);
    expect(app.loadPersistedEditor(editor)).toEqual(editor);
    expect(app.loadPersistedWorldDocument(world)).toEqual(world);
    expect(app.loadPersistedRendererDocument(renderer)).toEqual(renderer);
    expect(app.previewCompiledSource(editor, world)).toBe("compiled-source");
    await expect(app.loadExamples()).resolves.toEqual(examples);
    await app.loadScript(editor, world);
    app.saveWorldDocument(world);
    app.saveRendererDocument(renderer);

    expect(store.evolve).toHaveBeenCalledWith(configuration);
    expect(configRepository.saveEditorDocument).toHaveBeenCalledWith(editor);
    expect(configRepository.saveWorldDocument).toHaveBeenCalledWith(world);
    expect(configRepository.saveRendererDocument).toHaveBeenCalledWith(renderer);
    expect(store.previewCompiledSource).toHaveBeenCalledWith("mid()", "easy-scala", world);
    expect(store.loadScript).toHaveBeenCalledWith("mid()", "easy-scala", world);
    expect(received).toEqual(["configuration-loaded", "editor-loaded", "examples-loaded"]);
  });

});