// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CodeEditorComponent } from "./code-editor-component";
import type { EditorDocument, ExampleDefinition, SupportConfiguration } from "../../domain/contracts";

const mockCodeMirrorInstance = {
  setSize: vi.fn(),
  on: vi.fn(),
  getValue: vi.fn(() => "current value"),
  toTextArea: vi.fn(),
  setOption: vi.fn(),
  showHint: vi.fn(),
  state: {},
};

vi.mock("codemirror", () => {
  return {
    default: {
      fromTextArea: vi.fn(() => mockCodeMirrorInstance),
      Pos: (line: number, ch: number) => ({ line, ch }),
    },
  };
});

describe("CodeEditorComponent", () => {
  let root: HTMLElement;
  let mockApp: any;
  const initialConfig: SupportConfiguration = {
    network: { kind: "grid", rows: 1, cols: 1, stepX: 10, stepY: 10, tolerance: 0 },
    neighbour: { range: 20 },
    deviceShape: { sensors: {}, initialValues: {} },
    seed: { configSeed: 1, simulationSeed: 2, randomSensorSeed: 3 },
  };

  beforeEach(() => {
    root = document.createElement("div");
    root.innerHTML = `<textarea id="code-editor"></textarea>`;
    document.body.appendChild(root);

    mockApp = {
      loadPersistedEditor: vi.fn((defaults) => defaults),
      loadPersistedWorldDocument: vi.fn((defaults) => defaults),
      loadPersistedRendererDocument: vi.fn((defaults) => defaults),
      saveEditor: vi.fn(),
      saveWorldDocument: vi.fn(),
      saveRendererDocument: vi.fn(),
      previewCompiledSource: vi.fn(() => "compiled source mock"),
    };

    vi.clearAllMocks();
  });

  it("initializes and loads persisted documents", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);

    expect(mockApp.loadPersistedEditor).toHaveBeenCalled();
    expect(mockApp.loadPersistedWorldDocument).toHaveBeenCalled();
    expect(mockApp.loadPersistedRendererDocument).toHaveBeenCalled();

    expect(component.getActivePlaygroundDocument()).toBe("code");
    expect(component.getActiveEditorMode()).toBe("easy-scala");
  });

  it("swaps active playground document tabs", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);

    const onTabChanged = vi.fn();
    component.setCallbacks({ onTabChanged });

    component.setActivePlaygroundDocument("world");
    expect(component.getActivePlaygroundDocument()).toBe("world");
    expect(onTabChanged).toHaveBeenCalledWith("world");

    component.setActivePlaygroundDocument("world"); // duplicate should be ignored
    expect(onTabChanged).toHaveBeenCalledTimes(1);
  });

  it("loads examples and saves world/renderer documents", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);

    const example: ExampleDefinition = {
      name: "Test Example",
      body: "mid() + 1",
      devices: { sensors: {}, initialValues: {} },
      world: '{"network":{"kind":"grid"}}',
      renderer: "return { nodeSize: 15 };",
    };

    component.loadExample(example, initialConfig);

    expect(mockApp.saveWorldDocument).toHaveBeenCalledWith('{"network":{"kind":"grid"}}');
    expect(mockApp.saveRendererDocument).toHaveBeenCalledWith("return { nodeSize: 15 };");
    expect(mockApp.saveEditor).toHaveBeenCalledWith({ code: "mid() + 1", mode: "easy-scala" });
    expect(component.getActiveEditorMode()).toBe("easy-scala");
  });

  it("switches editor mode and updates editor mode state", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);

    const onModeChanged = vi.fn();
    component.setCallbacks({ onModeChanged });

    component.switchEditorMode("full-scala");
    expect(component.getActiveEditorMode()).toBe("full-scala");
    expect(mockApp.saveEditor).toHaveBeenCalledWith(expect.objectContaining({ mode: "full-scala" }));
    expect(onModeChanged).toHaveBeenCalledWith("full-scala");
  });

  it("resolves the correct text to show based on the active tab", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);

    expect(component.getActiveEditorText()).toContain("hello scafi"); // default basic code

    component.setActivePlaygroundDocument("world");
    expect(component.getActiveEditorText()).toContain(".grid(rows = 1");

    component.setActivePlaygroundDocument("renderer");
    expect(component.getActiveEditorText()).toContain("nodeSize"); // default renderer code

    component.setActivePlaygroundDocument("compiled");
    expect(component.getActiveEditorText()).toBe("compiled source mock");
  });

  it("attaches CodeMirror text editor integration and handles change events", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);

    const onContentChanged = vi.fn();
    component.setCallbacks({ onContentChanged });

    component.attachCodeEditor("dark");

    // Retrieve the CodeMirror onChange listener
    const onCall = mockCodeMirrorInstance.on;
    expect(onCall).toHaveBeenCalledWith("change", expect.any(Function));
    const onChangeListener = onCall.mock.calls.find(c => c[0] === "change")?.[1];

    if (onChangeListener) {
      onChangeListener(mockCodeMirrorInstance);
    }

    expect(onContentChanged).toHaveBeenCalled();
    expect(mockApp.saveEditor).toHaveBeenCalled();
  });

  it("provides intelligent context-aware autocompletion hints", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    component.attachCodeEditor("dark");

    const setOptionCall = mockCodeMirrorInstance.setOption;
    expect(setOptionCall).toHaveBeenCalledWith("hint", expect.any(Function));
    const hintCallback = setOptionCall.mock.calls.find(c => c[0] === "hint")?.[1];

    expect(hintCallback).toBeDefined();

    // 1. Full prefix match: 'RendererKit.node.ma'
    const mockCm1 = {
      getCursor: () => ({ line: 0, ch: 19 }),
      getLine: () => "RendererKit.node.ma",
      getTokenAt: () => ({ string: "ma", start: 17, end: 19 }),
    };

    component.setActivePlaygroundDocument("renderer");
    const hints1 = hintCallback(mockCm1);
    expect(hints1).toBeDefined();
    expect(hints1.list.length).toBeGreaterThan(0);

    const matrixHint1 = hints1.list.find((h: any) => h.displayText.includes("matrix"));
    expect(matrixHint1).toBeDefined();
    expect(matrixHint1.text).toBe("RendererKit.node.matrix()");

    // 2. Nested substring match: 'node.ma'
    const mockCm2 = {
      getCursor: () => ({ line: 0, ch: 7 }),
      getLine: () => "node.ma",
      getTokenAt: () => ({ string: "ma", start: 5, end: 7 }),
    };
    const hints2 = hintCallback(mockCm2);
    const matrixHint2 = hints2.list.find((h: any) => h.displayText.includes("matrix"));
    expect(matrixHint2).toBeDefined();
    expect(matrixHint2.text).toBe("node.matrix()");

    // 3. Fallback matching when dots are absent: 'sin'
    component.setActivePlaygroundDocument("code");
    const mockCm3 = {
      getCursor: () => ({ line: 0, ch: 3 }),
      getLine: () => "sin",
      getTokenAt: () => ({ string: "sin", start: 0, end: 3 }),
    };
    const hints3 = hintCallback(mockCm3);
    const sinHint = hints3.list.find((h: any) => h.displayText.includes("sin"));
    expect(sinHint).toBeDefined();
    expect(sinHint.text).toBe("math.sin()");
  });
});
