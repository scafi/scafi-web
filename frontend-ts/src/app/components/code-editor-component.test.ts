// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CodeEditorComponent } from "./code-editor-component";
import type { EditorDocument, ExampleDefinition, SupportConfiguration } from "../../domain/contracts";

vi.mock("@codemirror/view", () => {
  class MockEditorView {
    static theme = vi.fn(() => ({}));
    static updateListener = {
      of: vi.fn((cb) => ({ _updateListener: cb })),
    };
    static editable = {
      of: vi.fn((val) => ({ _editable: val })),
    };

    config: any;
    destroy = vi.fn();
    dispatch = vi.fn();
    state: any;

    constructor(config: any) {
      this.config = config;
      this.state = {
        doc: {
          toString: vi.fn(() => config.state?.doc?.toString() ?? "current value"),
        },
      };
      (globalThis as any).mockLastInstance = this;
      (globalThis as any).mockLastEditorViewConfig = config;
    }
  }

  return {
    EditorView: MockEditorView,
    keymap: {
      of: vi.fn((keys) => ({ _keymap: keys })),
    },
  };
});

vi.mock("codemirror", () => {
  return {
    basicSetup: [],
  };
});


vi.mock("@codemirror/state", () => {
  return {
    EditorState: {
      create: vi.fn((config) => ({
        doc: {
          toString: vi.fn(() => config?.doc ?? "current value"),
        },
        config,
      })),
      readOnly: {
        of: vi.fn((val) => ({ _readOnly: val })),
      },
    },
  };
});

vi.mock("@codemirror/language", () => {
  return {
    StreamLanguage: {
      define: vi.fn((mode) => ({ _streamLanguage: mode })),
    },
    HighlightStyle: {
      define: vi.fn((specs) => ({ _highlightStyle: specs })),
    },
    syntaxHighlighting: vi.fn((style) => ({ _syntaxHighlighting: style })),
    indentUnit: {
      of: vi.fn((val) => ({ _indentUnit: val })),
    },
  };
});

vi.mock("@codemirror/legacy-modes/mode/clike", () => {
  return {
    scala: { _scalaMode: true },
  };
});

vi.mock("@codemirror/lang-javascript", () => {
  return {
    javascript: vi.fn(() => ({ _javascriptMode: true })),
  };
});

vi.mock("@codemirror/autocomplete", () => {
  return {
    autocompletion: vi.fn((config) => {
      (globalThis as any).mockLastAutocompletionConfig = config;
      return { _autocompletion: config };
    }),
  };
});

