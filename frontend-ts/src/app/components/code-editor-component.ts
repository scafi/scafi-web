import CodeMirror from "codemirror";
import type { EditorFromTextArea } from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/hint/show-hint";
import "codemirror/mode/clike/clike";
import "codemirror/mode/javascript/javascript";
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

export class CodeEditorComponent {
  private codeEditor?: EditorFromTextArea;
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

  private callbacks: CodeEditorCallbacks = {};

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {}

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
    const textArea = this.root.querySelector<HTMLTextAreaElement>("#code-editor");
    if (!textArea) {
      return;
    }
    const editor = CodeMirror.fromTextArea(textArea, {
      lineNumbers: true,
      mode: codeMirrorMode(this.activePlaygroundDocument, this.activeEditorMode),
      theme: theme === "dark" ? "material" : "default",
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      readOnly: this.activePlaygroundDocument === "compiled" ? "nocursor" : false,
      extraKeys: {
        "Ctrl-Space": "autocomplete",
      },
    });
    // @ts-ignore
    editor.setOption("hint", (cmInstance: any) => this.provideHints(cmInstance));

    editor.setSize("100%", "100%");
    editor.on("change", (instance) => {
      const currentValue = instance.getValue();
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
    });

    editor.on("inputRead", (cm, change) => {
      if (this.activePlaygroundDocument === "compiled") {
        return;
      }
      const typedChar = change.text[0];
      if (typedChar && /^[a-zA-Z0-9$_.]$/.test(typedChar)) {
        // @ts-ignore
        if (!cm.state.completionActive) {
          // @ts-ignore
          cm.showHint({
            completeSingle: false,
          });
        }
      }
    });

    this.codeEditor = editor;
    this.mountedDocument = this.activePlaygroundDocument;
    this.mountedEditorMode = this.activeEditorMode;
  }

  destroyCodeEditor(): void {
    if (!this.codeEditor) {
      return;
    }
    const mountedDocument = this.mountedDocument ?? this.activePlaygroundDocument;
    if (mountedDocument === "world") {
      this.worldDocument = this.codeEditor.getValue();
      this.app.saveWorldDocument(this.worldDocument);
      this.codeEditor.toTextArea();
      this.codeEditor = undefined;
      this.mountedDocument = undefined;
      this.mountedEditorMode = undefined;
      return;
    }
    if (mountedDocument === "renderer") {
      this.rendererDocument = this.codeEditor.getValue();
      this.app.saveRendererDocument(this.rendererDocument);
      this.codeEditor.toTextArea();
      this.codeEditor = undefined;
      this.mountedDocument = undefined;
      this.mountedEditorMode = undefined;
      return;
    }
    if (mountedDocument === "compiled") {
      this.codeEditor.toTextArea();
      this.codeEditor = undefined;
      this.mountedDocument = undefined;
      this.mountedEditorMode = undefined;
      return;
    }
    const mountedMode = this.mountedEditorMode ?? this.activeEditorMode;
    this.setBufferForMode(mountedMode, this.codeEditor.getValue());
    this.editorDocument = {
      code: this.getBufferForMode(this.activeEditorMode),
      mode: this.activeEditorMode,
    };
    this.codeEditor.toTextArea();
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

  private provideHints(editor: any): any {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const precedingText = line.slice(0, cursor.ch);

    // Get the trailing identifier-like sequence (including dots)
    const match = precedingText.match(/[a-zA-Z0-9$_.]*$/);
    const contextString = match ? match[0] : "";

    let suggestions: Suggestion[] = [];
    if (this.activePlaygroundDocument === "code") {
      suggestions = CODE_SUGGESTIONS;
    } else if (this.activePlaygroundDocument === "world") {
      suggestions = WORLD_SUGGESTIONS;
    } else if (this.activePlaygroundDocument === "renderer") {
      suggestions = RENDERER_SUGGESTIONS;
    } else {
      return undefined;
    }

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

    if (filtered.length === 0) {
      return undefined;
    }

    return {
      list: filtered.map((s) => {
        let replacement = s.text;
        let fromCh = cursor.ch;

        if (contextString) {
          const sugLower = s.text.toLowerCase();

          if (wordLower.includes(".")) {
            // Dotted path completion: we can slice to align on sub-paths
            const index = sugLower.indexOf(wordLower);
            if (index !== -1) {
              replacement = s.text.slice(index);
              fromCh = cursor.ch - contextString.length;
            } else {
              // Try suffixes of contextString by splitting at dots
              const parts = contextString.split(".");
              let matched = false;
              for (let i = 0; i < parts.length; i++) {
                const subContext = parts.slice(i).join(".");
                if (!subContext) continue;
                const subIndex = sugLower.indexOf(subContext.toLowerCase());
                if (subIndex !== -1) {
                  replacement = s.text.slice(subIndex);
                  fromCh = cursor.ch - subContext.length;
                  matched = true;
                  break;
                }
              }
              if (!matched) {
                // If no dot-separated part matched, replace entire contextString with suggestion
                replacement = s.text;
                fromCh = cursor.ch - contextString.length;
              }
            }
          } else {
            // Simple word completion without dots: replace entire contextString with full suggestion
            replacement = s.text;
            fromCh = cursor.ch - contextString.length;
          }
        }

        const from = CodeMirror.Pos(cursor.line, fromCh);
        const to = cursor;

        return {
          text: replacement,
          displayText: s.displayText,
          render: (element: HTMLLIElement) => {
            element.className = `cm-hint-item hint-type-${s.type}`;

            const iconSpan = document.createElement("span");
            iconSpan.className = `hint-icon icon-${s.type}`;
            let iconText = "ƒ";
            if (s.type === "keyword") iconText = "k";
            else if (s.type === "class") iconText = "c";
            else if (s.type === "snippet") iconText = "⬚";
            else if (s.type === "variable") iconText = "v";
            iconSpan.textContent = iconText;
            element.appendChild(iconSpan);

            const textSpan = document.createElement("span");
            textSpan.className = "hint-name";
            textSpan.textContent = s.displayText;
            element.appendChild(textSpan);

            if (s.description) {
              const descSpan = document.createElement("span");
              descSpan.className = "hint-desc";
              descSpan.textContent = ` — ${s.description}`;
              element.appendChild(descSpan);
            }
          },
          hint: (cm: any) => {
            cm.replaceRange(replacement, from, to);
            if (s.cursorOffset !== undefined) {
              const indexInS = s.text.indexOf(replacement);
              const adjustedOffset = indexInS !== -1 ? s.cursorOffset - indexInS : s.cursorOffset;
              if (adjustedOffset >= 0 && adjustedOffset <= replacement.length) {
                cm.setCursor(CodeMirror.Pos(from.line, from.ch + adjustedOffset));
              }
            }
          },
        };
      }),
      from: CodeMirror.Pos(cursor.line, cursor.ch - contextString.length),
      to: cursor,
    };
  }
}

