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
    hoverTooltip: vi.fn((source) => ({ _hoverTooltip: source })),
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
    StateEffect: {
      define: vi.fn(() => {
        const type: any = {
          of: (value: unknown) => ({ _effectType: type, value }),
          is: (effect: any) => effect?._effectType === type,
        };
        return type;
      }),
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
    // Mirrors the real helper closely enough: it attaches an `apply` and keeps the template.
    snippetCompletion: vi.fn((template, completion) => ({ ...completion, _snippet: template, apply: vi.fn() })),
    startCompletion: vi.fn(),
  };
});

vi.mock("@codemirror/lint", () => {
  return {
    linter: vi.fn((source) => ({ _linter: source })),
    lintGutter: vi.fn(() => ({ _lintGutter: true })),
    forceLinting: vi.fn(),
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

  function attach(component: CodeEditorComponent) {
    component.attachCodeEditor("dark");
    const extensions = (EditorState.create as any).mock.calls[0][0].extensions;
    const autocompletion = extensions.find((ext: any) => ext && ext._autocompletion);
    return {
      extensions,
      staticSource: autocompletion._autocompletion.override[0],
      lintSource: extensions.find((ext: any) => ext && ext._linter)?._linter,
      hoverSource: extensions.find((ext: any) => ext && ext._hoverTooltip)?._hoverTooltip,
    };
  }

  /** A `Text`-like stand-in good enough for lineAt/line/toString. */
  function fakeDoc(text: string) {
    const lines = text.split("\n");
    const startOf = (index: number) => lines.slice(0, index).reduce((sum, l) => sum + l.length + 1, 0);
    return {
      length: text.length,
      lines: lines.length,
      toString: () => text,
      line: (number: number) => ({
        number,
        from: startOf(number - 1),
        length: lines[number - 1].length,
        text: lines[number - 1],
      }),
      lineAt: (pos: number) => {
        let index = 0;
        while (index < lines.length - 1 && startOf(index + 1) <= pos) index += 1;
        return { number: index + 1, from: startOf(index), length: lines[index].length, text: lines[index] };
      },
    };
  }

  function contextFor(text: string, pos: number, word: { from: number; to: number; text: string }) {
    return {
      explicit: true,
      pos,
      state: { doc: fakeDoc(text) },
      matchBefore: vi.fn(() => word),
      addEventListener: vi.fn(),
    } as any;
  }

  it("offers catalog entries keyed by the real identifier so CodeMirror can filter them", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { staticSource } = attach(component);

    const hints = staticSource(contextFor("rep", 3, { from: 0, to: 3, text: "rep" }));
    expect(hints.from).toBe(0);

    const rep = hints.options.find((o: any) => o.label === "rep");
    expect(rep).toBeDefined();
    expect(rep.displayLabel).toBe("rep(init)(fun)");
    // The signature lives in displayLabel, never in the label CodeMirror matches against.
    expect(hints.options.every((o: any) => !o.label.includes("("))).toBe(true);
  });

  it("keeps dotted namespaces completable", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { staticSource } = attach(component);
    component.setActivePlaygroundDocument("renderer");

    const hints = staticSource(contextFor("RendererKit.node.ma", 19, { from: 0, to: 19, text: "RendererKit.node.ma" }));
    expect(hints.options.some((o: any) => o.label === "RendererKit.node.matrix")).toBe(true);
  });

  it("only offers world-document methods that exist on WorldDocumentBuilder", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { staticSource } = attach(component);
    component.setActivePlaygroundDocument("world");

    const labels = staticSource(contextFor("world.", 6, { from: 6, to: 6, text: "" })).options.map((o: any) => o.label);
    expect(labels).toEqual(expect.arrayContaining(["grid", "random", "radius", "matrix", "matrixPixels", "randomSensor", "seed"]));
    // These were offered by the old catalog but are not methods of the builder.
    for (const ghost of ["uniform", "exponential", "normal", "line", "ring", "clique", "obstacle"]) {
      expect(labels).not.toContain(ghost);
    }
  });

  it("completes the //using directive with mixin traits and nothing else", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { staticSource } = attach(component);

    const hints = staticSource(contextFor("//using Stand\nmid()", 13, { from: 8, to: 13, text: "Stand" }));
    const labels = hints.options.map((o: any) => o.label);
    expect(labels).toContain("StandardSensors");
    expect(labels).toContain("Movement2D");
    expect(labels).not.toContain("rep");
  });

  it("suggests symbols defined in the buffer and boosts them above the catalog", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { staticSource } = attach(component);

    const code = "val gradient = 1\nvar counter = 0\ndef helper(x: Int) = x\nclass Thing\n";
    const options = staticSource(contextFor(code, 3, { from: 0, to: 3, text: "gra" })).options;
    const byLabel = new Map<string, any>(options.map((o: any) => [o.label, o]));

    expect(byLabel.get("gradient")?.detail).toBe("Local value: val gradient");
    expect(byLabel.get("counter")).toBeDefined();
    expect(byLabel.get("helper")).toBeDefined();
    expect(byLabel.get("Thing")).toBeDefined();
    expect(byLabel.get("gradient")?.boost).toBeGreaterThan(byLabel.get("rep")?.boost);
  });

  it("extracts lambda parameters but skips case patterns", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { staticSource } = attach(component);

    const code = "foldhood(0)((acc, nb) => acc + nb)\nrep(0) { self => self }\nx match { case other => 1 }\n";
    const labels = staticSource(contextFor(code, 1, { from: 0, to: 1, text: "a" })).options.map((o: any) => o.label);
    expect(labels).toEqual(expect.arrayContaining(["acc", "nb", "self"]));
    expect(labels).not.toContain("other");
  });

  function stubCompileSource() {
    return vi.fn(() => ({
      code: "wrapped",
      toWrapped: () => ({ line: 1, ch: 0 }),
      toEditor: () => undefined,
      offsetOf: () => 7,
    }));
  }

  it("merges type-aware Metals results and drops the catalog duplicate", async () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    mockApp.buildCompileSource = stubCompileSource();
    const complete = vi.fn(async () => ({
      isIncomplete: false,
      items: [{
        label: "nbrRange",
        detail: "(): Double",
        tpe: "method",
        instructions: { text: "nbrRange()", editRange: { startLine: 1, startChar: 0, endLine: 1, endChar: 4 } },
        additionalInsertInstructions: [],
      }],
    }));
    component.setMetalsService({ complete } as any);
    const { staticSource } = attach(component);

    // First query answers from the catalog and starts the lookup.
    const context = contextFor("nbrR", 4, { from: 0, to: 4, text: "nbrR" });
    const first = staticSource(context);
    expect(first.options.filter((o: any) => o.label === "nbrRange")).toHaveLength(1);
    expect(first.options.find((o: any) => o.label === "nbrRange").detail).not.toBe("(): Double");

    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith("wrapped", 7));

    // Once it lands, the compiler entry replaces the catalog one rather than joining it.
    const second = staticSource(context);
    const matches = second.options.filter((o: any) => o.label === "nbrRange");
    expect(matches).toHaveLength(1);
    expect(matches[0].detail).toBe("(): Double");
    expect(matches[0].boost).toBe(2);
  });

  it("falls back to the catalog when Metals is absent or fails", async () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { staticSource } = attach(component);

    const context = contextFor("nbrR", 4, { from: 0, to: 4, text: "nbrR" });
    expect(staticSource(context).options.some((o: any) => o.label === "nbrRange")).toBe(true);

    mockApp.buildCompileSource = stubCompileSource();
    const complete = vi.fn(async () => { throw new Error("offline"); });
    component.setMetalsService({ complete } as any);

    expect(staticSource(context).options.some((o: any) => o.label === "nbrRange")).toBe(true);
    await vi.waitFor(() => expect(complete).toHaveBeenCalled());
    expect(staticSource(context).options.some((o: any) => o.label === "nbrRange")).toBe(true);
  });

  it("shows the compiler's type and scaladoc on hover", async () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    mockApp.buildCompileSource = stubCompileSource();
    const hover = vi.fn(async () => ({
      content: "**Expression type**:\n```scala\nDouble\n```\nDistance to the neighbour.",
    }));
    component.setMetalsService({ hover } as any);
    const { hoverSource } = attach(component);

    const doc = fakeDoc("nbrRange()");
    const tooltip = await hoverSource({ state: { doc } }, 4, 1);

    expect(hover).toHaveBeenCalledWith("wrapped", 7);
    expect(tooltip).toMatchObject({ pos: 0, end: 8 });
    // Markdown fences would only be noise in a plain-text tooltip.
    expect(tooltip.create().dom.textContent).toBe("Expression type:\nDouble\nDistance to the neighbour.");
  });

  it("shows no hover when Metals is unavailable", async () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { hoverSource } = attach(component);

    expect(await hoverSource({ state: { doc: fakeDoc("nbrRange()") } }, 4, 1)).toBeNull();
  });

  it("reports unbalanced brackets without compiling", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { lintSource } = attach(component);

    const diagnostics = lintSource({ state: { doc: fakeDoc("rep(0) { x => x\n") } });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Unclosed '{'");
    expect(diagnostics[0].severity).toBe("error");
  });

  it("flags an invalid world document on the line that carries the bad call", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { lintSource } = attach(component);
    component.setActivePlaygroundDocument("world");

    const text = "world\n  .grid(rows = 10, cols = 10, stepX = 60, stepY = 60, tolerance = 10)\n  .radius(abc)";
    const diagnostics = lintSource({ state: { doc: fakeDoc(text) } });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain(".radius(...) requires a numeric literal");
    expect(diagnostics[0].from).toBe(text.indexOf(".radius("));
  });

  it("reports compiler messages through the same lint source as the local checks", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { lintSource } = attach(component);

    component.setCompileProblems(
      [{ severity: "error", message: "type mismatch", line: 430, endLine: 430, startColumn: 20, endColumn: 22, actions: [] }],
      {
        code: "",
        toWrapped: () => undefined,
        // Wrapped line 430 is the second line of the code document.
        toEditor: ({ ch }: any) => ({ tab: "code" as const, line: 2, ch: Math.max(0, ch - 4) }),
        offsetOf: () => 0,
      } as any,
    );

    const doc = fakeDoc("val a = 1\nval b: String = 42\n");
    const diagnostics = lintSource({ state: { doc } });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      from: doc.line(2).from + 16,
      to: doc.line(2).from + 18,
      severity: "error",
      message: "type mismatch",
    });
  });

  it("keeps compiler messages alive across relints, next to the local ones", () => {
    const component = new CodeEditorComponent(root, mockApp);
    component.initialize(initialConfig);
    const { lintSource } = attach(component);

    component.setCompileProblems(
      [{ severity: "error", message: "type mismatch", line: 1, endLine: 1, startColumn: 0, endColumn: 1, actions: [] }],
      {
        code: "",
        toWrapped: () => undefined,
        toEditor: () => ({ tab: "code" as const, line: 1, ch: 0 }),
        offsetOf: () => 0,
      } as any,
    );

    const messages = lintSource({ state: { doc: fakeDoc("rep(0) { x => x") } }).map((d: any) => d.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m: string) => m.includes("Unclosed"))).toBe(true);
    expect(messages).toContain("type mismatch");
  });
});
