import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";

import { EditorState } from "@codemirror/state";
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { scala } from "@codemirror/legacy-modes/mode/clike";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import { convertEasyScalaToFull } from "../../services/scastie/easy-scala";
import { defaultRendererDocument } from "../renderer-document";
import { defaultEditorDocument } from "../defaults";
import type { EditorDocument, ExampleDefinition, SupportConfiguration } from "../../domain/contracts";
import type { ScafiWebApp } from "../scafi-web-app";
import { serializeWorldDocument } from "../../services/config/world-document";

export type PlaygroundDocument = "code" | "world" | "renderer" | "compiled";

export interface CodeEditorCallbacks {
  onContentChanged?(): void;
  onModeChanged?(mode: EditorDocument["mode"]): void;
  onTabChanged?(tab: PlaygroundDocument): void;
  onRendererCompiled?(): void;
}

const editorBaseTheme = EditorView.theme({
  "&": {
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace',
    lineHeight: "1.45",
  },
  ".cm-content": {
    padding: "12px 0",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent-cool)",
  },
});

const darkThemeExtension = EditorView.theme({
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(99, 102, 241, 0.32) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  ".cm-gutters": {
    color: "#787c99",
  },
}, { dark: true });

const lightThemeExtension = EditorView.theme({
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(155, 48, 255, 0.15) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },
  ".cm-gutters": {
    color: "#686b85",
  },
}, { dark: false });

const cosmicHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#bb9af7", fontWeight: "bold" },
  { tag: t.string, color: "#73daca" },
  { tag: t.comment, color: "#565f89", fontStyle: "italic" },
  { tag: t.number, color: "#ff9e64" },
  { tag: t.bool, color: "#ff9e64" },
  { tag: t.variableName, color: "#cfc5f4" },
  { tag: t.definition(t.variableName), color: "#e0af68", fontWeight: "bold" },
  { tag: t.function(t.variableName), color: "#7aa2f7" },
  { tag: t.typeName, color: "#ff007f" },
  { tag: t.className, color: "#ff007f" },
  { tag: t.operator, color: "#89ddff" },
  { tag: t.punctuation, color: "#9ab3c4" },
  { tag: t.meta, color: "#f7768e" },
  { tag: t.bracket, color: "#89ddff" },
]);

const cosmicLightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#8b00ff", fontWeight: "bold" },
  { tag: t.string, color: "#008a4f" },
  { tag: t.comment, color: "#686b85", fontStyle: "italic" },
  { tag: t.number, color: "#d95f02" },
  { tag: t.bool, color: "#d95f02" },
  { tag: t.variableName, color: "#1c1d24" },
  { tag: t.definition(t.variableName), color: "#007ea7", fontWeight: "bold" },
  { tag: t.function(t.variableName), color: "#007ea7" },
  { tag: t.typeName, color: "#c71585" },
  { tag: t.className, color: "#c71585" },
  { tag: t.operator, color: "#007ea7" },
  { tag: t.punctuation, color: "#686b85" },
  { tag: t.meta, color: "#b22222" },
  { tag: t.bracket, color: "#007ea7" },
]);

export class CodeEditorComponent {
  private codeEditor?: EditorView;
  private mountedDocument?: PlaygroundDocument;
  private mountedEditorMode?: EditorDocument["mode"];
  
  private easyScalaBuffer = defaultEditorDocument.code;
  private fullScalaBuffer = convertEasyScalaToFull(defaultEditorDocument.code);
  private activeEditorMode: EditorDocument["mode"] = defaultEditorDocument.mode;
  private activePlaygroundDocument: PlaygroundDocument = "code";
  
  private editorDocument: EditorDocument = defaultEditorDocument;
  private worldDocument = "";
  private rendererDocument = defaultRendererDocument;
  private rendererDocumentDebounce?: number;
  private readOnly = false;

  private callbacks: CodeEditorCallbacks = {};

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {}

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  initialize(initialConfig: SupportConfiguration): void {
    this.editorDocument = this.app.loadPersistedEditor(defaultEditorDocument);
    this.initializeEditorBuffers();
    this.worldDocument = this.app.loadPersistedWorldDocument(serializeWorldDocument(initialConfig));
    this.rendererDocument = this.app.loadPersistedRendererDocument(defaultRendererDocument);
  }

  setCallbacks(callbacks: CodeEditorCallbacks): void {
    this.callbacks = callbacks;
  }

  getActivePlaygroundDocument(): PlaygroundDocument {
    return this.activePlaygroundDocument;
  }

  setActivePlaygroundDocument(tab: PlaygroundDocument): void {
    if (this.activePlaygroundDocument === tab) return;
    this.destroyCodeEditor();
    this.activePlaygroundDocument = tab;
    this.callbacks.onTabChanged?.(tab);
  }

  getActiveEditorMode(): EditorDocument["mode"] {
    return this.activeEditorMode;
  }

  getEditorDocument(): EditorDocument {
    return this.editorDocument;
  }

  getWorldDocument(): string {
    return this.worldDocument;
  }

  getRendererDocument(): string {
    return this.rendererDocument;
  }

  setWorldDocument(doc: string): void {
    this.worldDocument = doc;
    this.app.saveWorldDocument(doc);
  }

  setRendererDocument(doc: string): void {
    this.rendererDocument = doc;
    this.app.saveRendererDocument(doc);
  }