interface Suggestion {
  text: string;
  displayText: string;
  description?: string;
  type: "keyword" | "function" | "class" | "snippet" | "variable";
  cursorOffset?: number;
}

const CODE_SUGGESTIONS: Suggestion[] = [
  // Core ScaFi Constructs
  { text: 'rep() { self => \n  \n}', displayText: 'rep(init)(f)', description: 'State evolution over ticks', type: 'snippet', cursorOffset: 4 },
  { text: 'nbr()', displayText: 'nbr(expr)', description: 'Neighborhood field creation', type: 'function', cursorOffset: 4 },
  { text: 'mux() {  } {  }', displayText: 'mux(cond)(then)(else)', description: 'Conditional branch (evaluates both)', type: 'snippet', cursorOffset: 4 },
  { text: 'branch() {  } {  }', displayText: 'branch(cond)(then)(else)', description: 'Domain partition (evaluates active only)', type: 'snippet', cursorOffset: 7 },
  { text: 'foldhood()((a, b) => a + b)()', displayText: 'foldhood(init)(accum)(expr)', description: 'Neighborhood aggregation including self', type: 'snippet', cursorOffset: 9 },
  { text: 'foldhoodPlus()((a, b) => a + b)()', displayText: 'foldhoodPlus(init)(accum)(expr)', description: 'Neighborhood aggregation excluding self', type: 'snippet', cursorOffset: 13 },
  { text: 'minHood()', displayText: 'minHood(expr)', description: 'Minimum value in neighborhood including self', type: 'function', cursorOffset: 8 },
  { text: 'minHoodPlus()', displayText: 'minHoodPlus(expr)', description: 'Minimum value in neighborhood excluding self', type: 'function', cursorOffset: 12 },
  { text: 'anyHood()', displayText: 'anyHood(expr)', description: 'Check if any neighbor satisfies condition', type: 'function', cursorOffset: 8 },
  { text: 'everyHood()', displayText: 'everyHood(expr)', description: 'Check if all neighbors satisfy condition', type: 'function', cursorOffset: 10 },
  { text: 'sumHood()', displayText: 'sumHood(expr)', description: 'Sum neighborhood values including self', type: 'function', cursorOffset: 8 },
  { text: 'meanHood()', displayText: 'meanHood(expr)', description: 'Average neighborhood value including self', type: 'function', cursorOffset: 9 },
  { text: 'maxHood()', displayText: 'maxHood(expr)', description: 'Maximum value in neighborhood including self', type: 'function', cursorOffset: 8 },

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
  { text: 'off', displayText: 'off', description: 'Turn off LED (black)', type: 'variable' },
  { text: 'on', displayText: 'on', description: 'Turn on LED (white)', type: 'variable' },
  { text: 'hsl(, 0.5, 0.5)', displayText: 'hsl(h, s, l)', description: 'Create color from HSL values', type: 'function', cursorOffset: 4 },
  { text: 'rgb(, , )', displayText: 'rgb(r, g, b)', description: 'Create color from RGB values', type: 'function', cursorOffset: 4 },
  { text: 'goToPoint(, )', displayText: 'goToPoint(x, y, speed)', description: 'Move towards point', type: 'function', cursorOffset: 10 },
  { text: 'explore(, 50)', displayText: 'explore(zone, time, range, speed)', description: 'Explore zone randomly', type: 'snippet', cursorOffset: 8 },
  { text: 'standStill', displayText: 'standStill', description: 'Stop moving', type: 'variable' },
  { text: 'currentPosition', displayText: 'currentPosition', description: 'Get local device Point2D coordinates', type: 'variable' },
  { text: 'velocity', displayText: 'velocity', description: 'Get local device speed/heading Point2D vector', type: 'variable' },
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

function codeMirrorMode(documentName: PlaygroundDocument, mode: EditorDocument["mode"]): string {
  if (documentName === "renderer") {
    return "javascript";
  }
  return "text/x-scala";
}
