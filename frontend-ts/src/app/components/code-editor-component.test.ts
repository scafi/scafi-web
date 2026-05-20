// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CodeEditorComponent } from "./code-editor-component";
import type { EditorDocument, ExampleDefinition, SupportConfiguration } from "../../domain/contracts";

const mockCodeMirrorInstance = {
  setSize: vi.fn(),
  on: vi.fn(),
  getValue: vi.fn(() => "current value"),
  toTextArea: vi.fn(),
};

vi.mock("codemirror", () => {
  return {
    default: {
      fromTextArea: vi.fn(() => mockCodeMirrorInstance),
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
});