  loadExample(example: ExampleDefinition, exampleConfiguration: SupportConfiguration): void {
    this.destroyCodeEditor();
    this.easyScalaBuffer = example.body;
    this.fullScalaBuffer = convertEasyScalaToFull(example.body);
    this.activeEditorMode = "easy-scala";
    this.editorDocument = { code: this.easyScalaBuffer, mode: "easy-scala" };
    this.worldDocument = example.world ?? serializeWorldDocument(exampleConfiguration);
    this.rendererDocument = example.renderer ?? defaultRendererDocument;
    
    this.app.saveWorldDocument(this.worldDocument);
    this.app.saveRendererDocument(this.rendererDocument);
    this.app.saveEditor(this.editorDocument);
  }

  switchEditorMode(newMode: EditorDocument["mode"]): void {
    if (newMode === this.activeEditorMode) {
      return;
    }
    if (newMode === "full-scala" && this.activeEditorMode === "easy-scala") {
      this.fullScalaBuffer = convertEasyScalaToFull(this.easyScalaBuffer);
    }
    this.destroyCodeEditor();
    this.activeEditorMode = newMode;
    this.editorDocument = { code: this.getActiveEditorCode(), mode: newMode };
    this.app.saveEditor(this.editorDocument);
    this.callbacks.onModeChanged?.(newMode);
  }

  attachCodeEditor(theme: "dark" | "light"): void {
    const parentContainer = this.root.querySelector<HTMLElement>(".editor-surface");
    if (!parentContainer) {
      return;
    }
    // Clear any previous editor or legacy textarea
    parentContainer.innerHTML = "";



    const extensions = [
      basicSetup,
      editorBaseTheme,
      theme === "dark" ? darkThemeExtension : lightThemeExtension,
      theme === "dark" ? syntaxHighlighting(cosmicHighlightStyle) : syntaxHighlighting(cosmicLightHighlightStyle),
    ];



    if (this.activePlaygroundDocument === "compiled" || this.readOnly) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(EditorView.editable.of(false));
    } else {
      extensions.push(autocompletion({
        override: [(context) => this.provideHints(context)],
        defaultKeymap: true,
      }));
    }

    if (this.activePlaygroundDocument === "renderer") {
      extensions.push(javascript());
    } else if (this.activePlaygroundDocument === "code" || this.activePlaygroundDocument === "world") {
      extensions.push(StreamLanguage.define(scala));
    }