// Import mocked entities to inspect them directly
import { EditorState } from "@codemirror/state";

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
    root.innerHTML = `<div class="editor-surface"></div>`;
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
    (globalThis as any).mockLastInstance = null;
    (globalThis as any).mockLastEditorViewConfig = null;
    (globalThis as any).mockLastAutocompletionConfig = null;
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

    const createCall = (EditorState.create as any).mock.calls[0];
    const extensions = createCall[0].extensions;
    const updateListenerObj = extensions.find((ext: any) => ext && ext._updateListener);
    expect(updateListenerObj).toBeDefined();
    const updateListener = updateListenerObj._updateListener;

    updateListener({
      docChanged: true,
      state: {
        doc: {
          toString: () => "updated code value",
        },
      },
    });

    expect(onContentChanged).toHaveBeenCalled();
    expect(mockApp.saveEditor).toHaveBeenCalledWith({
      code: "updated code value",
      mode: "easy-scala",
    });
  });

  it("provides intelligent context-aware autocompletion hints", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    component.attachCodeEditor("dark");

    const createCall = (EditorState.create as any).mock.calls[0];
    const extensions = createCall[0].extensions;
    const autocompleteObj = extensions.find((ext: any) => ext && ext._autocompletion);
    expect(autocompleteObj).toBeDefined();
    const provider = autocompleteObj._autocompletion.override[0];
    expect(provider).toBeDefined();

    // 1. Full prefix match: 'RendererKit.node.ma'
    component.setActivePlaygroundDocument("renderer");
    const mockContext1 = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 17, to: 19, text: "ma" })),
    };
    const hints1 = provider(mockContext1);
    expect(hints1).toBeDefined();
    expect(hints1.options.length).toBeGreaterThan(0);

    const matrixHint1 = hints1.options.find((o: any) => o.label.includes("matrix"));
    expect(matrixHint1).toBeDefined();
    expect(matrixHint1.label).toBe("RendererKit.node.matrix()");

    // 2. Nested substring match: 'node.ma'
    const mockContext2 = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 5, to: 7, text: "ma" })),
    };
    const hints2 = provider(mockContext2);
    const matrixHint2 = hints2.options.find((o: any) => o.label.includes("matrix"));
    expect(matrixHint2).toBeDefined();
    expect(matrixHint2.label).toBe("RendererKit.node.matrix()");

    // 3. Fallback matching when dots are absent: 'sin'
    component.setActivePlaygroundDocument("code");
    const mockContext3 = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 3, text: "sin" })),
    };
    const hints3 = provider(mockContext3);
    const sinHint = hints3.options.find((o: any) => o.label.includes("sin"));
    expect(sinHint).toBeDefined();
    expect(sinHint.label).toBe("math.sin(x)");

    // 4. Checking 'rep' autocomplete
    const mockContext4 = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 3, text: "rep" })),
    };
    const hints4 = provider(mockContext4);
    expect(hints4).toBeDefined();
    const repHints = hints4.options.filter((o: any) => o.label.startsWith("rep"));
    expect(repHints.length).toBe(2);
    expect(repHints[0].label).toBe("rep(init)(f)");
    expect(repHints[1].label).toBe("rep(0) { accum => ... }");
  });

  it("provides dynamic local suggestions from current code", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    component.attachCodeEditor("dark");

    const createCall = (EditorState.create as any).mock.calls[0];
    const extensions = createCall[0].extensions;
    const autocompleteObj = extensions.find((ext: any) => ext && ext._autocompletion);
    const provider = autocompleteObj._autocompletion.override[0];

    const customCode = `
      val mySpecialValue = 100
      var myMutableVar = 42
      def myCustomMethod(a: Int, b: String): Double = { a }
      class MyAmazingClass
      object MyAwesomeObject
      trait MyCoolTrait
    `;

    if ((globalThis as any).mockLastInstance) {
      (globalThis as any).mockLastInstance.state.doc.toString = () => customCode;
    }

    component.setActivePlaygroundDocument("code");
    const mockContext = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 0, text: "" })),
    };

    const hints = provider(mockContext);
    expect(hints).toBeDefined();

    const myValHint = hints.options.find((o: any) => o.label === "mySpecialValue");
    expect(myValHint).toBeDefined();
    expect(myValHint.detail).toBe("Local immutable value: val mySpecialValue");

    const myMutableHint = hints.options.find((o: any) => o.label === "myMutableVar");
    expect(myMutableHint).toBeDefined();

    const myMethodHint = hints.options.find((o: any) => o.label === "myCustomMethod");
    expect(myMethodHint).toBeDefined();

    const classHint = hints.options.find((o: any) => o.label === "MyAmazingClass");
    expect(classHint).toBeDefined();

    const objectHint = hints.options.find((o: any) => o.label === "MyAwesomeObject");
    expect(objectHint).toBeDefined();

    const traitHint = hints.options.find((o: any) => o.label === "MyCoolTrait");
    expect(traitHint).toBeDefined();
  });

  it("suggests newly enriched ScaFi movement, spatial, and actuation APIs", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    component.attachCodeEditor("dark");

    const createCall = (EditorState.create as any).mock.calls[0];
    const extensions = createCall[0].extensions;
    const autocompleteObj = extensions.find((ext: any) => ext && ext._autocompletion);
    const provider = autocompleteObj._autocompletion.override[0];

    component.setActivePlaygroundDocument("code");
    
    // Test clockwiseRotation presence
    const mockContextRot = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 4, text: "cloc" })),
    };
    const hintsRot = provider(mockContextRot);
    const rotHint = hintsRot.options.find((o: any) => o.label.includes("clockwiseRotation"));
    expect(rotHint).toBeDefined();

    // Test CircularZone presence
    const mockContextZone = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 4, text: "Circ" })),
    };
    const hintsZone = provider(mockContextZone);
    const zoneHint = hintsZone.options.find((o: any) => o.label.includes("CircularZone"));
    expect(zoneHint).toBeDefined();

    // Test velocity.set presence
    const mockContextVelocity = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 9, to: 12, text: "set" })),
    };
    const hintsVelocity = provider(mockContextVelocity);
    const velHint = hintsVelocity.options.find((o: any) => o.label.includes("velocity.set"));
    expect(velHint).toBeDefined();
  });

  it("provides dynamic suggestions for Scala lambda block parameters", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    component.attachCodeEditor("dark");

    const createCall = (EditorState.create as any).mock.calls[0];
    const extensions = createCall[0].extensions;
    const autocompleteObj = extensions.find((ext: any) => ext && ext._autocompletion);
    const provider = autocompleteObj._autocompletion.override[0];

    component.setActivePlaygroundDocument("code");

    const codeWithLambdas = `
      rep(0) { myAccum =>
        foldhood(0)(_ + _) { (myAcc, myNbr) =>
          share(0.0) { (sharedVal: Double, sharedState: String) =>
            case myPatternMatchedVar =>
            case PatternWithParams(ignored1, ignored2) =>
          }
        }
      }
    `;

    if ((globalThis as any).mockLastInstance) {
      (globalThis as any).mockLastInstance.state.doc.toString = () => codeWithLambdas;
    }

    const mockContext = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 0, text: "" })),
    };

    const hints = provider(mockContext);
    expect(hints).toBeDefined();

    // Verify lambda parameters are extracted
    const accumHint = hints.options.find((o: any) => o.label === "myAccum");
    expect(accumHint).toBeDefined();
    expect(accumHint.detail).toBe("Lambda parameter: myAccum");

    const accHint = hints.options.find((o: any) => o.label === "myAcc");
    expect(accHint).toBeDefined();

    const nbrHint = hints.options.find((o: any) => o.label === "myNbr");
    expect(nbrHint).toBeDefined();

    const sharedValHint = hints.options.find((o: any) => o.label === "sharedVal");
    expect(sharedValHint).toBeDefined();

    const sharedStateHint = hints.options.find((o: any) => o.label === "sharedState");
    expect(sharedStateHint).toBeDefined();

    // Verify case branch variables are excluded
    const patternMatchedHint = hints.options.find((o: any) => o.label === "myPatternMatchedVar");
    expect(patternMatchedHint).toBeUndefined();

    const ignored1Hint = hints.options.find((o: any) => o.label === "ignored1");
    expect(ignored1Hint).toBeUndefined();

    // Verify wildcards are excluded
    const wildcardHint = hints.options.find((o: any) => o.label === "_");
    expect(wildcardHint).toBeUndefined();
  });

  it("prioritizes local exact/prefix variable matches at the top of hints", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    component.attachCodeEditor("dark");

    const createCall = (EditorState.create as any).mock.calls[0];
    const extensions = createCall[0].extensions;
    const autocompleteObj = extensions.find((ext: any) => ext && ext._autocompletion);
    const provider = autocompleteObj._autocompletion.override[0];

    component.setActivePlaygroundDocument("code");

    const codeWithLocalVars = `
      val gradient = 100.0
      val color = hsl(0.5, 0.5, 0.5)
    `;

    if ((globalThis as any).mockLastInstance) {
      (globalThis as any).mockLastInstance.state.doc.toString = () => codeWithLocalVars;
    }

    // Simulate typing 'gradient'
    const mockContextGradient = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 8, text: "gradient" })),
    };

    const hintsGrad = provider(mockContextGradient);
    expect(hintsGrad).toBeDefined();
    
    // The very first element in the suggestions list MUST be the exact local variable 'gradient' (Priority 1)
    expect(hintsGrad.options[0].label).toBe("gradient");
    
    // Other items like 'gradientCast' (starts with 'gradient') can follow, but are below
    const gradientCastIndex = hintsGrad.options.findIndex((o: any) => o.label.includes("gradientCast"));
    expect(gradientCastIndex).toBeGreaterThan(0);

    // Simulate typing 'color'
    const mockContextColor = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 5, text: "color" })),
    };

    const hintsColor = provider(mockContextColor);
    expect(hintsColor).toBeDefined();

    // The very first element in the list MUST be the exact local variable 'color' (Priority 1)
    expect(hintsColor.options[0].label).toBe("color");

    // Other items matching 'color' only in their description (like hsl or rgb) must be sorted below the local variable
    const hslIndex = hintsColor.options.findIndex((o: any) => o.label.startsWith("hsl"));
    expect(hslIndex).toBeGreaterThan(0);
  });

  it("dynamically resolves the current cursor position when applying a hint to avoid trailing duplicated text", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    component.attachCodeEditor("dark");

    const createCall = (EditorState.create as any).mock.calls[0];
    const extensions = createCall[0].extensions;
    const autocompleteObj = extensions.find((ext: any) => ext && ext._autocompletion);
    const provider = autocompleteObj._autocompletion.override[0];

    component.setActivePlaygroundDocument("code");

    // 1. Trigger autocomplete at prefix "re"
    const mockContext = {
      explicit: true,
      matchBefore: vi.fn(() => ({ from: 0, to: 2, text: "re" })),
    };

    const hints = provider(mockContext);
    expect(hints).toBeDefined();

    const repHint = hints.options.find((o: any) => o.label === "rep(init)(f)");
    expect(repHint).toBeDefined();

    // 2. Apply the hint
    const mockView = (globalThis as any).mockLastInstance;
    repHint.apply(mockView, repHint, 0, 3); // from is 0, to is 3 (typed p)

    // 3. Assert view.dispatch was called with the live cursor position parameters
    expect(mockView.dispatch).toHaveBeenCalledWith({
      changes: {
        from: 0,
        to: 3,
        insert: "rep() { self => \n  \n}",
      },
      selection: {
        anchor: 4,
        head: 4,
      },
    });
  });
});