    extensions.push(EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const currentValue = update.state.doc.toString();
        this.handleContentChanged(currentValue);
      }
    }));

    const cleanExtensions = cleanExtensionsRecursive(extensions);

    const editor = new EditorView({
      state: EditorState.create({
        doc: this.getActiveEditorText(),
        extensions: cleanExtensions,
      }),
      parent: parentContainer,
    });



    this.codeEditor = editor;
    this.mountedDocument = this.activePlaygroundDocument;
    this.mountedEditorMode = this.activeEditorMode;
  }

  destroyCodeEditor(): void {
    if (!this.codeEditor) {
      return;
    }
    const currentValue = this.codeEditor.state.doc.toString();
    const mountedDocument = this.mountedDocument ?? this.activePlaygroundDocument;

    if (mountedDocument === "world") {
      this.worldDocument = currentValue;
      this.app.saveWorldDocument(this.worldDocument);
    } else if (mountedDocument === "renderer") {
      this.rendererDocument = currentValue;
      this.app.saveRendererDocument(this.rendererDocument);
    } else if (mountedDocument === "code") {
      const mountedMode = this.mountedEditorMode ?? this.activeEditorMode;
      this.setBufferForMode(mountedMode, currentValue);
      this.editorDocument = {
        code: this.getBufferForMode(this.activeEditorMode),
        mode: this.activeEditorMode,
      };
    }

    this.codeEditor.destroy();
    this.codeEditor = undefined;
    this.mountedDocument = undefined;
    this.mountedEditorMode = undefined;
  }

  getActiveEditorText(): string {
    if (this.activePlaygroundDocument === "world") {
      return this.worldDocument;
    }
    if (this.activePlaygroundDocument === "renderer") {
      return this.rendererDocument;
    }
    if (this.activePlaygroundDocument === "compiled") {
      return this.app.previewCompiledSource(this.editorDocument, this.worldDocument);
    }
    return this.getActiveEditorCode();
  }

  private initializeEditorBuffers(): void {
    if (this.editorDocument.mode === "full-scala") {
      this.fullScalaBuffer = this.editorDocument.code;
      this.easyScalaBuffer = this.editorDocument.code;
    } else {
      this.easyScalaBuffer = this.editorDocument.code;
      this.fullScalaBuffer = convertEasyScalaToFull(this.editorDocument.code);
    }
    this.activeEditorMode = this.editorDocument.mode;
  }

  private getActiveEditorCode(): string {
    return this.activeEditorMode === "easy-scala" ? this.easyScalaBuffer : this.fullScalaBuffer;
  }

  private getBufferForMode(mode: EditorDocument["mode"]): string {
    return mode === "easy-scala" ? this.easyScalaBuffer : this.fullScalaBuffer;
  }

  private setBufferForMode(mode: EditorDocument["mode"], code: string): void {
    if (mode === "easy-scala") {
      this.easyScalaBuffer = code;
    } else {
      this.fullScalaBuffer = code;
    }
  }

  private updateActiveBuffer(code: string): void {
    this.setBufferForMode(this.activeEditorMode, code);
    this.editorDocument = { code, mode: this.activeEditorMode };
  }

  private handleContentChanged(currentValue: string): void {
    if (this.activePlaygroundDocument === "world") {
      this.worldDocument = currentValue;
      this.app.saveWorldDocument(currentValue);
      this.callbacks.onContentChanged?.();
      return;
    }
    if (this.activePlaygroundDocument === "renderer") {
      this.rendererDocument = currentValue;
      this.app.saveRendererDocument(currentValue);
      if (this.rendererDocumentDebounce !== undefined) {
        window.clearTimeout(this.rendererDocumentDebounce);
      }
      this.rendererDocumentDebounce = window.setTimeout(() => {
        this.callbacks.onRendererCompiled?.();
      }, 300);
      return;
    }
    this.updateActiveBuffer(currentValue);
    this.app.saveEditor(this.editorDocument);
    this.callbacks.onContentChanged?.();
  }

  private provideHints(context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/[a-zA-Z0-9$_.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const contextString = word.text;

    let suggestions: Suggestion[] = [];
    if (this.activePlaygroundDocument === "code") {
      suggestions = [...CODE_SUGGESTIONS];
    } else if (this.activePlaygroundDocument === "world") {
      suggestions = [...WORLD_SUGGESTIONS];
    } else if (this.activePlaygroundDocument === "renderer") {
      suggestions = [...RENDERER_SUGGESTIONS];
    } else {
      return null;
    }

    const currentCode = this.codeEditor ? this.codeEditor.state.doc.toString() : "";
    const localSuggestions = extractLocalSuggestions(currentCode, this.activePlaygroundDocument);
    suggestions = [...suggestions, ...localSuggestions];

    const wordLower = contextString.toLowerCase();
    const filtered = suggestions.filter((s) => {
      if (!wordLower) return true;
      if (wordLower.includes(".")) {
        return (
          s.text.toLowerCase().includes(wordLower) ||
          s.displayText.toLowerCase().includes(wordLower)
        );
      }
      return (
        s.text.toLowerCase().includes(wordLower) ||
        s.displayText.toLowerCase().includes(wordLower) ||
        (s.description && s.description.toLowerCase().includes(wordLower))
      );
    });

    // Rank and sort filtered suggestions to prioritize exact matches, prefix matches, and local definitions
    const ranked = filtered.map((s) => {
      const textL = s.text.toLowerCase();
      const displayL = s.displayText.toLowerCase();
      const descL = s.description?.toLowerCase() ?? "";

      let score = 0;
      if (textL === wordLower || displayL === wordLower) {
        score = 4; // Exact match
      } else if (textL.startsWith(wordLower) || displayL.startsWith(wordLower)) {
        score = 3; // Prefix match
      } else if (textL.includes(wordLower) || displayL.includes(wordLower)) {
        score = 2; // Substring match
      } else if (descL.includes(wordLower)) {
        score = 1; // Description-only match
      }

      // If scores are equal, prioritize local suggestions over global ones
      const localBonus = s.isLocal ? 0.5 : 0;

      return { s, finalScore: score + localBonus };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);
    const sortedSuggestions = ranked.map((r) => r.s);

    const options = sortedSuggestions.map((s) => {
      return {
        label: s.displayText,
        displayLabel: s.displayText,
        type: mapTypeToCm6Type(s.type),
        detail: s.description,
        apply: (view: EditorView, completion: any, from: number, to: number) => {
          let replacement = s.text;
          let replaceFrom = word.from;

          if (contextString.includes(".")) {
            const sugLower = s.text.toLowerCase();
            const index = sugLower.indexOf(wordLower);
            if (index !== -1) {
              replacement = s.text.slice(index);
            } else {
              const parts = contextString.split(".");
              let matched = false;
              for (let i = 0; i < parts.length; i++) {
                const subContext = parts.slice(i).join(".");
                if (!subContext) continue;
                const subIndex = sugLower.indexOf(subContext.toLowerCase());
                if (subIndex !== -1) {
                  replacement = s.text.slice(subIndex);
                  replaceFrom = to - subContext.length;
                  matched = true;
                  break;
                }
              }
            }
          }

          let adjustedOffset = s.cursorOffset;
          if (s.cursorOffset !== undefined) {
            const indexInS = s.text.indexOf(replacement);
            adjustedOffset = indexInS !== -1 ? s.cursorOffset - indexInS : s.cursorOffset;
          }

          view.dispatch({
            changes: { from: replaceFrom, to, insert: replacement },
            selection: adjustedOffset !== undefined && adjustedOffset >= 0 && adjustedOffset <= replacement.length ? {
              anchor: replaceFrom + adjustedOffset,
              head: replaceFrom + adjustedOffset
            } : undefined
          });
        }
      };
    });

    return {
      from: word.from,
      options,
      filter: false, // Tell CodeMirror 6 to trust our filtered matches
    };
  }
}

function mapTypeToCm6Type(type: string): string {
  if (type === "function") return "function";
  if (type === "keyword") return "keyword";
  if (type === "class") return "class";
  if (type === "snippet") return "text";
  if (type === "variable") return "variable";
  return "variable";
}

interface Suggestion {
  text: string;
  displayText: string;
  description?: string;
  type: "keyword" | "function" | "class" | "snippet" | "variable";
  cursorOffset?: number;
  isLocal?: boolean;
}

const CODE_SUGGESTIONS: Suggestion[] = [
  // Core ScaFi Constructs
  { text: 'rep() { self => \n  \n}', displayText: 'rep(init)(f)', description: 'State evolution over ticks', type: 'snippet', cursorOffset: 4 },
  { text: 'rep(0) { accum => \n  \n}', displayText: 'rep(0) { accum => ... }', description: 'State evolution initialized to 0', type: 'snippet', cursorOffset: 20 },
  { text: 'nbr()', displayText: 'nbr(expr)', description: 'Neighborhood field creation', type: 'function', cursorOffset: 4 },
  { text: 'mux() {  } {  }', displayText: 'mux(cond)(then)(else)', description: 'Conditional branch (evaluates both)', type: 'snippet', cursorOffset: 4 },
  { text: 'branch() {  } {  }', displayText: 'branch(cond)(then)(else)', description: 'Domain partition (evaluates active only)', type: 'snippet', cursorOffset: 7 },
  { text: 'foldhood()((a, b) => a + b)()', displayText: 'foldhood(init)(accum)(expr)', description: 'Neighborhood aggregation including self', type: 'snippet', cursorOffset: 9 },
  { text: 'foldhood(0)(_ + _) { (acc, nbr) => \n  \n}', displayText: 'foldhood(0)(_ + _) { (acc, nbr) => ... }', description: 'Neighborhood aggregation with (acc, nbr) accumulator', type: 'snippet', cursorOffset: 36 },
  { text: 'foldhoodPlus()((a, b) => a + b)()', displayText: 'foldhoodPlus(init)(accum)(expr)', description: 'Neighborhood aggregation excluding self', type: 'snippet', cursorOffset: 13 },
  { text: 'minHood()', displayText: 'minHood(expr)', description: 'Minimum value in neighborhood including self', type: 'function', cursorOffset: 8 },
  { text: 'minHoodPlus()', displayText: 'minHoodPlus(expr)', description: 'Minimum value in neighborhood excluding self', type: 'function', cursorOffset: 12 },
  { text: 'anyHood()', displayText: 'anyHood(expr)', description: 'Check if any neighbor satisfies condition', type: 'function', cursorOffset: 8 },
  { text: 'everyHood()', displayText: 'everyHood(expr)', description: 'Check if all neighbors satisfy condition', type: 'function', cursorOffset: 10 },
  { text: 'sumHood()', displayText: 'sumHood(expr)', description: 'Sum neighborhood values including self', type: 'function', cursorOffset: 8 },
  { text: 'meanHood()', displayText: 'meanHood(expr)', description: 'Average neighborhood value including self', type: 'function', cursorOffset: 9 },
  { text: 'maxHood()', displayText: 'maxHood(expr)', description: 'Maximum value in neighborhood including self', type: 'function', cursorOffset: 8 },
  { text: 'share() { self => \n  \n}', displayText: 'share(init)(f)', description: 'Shares and evolves field with neighbors', type: 'snippet', cursorOffset: 6 },
  { text: 'share(0) { self => \n  \n}', displayText: 'share(0) { self => ... }', description: 'Shares and evolves field with neighbors initialized to 0', type: 'snippet', cursorOffset: 21 },
  { text: 'align()()', displayText: 'align(key)(expr)', description: 'Align execution of expression by key', type: 'snippet', cursorOffset: 6 },

  // Builtins & Sensors
  { text: 'mid()', displayText: 'mid()', description: 'Get local device ID', type: 'function', cursorOffset: 5 },
  { text: 'sense[Boolean]("")', displayText: 'sense[Type](name)', description: 'Read local sensor value', type: 'snippet', cursorOffset: 15 },
  { text: 'nbrRange', displayText: 'nbrRange', description: 'Distance to neighbor', type: 'variable' },
  { text: 'nbrDelay', displayText: 'nbrDelay', description: 'Message delay from neighbor', type: 'variable' },
  { text: 'nbrVector', displayText: 'nbrVector', description: 'Direction vector to neighbor', type: 'variable' },

  // Blocks / Libraries
  { text: 'S(200, nbrRange)', displayText: 'S(grain, range)', description: 'Leader election (Block S)', type: 'function', cursorOffset: 2 },
  { text: 'G2()()(nbrRange)', displayText: 'G2(source)(init)(metric)(accum)', description: 'Gradient spread (Block G)', type: 'snippet', cursorOffset: 3 },
  { text: 'distanceTo()', displayText: 'distanceTo(source)', description: 'Calculate distance to a source node', type: 'function', cursorOffset: 11 },
  { text: 'distanceBetween()', displayText: 'distanceBetween(source, target)', description: 'Calculate distance between two nodes', type: 'function', cursorOffset: 16 },
  { text: 'broadcast(, )', displayText: 'broadcast(source, value)', description: 'Broadcast value from source along gradient', type: 'function', cursorOffset: 10 },
  { text: 'C[Double, Double](, _ + _, , 0)', displayText: 'C[P, T](pot, accum, local, null)', description: 'Collect data towards source (Block C)', type: 'snippet', cursorOffset: 17 },
  { text: 'gradientCast()()()', displayText: 'gradientCast(source)(value)(metric)', description: 'Cast value along gradient', type: 'snippet', cursorOffset: 13 },
  { text: 'collectCast()()()', displayText: 'collectCast(source)(value)(metric)', description: 'Collect and cast logic', type: 'snippet', cursorOffset: 12 },

  // Math & Geometry
  { text: 'math.sin()', displayText: 'math.sin(x)', description: 'Sine of x (radians)', type: 'function', cursorOffset: 9 },
  { text: 'math.cos()', displayText: 'math.cos(x)', description: 'Cosine of x (radians)', type: 'function', cursorOffset: 9 },
  { text: 'math.tan()', displayText: 'math.tan(x)', description: 'Tangent of x (radians)', type: 'function', cursorOffset: 9 },
  { text: 'math.atan2(, )', displayText: 'math.atan2(y, x)', description: 'Arctangent of y/x', type: 'function', cursorOffset: 11 },
  { text: 'math.sqrt()', displayText: 'math.sqrt(x)', description: 'Square root of x', type: 'function', cursorOffset: 10 },
  { text: 'math.hypot(, )', displayText: 'math.hypot(x, y)', description: 'Hypotenuse length', type: 'function', cursorOffset: 11 },
  { text: 'math.abs()', displayText: 'math.abs(x)', description: 'Absolute value of x', type: 'function', cursorOffset: 9 },
  { text: 'math.pow(, )', displayText: 'math.pow(x, y)', description: 'x raised to power of y', type: 'function', cursorOffset: 9 },
  { text: 'math.exp()', displayText: 'math.exp(x)', description: 'Euler number raised to power of x', type: 'function', cursorOffset: 9 },
  { text: 'math.log()', displayText: 'math.log(x)', description: 'Natural logarithm of x', type: 'function', cursorOffset: 9 },
  { text: 'math.min(, )', displayText: 'math.min(a, b)', description: 'Minimum of two values', type: 'function', cursorOffset: 9 },
  { text: 'math.max(, )', displayText: 'math.max(a, b)', description: 'Maximum of two values', type: 'function', cursorOffset: 9 },
  { text: 'math.Pi', displayText: 'math.Pi', description: 'Mathematical constant Pi (3.14159)', type: 'variable' },
  { text: 'math.E', displayText: 'math.E', description: 'Mathematical constant E (2.71828)', type: 'variable' },
  { text: 'Point2D(, )', displayText: 'Point2D(x, y)', description: 'Create 2D point or vector', type: 'class', cursorOffset: 8 },

  // Scala Keywords & Basic Constructs
  { text: 'val  = ', displayText: 'val x = ...', description: 'Immutable value declaration', type: 'keyword', cursorOffset: 4 },
  { text: 'var  = ', displayText: 'var x = ...', description: 'Mutable variable declaration', type: 'keyword', cursorOffset: 4 },
  { text: 'def (args): Type = ', displayText: 'def f(x) = ...', description: 'Method definition', type: 'keyword', cursorOffset: 4 },
  { text: 'if ()  else ', displayText: 'if (cond) else', description: 'Conditional expression', type: 'keyword', cursorOffset: 4 },
  { text: ' match {\n  case  => \n}', displayText: 'expr match { case ... }', description: 'Pattern matching block', type: 'keyword', cursorOffset: 0 },
  { text: 'import ', displayText: 'import ...', description: 'Import library or package', type: 'keyword', cursorOffset: 7 },
  { text: 'object ', displayText: 'object ...', description: 'Singleton object definition', type: 'keyword', cursorOffset: 7 },
  { text: 'class ', displayText: 'class ...', description: 'Class definition', type: 'keyword', cursorOffset: 6 },
  { text: 'trait ', displayText: 'trait ...', description: 'Trait definition', type: 'keyword', cursorOffset: 6 },
  { text: 'override def ', displayText: 'override def ...', description: 'Override method modifier', type: 'keyword', cursorOffset: 13 },
  { text: 'Option[]', displayText: 'Option[T]', description: 'Optional value wrapper', type: 'class', cursorOffset: 7 },
  { text: 'Some()', displayText: 'Some(x)', description: 'Existing option value', type: 'class', cursorOffset: 5 },
  { text: 'None', displayText: 'None', description: 'Empty option value', type: 'variable' },
  { text: 'List()', displayText: 'List(args)', description: 'Immutable List creation', type: 'class', cursorOffset: 5 },
  { text: 'Seq()', displayText: 'Seq(args)', description: 'Immutable sequence creation', type: 'class', cursorOffset: 4 },
  { text: 'Map()', displayText: 'Map(k -> v)', description: 'Key-value Map creation', type: 'class', cursorOffset: 4 },

  // Actuation / Matrix (ScaFi-Web specifics)
  { text: 'ledAll to ', displayText: 'ledAll to color', description: 'Set all matrix LEDs to color', type: 'snippet', cursorOffset: 10 },
  { text: 'led(, ) to ', displayText: 'led(row, col) to color', description: 'Set specific LED to color', type: 'snippet', cursorOffset: 4 },
  { text: 'ledRow() to ', displayText: 'ledRow(row) to color', description: 'Set row of LEDs to color', type: 'snippet', cursorOffset: 7 },
  { text: 'ledCol() to ', displayText: 'ledCol(col) to color', description: 'Set column of LEDs to color', type: 'snippet', cursorOffset: 7 },
  { text: 'ledX to ', displayText: 'ledX to color', description: 'Set diagonal matrix LEDs (X shape)', type: 'snippet', cursorOffset: 8 },
  { text: 'ledO to ', displayText: 'ledO to color', description: 'Set outer border matrix LEDs (O shape)', type: 'snippet', cursorOffset: 8 },
  { text: 'ledD to ', displayText: 'ledD to color', description: 'Set main diagonal matrix LEDs (D shape)', type: 'snippet', cursorOffset: 8 },
  { text: 'ledAD to ', displayText: 'ledAD to color', description: 'Set anti-diagonal matrix LEDs', type: 'snippet', cursorOffset: 9 },
  { text: 'off', displayText: 'off', description: 'Turn off LED (black)', type: 'variable' },
  { text: 'on', displayText: 'on', description: 'Turn on LED (white)', type: 'variable' },
  { text: 'hsl(, 0.5, 0.5)', displayText: 'hsl(h, s, l)', description: 'Create color from HSL values', type: 'function', cursorOffset: 4 },
  { text: 'rgb(, , )', displayText: 'rgb(r, g, b)', description: 'Create color from RGB values', type: 'function', cursorOffset: 4 },
  { text: 'hue()', displayText: 'hue(h)', description: 'Create HSL color with default saturation/lightness', type: 'function', cursorOffset: 4 },

  // Movement & Spatial APIs
  { text: 'goToPoint(, )', displayText: 'goToPoint(x, y, speed)', description: 'Move towards point', type: 'function', cursorOffset: 10 },
  { text: 'explore(, 50)', displayText: 'explore(zone, time, range, speed)', description: 'Explore zone randomly', type: 'snippet', cursorOffset: 8 },
  { text: 'clockwiseRotation(, 100)', displayText: 'clockwiseRotation(center, speed)', description: 'Rotate clockwise around center', type: 'function', cursorOffset: 18 },
  { text: 'anticlockwiseRotation(, 100)', displayText: 'anticlockwiseRotation(center, speed)', description: 'Rotate counter-clockwise around center', type: 'function', cursorOffset: 22 },
  { text: 'standStill', displayText: 'standStill', description: 'Stop moving', type: 'variable' },
  { text: 'currentPosition', displayText: 'currentPosition', description: 'Get local device Point2D coordinates', type: 'variable' },
  { text: 'velocity', displayText: 'velocity', description: 'Get local device speed/heading Point2D vector', type: 'variable' },
  { text: 'velocity.set()', displayText: 'velocity.set(component)', description: 'Set target movement velocity', type: 'function', cursorOffset: 13 },
  { text: 'position.set()', displayText: 'position.set(coords)', description: 'Set target position directly', type: 'function', cursorOffset: 13 },
  { text: 'Polar(, )', displayText: 'Polar(module, angle)', description: 'Define velocity component via polar coordinates', type: 'class', cursorOffset: 6 },
  { text: 'Cartesian(, )', displayText: 'Cartesian(dx, dy)', description: 'Define velocity component via Cartesian coordinates', type: 'class', cursorOffset: 10 },
  { text: 'CircularZone((, ), )', displayText: 'CircularZone(center, radius)', description: 'Define a circular exploration zone', type: 'class', cursorOffset: 14 },
  { text: 'RectangularZone((, ), , )', displayText: 'RectangularZone(center, width, height)', description: 'Define a rectangular exploration zone', type: 'class', cursorOffset: 17 },
];

const WORLD_SUGGESTIONS: Suggestion[] = [
  { text: 'grid(rows = 10, cols = 10, stepX = 60, stepY = 60, tolerance = 10)', displayText: 'grid(rows, cols, ...)', description: 'Generate a grid network layout', type: 'function', cursorOffset: 5 },
  { text: 'random(min = 0, max = 500, howMany = 50)', displayText: 'random(min, max, howMany)', description: 'Generate a random network layout', type: 'function', cursorOffset: 7 },
  { text: 'radius(70)', displayText: 'radius(range)', description: 'Set neighbor communication range', type: 'function', cursorOffset: 7 },
  { text: 'matrix(3, "#bb86fc")', displayText: 'matrix(dimension, color)', description: 'Initialize local LED matrix on all nodes', type: 'function', cursorOffset: 7 },
  { text: 'sensor("", )', displayText: 'sensor(name, value)', description: 'Set global sensor value', type: 'function', cursorOffset: 8 },
  { text: 'initial("", "", )', displayText: 'initial(nodeId, sensorName, value)', description: 'Set node-specific sensor value', type: 'function', cursorOffset: 9 },
  { text: 'position("", , )', displayText: 'position(nodeId, x, y)', description: 'Set node absolute position', type: 'function', cursorOffset: 10 },
  { text: 'uniform(, )', displayText: 'uniform(min, max)', description: 'Generate a uniform distribution helper', type: 'function', cursorOffset: 8 },
  { text: 'exponential()', displayText: 'exponential(mean)', description: 'Generate an exponential distribution helper', type: 'function', cursorOffset: 12 },
  { text: 'normal(, )', displayText: 'normal(mean, stdDev)', description: 'Generate a normal distribution helper', type: 'function', cursorOffset: 7 },
  { text: 'line(length = 10, step = 50)', displayText: 'line(length, step)', description: 'Generate nodes in a straight line', type: 'function', cursorOffset: 5 },
  { text: 'ring(nodes = 10, radius = 100)', displayText: 'ring(nodes, radius)', description: 'Generate nodes in a circular ring', type: 'function', cursorOffset: 5 },
  { text: 'clique(nodes = 10)', displayText: 'clique(nodes)', description: 'Generate nodes in fully-connected layout', type: 'function', cursorOffset: 7 },
  { text: 'obstacle(x = 0, y = 0, width = 50, height = 50)', displayText: 'obstacle(x, y, w, h)', description: 'Define spatial layout bounds/obstacle', type: 'function', cursorOffset: 9 },
];

const RENDERER_SUGGESTIONS: Suggestion[] = [
  // Context variables
  { text: 'graph', displayText: 'graph', description: 'Network graph snapshot containing nodes and edges', type: 'variable' },
  { text: 'defaults', displayText: 'defaults', description: 'Default visualization settings', type: 'variable' },
  { text: 'selectedNodeIds', displayText: 'selectedNodeIds', description: 'Array of currently selected node IDs', type: 'variable' },
  { text: 'availableSensors', displayText: 'availableSensors', description: 'Array of sensors present in the simulation', type: 'variable' },
  { text: 'execution', displayText: 'execution', description: 'Simulation execution engine state', type: 'variable' },

  // RendererKit composition
  { text: 'RendererKit.composeNode(context, )', displayText: 'RendererKit.composeNode(context, ...parts)', description: 'Compose multiple node rendering behaviors', type: 'function', cursorOffset: 32 },
  { text: 'RendererKit.composeEdge(context, )', displayText: 'RendererKit.composeEdge(context, ...parts)', description: 'Compose multiple edge rendering behaviors', type: 'function', cursorOffset: 32 },

  // RendererKit node plugins
  { text: 'RendererKit.node.matrix()', displayText: 'RendererKit.node.matrix()', description: 'Enable LED matrix visualization on nodes', type: 'function', cursorOffset: 25 },
  { text: 'RendererKit.node.selectedRing()', displayText: 'RendererKit.node.selectedRing(options)', description: 'Draw a ring around selected nodes', type: 'function', cursorOffset: 31 },
  { text: 'RendererKit.node.exportText()', displayText: 'RendererKit.node.exportText(options)', description: 'Display node export value as label', type: 'function', cursorOffset: 29 },
  { text: 'RendererKit.node.sensorDot("")', displayText: 'RendererKit.node.sensorDot(sensor, options)', description: 'Display a dot when a sensor is active', type: 'snippet', cursorOffset: 28 },
  { text: 'RendererKit.node.booleans()', displayText: 'RendererKit.node.booleans()', description: 'Enable boolean status indicators', type: 'function', cursorOffset: 27 },
  { text: 'RendererKit.node.gradient()', displayText: 'RendererKit.node.gradient()', description: 'Enable gradient-based colors', type: 'function', cursorOffset: 27 },
  { text: 'RendererKit.node.exportEffect()', displayText: 'RendererKit.node.exportEffect()', description: 'Show ripple effects on value exports', type: 'function', cursorOffset: 31 },
  { text: 'RendererKit.node.velocityArrow()', displayText: 'RendererKit.node.velocityArrow(options)', description: 'Draw motion vector arrows', type: 'function', cursorOffset: 32 },
  { text: 'RendererKit.node.sizeRange(0, 100, 5, 20, "export")', displayText: 'RendererKit.node.sizeRange(minIn, maxIn, minOut, maxOut, label)', description: 'Map a value range to node sizes', type: 'function', cursorOffset: 27 },
  { text: 'RendererKit.node.custom(ctx => {\n  \n})', displayText: 'RendererKit.node.custom(ctx => ...)', description: 'Create completely customized draw routine', type: 'snippet', cursorOffset: 25 },

  // RendererKit edge plugins
  { text: 'RendererKit.edge.highlightNeighborhood(0.6)', displayText: 'RendererKit.edge.highlightNeighborhood(widthDelta)', description: 'Thicken edge connections in neighborhood', type: 'function', cursorOffset: 39 },
  { text: 'RendererKit.edge.muteNonNeighborhood(0.24)', displayText: 'RendererKit.edge.muteNonNeighborhood(opacity)', description: 'Dim or hide non-neighborhood connections', type: 'function', cursorOffset: 36 },
  { text: 'RendererKit.edge.custom(ctx => {\n  \n})', displayText: 'RendererKit.edge.custom(ctx => ...)', description: 'Create completely customized edge routine', type: 'snippet', cursorOffset: 25 },

  // Raw HTML Canvas API for custom routines
  { text: 'ctx.beginPath()', displayText: 'ctx.beginPath()', description: 'Start a new drawing path', type: 'function', cursorOffset: 14 },
  { text: 'ctx.arc(, , , 0, 2 * Math.PI)', displayText: 'ctx.arc(x, y, r, sAngle, eAngle)', description: 'Add circular arc to path', type: 'function', cursorOffset: 8 },
  { text: 'ctx.fill()', displayText: 'ctx.fill()', description: 'Fill the current path geometry', type: 'function', cursorOffset: 10 },
  { text: 'ctx.stroke()', displayText: 'ctx.stroke()', description: 'Stroke the current path boundaries', type: 'function', cursorOffset: 12 },
  { text: 'ctx.fillStyle = ""', displayText: 'ctx.fillStyle = color', description: 'Set fill style/color', type: 'variable', cursorOffset: 16 },
  { text: 'ctx.strokeStyle = ""', displayText: 'ctx.strokeStyle = color', description: 'Set stroke style/color', type: 'variable', cursorOffset: 18 },
  { text: 'ctx.lineWidth = ', displayText: 'ctx.lineWidth = width', description: 'Set stroke outline width', type: 'variable', cursorOffset: 16 },
  { text: 'ctx.font = ""', displayText: 'ctx.font = description', description: 'Set font size/family details', type: 'variable', cursorOffset: 12 },
  { text: 'ctx.fillText("", , )', displayText: 'ctx.fillText(text, x, y)', description: 'Draw text characters', type: 'function', cursorOffset: 13 },
];

function extractLocalSuggestions(code: string, tab: PlaygroundDocument): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lines = code.split("\n");
  const seen = new Set<string>();

  const addSuggestion = (name: string, type: Suggestion["type"], text?: string, desc?: string, offset?: number) => {
    if (seen.has(name)) return;
    seen.add(name);
    suggestions.push({
      text: text ?? name,
      displayText: name,
      description: desc ?? `Local ${type} defined in file`,
      type,
      cursorOffset: offset,
      isLocal: true,
    });
  };

  if (tab === "code" || tab === "world") {
    // Scala parsing regexes
    const defRegex = /\bdef\s+([a-zA-Z0-9$_]+)\s*(\([^)]*\))?/g;
    const valRegex = /\bval\s+([a-zA-Z0-9$_]+)\b/g;
    const varRegex = /\bvar\s+([a-zA-Z0-9$_]+)\b/g;
    const classRegex = /\bclass\s+([a-zA-Z0-9$_]+)\b/g;
    const objectRegex = /\bobject\s+([a-zA-Z0-9$_]+)\b/g;
    const traitRegex = /\btrait\s+([a-zA-Z0-9$_]+)\b/g;
    const parenLambdaRegex = /\(\s*([a-zA-Z0-9$_\s,:]+)\s*\)\s*=>/g;
    const singleLambdaRegex = /\b([a-zA-Z0-9$_]+)\s*=>/g;

    const SCALA_KEYWORDS = new Set([
      "abstract", "case", "catch", "class", "def", "do", "else", "extends",
      "false", "final", "finally", "for", "forSome", "if", "implicit", "import",
      "lazy", "match", "new", "null", "object", "override", "package", "private",
      "protected", "return", "sealed", "super", "this", "throw", "trait", "true",
      "try", "type", "val", "var", "while", "with", "yield"
    ]);

    for (const line of lines) {
      let match;

      // def
      defRegex.lastIndex = 0;
      while ((match = defRegex.exec(line)) !== null) {
        const name = match[1];
        if (name === "main") continue;
        const params = match[2] ?? "()";
        addSuggestion(name, "function", `${name}${params}`, `Local method: def ${name}${params}`, name.length + 1);
      }

      // val
      valRegex.lastIndex = 0;
      while ((match = valRegex.exec(line)) !== null) {
        const name = match[1];
        if (SCALA_KEYWORDS.has(name)) continue;
        addSuggestion(name, "variable", name, `Local immutable value: val ${name}`);
      }

      // var
      varRegex.lastIndex = 0;
      while ((match = varRegex.exec(line)) !== null) {
        const name = match[1];
        if (SCALA_KEYWORDS.has(name)) continue;
        addSuggestion(name, "variable", name, `Local mutable variable: var ${name}`);
      }

      // class
      classRegex.lastIndex = 0;
      while ((match = classRegex.exec(line)) !== null) {
        const name = match[1];
        if (SCALA_KEYWORDS.has(name)) continue;
        addSuggestion(name, "class", name, `Local class: class ${name}`);
      }

      // object
      objectRegex.lastIndex = 0;
      while ((match = objectRegex.exec(line)) !== null) {
        const name = match[1];
        if (SCALA_KEYWORDS.has(name)) continue;
        addSuggestion(name, "class", name, `Local object: object ${name}`);
      }

      // trait
      traitRegex.lastIndex = 0;
      while ((match = traitRegex.exec(line)) !== null) {
        const name = match[1];
        if (SCALA_KEYWORDS.has(name)) continue;
        addSuggestion(name, "class", name, `Local trait: trait ${name}`);
      }

      // parenthesized lambda: e.g. (acc, nbr) => or (acc: Double, nbr: Double) =>
      parenLambdaRegex.lastIndex = 0;
      while ((match = parenLambdaRegex.exec(line)) !== null) {
        const lineBefore = line.slice(0, match.index).trim();
        // Skip case matching branches
        if (lineBefore.endsWith("case") || /\bcase\s+[a-zA-Z0-9$_().\s]*$/.test(lineBefore)) {
          continue;
        }
        const paramsStr = match[1];
        const params = paramsStr.split(",").map(p => p.trim());
        for (const param of params) {
          const cleanParam = param.split(":")[0].trim();
          if (cleanParam === "_") continue;
          if (/^[a-zA-Z0-9$_]+$/.test(cleanParam)) {
            if (!SCALA_KEYWORDS.has(cleanParam)) {
              addSuggestion(cleanParam, "variable", cleanParam, `Lambda parameter: ${cleanParam}`);
            }
          }
        }
      }

      // single lambda: e.g. self =>
      singleLambdaRegex.lastIndex = 0;
      while ((match = singleLambdaRegex.exec(line)) !== null) {
        const lineBefore = line.slice(0, match.index).trim();
        // Skip case matching branches
        if (lineBefore.endsWith("case") || /\bcase\s+[a-zA-Z0-9$_().\s]*$/.test(lineBefore)) {
          continue;
        }
        const param = match[1];
        if (param === "_") continue;
        if (!SCALA_KEYWORDS.has(param)) {
          addSuggestion(param, "variable", param, `Lambda parameter: ${param}`);
        }
      }
    }
  } else if (tab === "renderer") {
    // JS/TS parsing regexes
    const jsFunctionRegex = /\bfunction\s+([a-zA-Z0-9$_]+)\s*(\([^)]*\))?/g;
    const jsConstRegex = /\b(?:const|let|var)\s+([a-zA-Z0-9$_]+)\b/g;

    for (const line of lines) {
      let match;

      // function
      jsFunctionRegex.lastIndex = 0;
      while ((match = jsFunctionRegex.exec(line)) !== null) {
        const name = match[1];
        const params = match[2] ?? "()";
        addSuggestion(name, "function", `${name}${params}`, `Local function: ${name}${params}`, name.length + 1);
      }

      // const/let/var
      jsConstRegex.lastIndex = 0;
      while ((match = jsConstRegex.exec(line)) !== null) {
        const name = match[1];
        addSuggestion(name, "variable", name, `Local variable: ${name}`);
      }
    }
  }

  return suggestions;
}

function cleanExtensionsRecursive(ext: any): any {
  if (ext === undefined || ext === null) {
    return null;
  }
  if (Array.isArray(ext)) {
    return ext
      .map(cleanExtensionsRecursive)
      .filter((x) => x !== null && x !== undefined);
  }
  return ext;
}

