import { EditorView, hoverTooltip, keymap, type Tooltip } from "@codemirror/view";
import { basicSetup } from "codemirror";

import { EditorState, StateEffect } from "@codemirror/state";
import { StreamLanguage, HighlightStyle, syntaxHighlighting, indentUnit } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { scala } from "@codemirror/legacy-modes/mode/clike";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion, snippetCompletion, startCompletion } from "@codemirror/autocomplete";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { forceLinting, linter, lintGutter, type Diagnostic } from "@codemirror/lint";

import { convertEasyScalaToFull } from "../../services/scastie/easy-scala";
import type { MetalsService } from "../../services/scastie/metals-service";
import type { WrappedSource } from "../../services/scastie/source-map";
import { WorldDocumentError, parseWorldDocument } from "../../services/config/world-document";
import {
  CODE_SUGGESTIONS,
  MIXIN_SUGGESTIONS,
  RENDERER_SUGGESTIONS,
  WORLD_SUGGESTIONS,
  extractLocalSuggestions,
  toCompletion,
} from "./completion-catalog";
import { findStructuralProblems, toEditorDiagnostics, toOffset } from "./editor-diagnostics";
import { defaultRendererDocument } from "../renderer-document";
import { defaultEditorDocument } from "../defaults";
import type {
  CompileProblem,
  EditorDocument,
  ExampleDefinition,
  SupportConfiguration,
} from "../../domain/contracts";
import type { ScafiWebApp } from "../scafi-web-app";
import { serializeWorldDocument } from "../../services/config/world-document";

export type PlaygroundDocument = "code" | "world" | "renderer" | "compiled";

/**
 * Marks a transaction as carrying new compiler messages. The lint plugin only re-runs on
 * document changes, and `forceLinting` is a no-op while it is idle, so `needsRefresh` has
 * to be told that an otherwise empty transaction invalidates the current diagnostics.
 */
const compileProblemsChanged = StateEffect.define<null>();

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
    fontFamily: "var(--font-mono)",
    lineHeight: "1.5",
  },
  ".cm-content": {
    padding: "12px 0",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent)",
  },
});

const darkThemeExtension = EditorView.theme({
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-soft) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--surface-2)",
  },
  ".cm-gutters": {
    color: "var(--text-muted)",
  },
}, { dark: true });

const lightThemeExtension = EditorView.theme({
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-soft) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--surface-2)",
  },
  ".cm-gutters": {
    color: "var(--text-muted)",
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
  private savedStates: Partial<Record<PlaygroundDocument, EditorState>> = {};
  private savedViews: Partial<Record<PlaygroundDocument, EditorView>> = {};
  private lastTheme?: "dark" | "light";
  private hadFocusBeforeDestroy = false;

  /** Absent in the embedded playground, which stays offline. */
  private metals?: MetalsService;
  private compileProblems: readonly CompileProblem[] = [];
  private readonly metalsCache = new Map<string, Completion[]>();
  private readonly metalsPending = new Set<string>();
  private compileSource?: WrappedSource;

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {}

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  /** Enables type-aware completion. Left unset in embeds so they make no network requests. */
  setMetalsService(metals: MetalsService | undefined): void {
    this.metals = metals;
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
    this.savedViews["world"]?.destroy();
    delete this.savedViews["world"];
    delete this.savedStates["world"];
  }

  setRendererDocument(doc: string): void {
    this.rendererDocument = doc;
    this.app.saveRendererDocument(doc);
    this.savedViews["renderer"]?.destroy();
    delete this.savedViews["renderer"];
    delete this.savedStates["renderer"];
  }

  loadExample(example: ExampleDefinition, exampleConfiguration: SupportConfiguration): void {
    this.destroyCodeEditor();
    for (const key in this.savedViews) {
      this.savedViews[key as PlaygroundDocument]?.destroy();
    }
    this.savedViews = {};
    this.savedStates = {};
    const mode = example.mode ?? "easy-scala";
    if (mode === "full-scala") {
      this.fullScalaBuffer = example.body;
      this.easyScalaBuffer = "";
    } else {
      this.easyScalaBuffer = example.body;
      this.fullScalaBuffer = convertEasyScalaToFull(example.body);
    }
    this.activeEditorMode = mode;
    this.editorDocument = { code: example.body, mode };
    this.worldDocument = example.world ?? serializeWorldDocument(exampleConfiguration);
    this.rendererDocument = example.renderer ?? defaultRendererDocument;
    
    this.app.saveWorldDocument(this.worldDocument);
    this.app.saveRendererDocument(this.rendererDocument);
    this.app.saveEditor(this.editorDocument);
  }

  loadSharedCode(code: string, mode: EditorDocument["mode"] = "easy-scala", world?: string, renderer?: string): void {
    this.destroyCodeEditor();
    for (const key in this.savedViews) {
      this.savedViews[key as PlaygroundDocument]?.destroy();
    }
    this.savedViews = {};
    this.savedStates = {};
    
    if (mode === "full-scala") {
      this.fullScalaBuffer = code;
      this.easyScalaBuffer = "";
    } else {
      this.easyScalaBuffer = code;
      this.fullScalaBuffer = convertEasyScalaToFull(code);
    }
    this.activeEditorMode = mode;
    this.editorDocument = { code, mode };
    
    if (world !== undefined) {
      this.worldDocument = world;
      this.app.saveWorldDocument(world);
    }
    if (renderer !== undefined) {
      this.rendererDocument = renderer;
      this.app.saveRendererDocument(renderer);
    }
    
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
    this.savedViews["code"]?.destroy();
    delete this.savedViews["code"];
    delete this.savedStates["code"];
    this.activeEditorMode = newMode;
    this.editorDocument = { code: this.getActiveEditorCode(), mode: newMode };
    this.app.saveEditor(this.editorDocument);
    this.callbacks.onModeChanged?.(newMode);
  }

  attachCodeEditor(theme: "dark" | "light"): void {
    if (this.lastTheme !== theme) {
      for (const key in this.savedViews) {
        this.savedViews[key as PlaygroundDocument]?.destroy();
      }
      this.savedViews = {};
      this.savedStates = {};
      this.lastTheme = theme;
    }

    const parentContainer = this.root.querySelector<HTMLElement>(".editor-surface");
    if (!parentContainer) {
      return;
    }
    // Clear any previous editor or legacy textarea
    parentContainer.innerHTML = "";

    let editor = this.savedViews[this.activePlaygroundDocument];
    if (editor) {
      parentContainer.appendChild(editor.dom);
      this.codeEditor = editor;
      if (this.hadFocusBeforeDestroy) {
        editor.focus();
      }
    } else {
      let state = this.savedStates[this.activePlaygroundDocument];
      if (!state) {
        const extensions = [
          basicSetup,
          keymap.of([indentWithTab]),
          indentUnit.of("  "),
          editorBaseTheme,
          theme === "dark" ? darkThemeExtension : lightThemeExtension,
          theme === "dark" ? syntaxHighlighting(cosmicHighlightStyle) : syntaxHighlighting(cosmicLightHighlightStyle),
        ];

        if (this.activePlaygroundDocument === "compiled" || this.readOnly) {
          extensions.push(EditorState.readOnly.of(true));
          extensions.push(EditorView.editable.of(false));
        } else {
          extensions.push(autocompletion({
            // Both sources are merged by CodeMirror, so the catalog paints immediately and
            // the presentation compiler's answers drop into the already-open popup.
            override: [(context) => this.provideHints(context)],
            defaultKeymap: true,
          }));
          extensions.push(hoverTooltip((view, pos, side) => this.provideHover(view, pos, side)));
          extensions.push(lintGutter());
          extensions.push(linter((view) => this.provideDiagnostics(view), {
            delay: 300,
            needsRefresh: (update) =>
              update.transactions.some((transaction) =>
                transaction.effects.some((effect) => effect.is(compileProblemsChanged)),
              ),
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

        state = EditorState.create({
          doc: this.getActiveEditorText(),
          extensions: cleanExtensions,
        });
      }

      editor = new EditorView({
        state,
        parent: parentContainer,
      });

      this.codeEditor = editor;
    }

    this.mountedDocument = this.activePlaygroundDocument;
    this.mountedEditorMode = this.activeEditorMode;
    // Markers survive tab switches and theme rebuilds, which recreate the view.
    this.refreshCompileDiagnostics();
  }

  destroyCodeEditor(): void {
    if (!this.codeEditor) {
      return;
    }
    this.hadFocusBeforeDestroy = this.codeEditor.hasFocus;
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

    if (mountedDocument !== "compiled") {
      this.savedViews[mountedDocument] = this.codeEditor;
      this.savedStates[mountedDocument] = this.codeEditor.state;
    } else {
      this.codeEditor.destroy();
    }

    this.codeEditor = undefined;
    this.mountedDocument = undefined;
    this.mountedEditorMode = undefined;
  }

  getActiveEditorText(): string {
    let rawText = "";
    if (this.activePlaygroundDocument === "world") {
      rawText = this.worldDocument;
    } else if (this.activePlaygroundDocument === "renderer") {
      rawText = this.rendererDocument;
    } else if (this.activePlaygroundDocument === "compiled") {
      rawText = this.app.previewCompiledSource(this.editorDocument, this.worldDocument);
    } else {
      rawText = this.getActiveEditorCode();
    }
    return rawText.replace(/\t/g, "  ");
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

  /**
   * A single source, so catalog and compiler entries can be deduplicated against each
   * other. The catalog answers synchronously; the Metals answer for the same position is
   * merged in as soon as it is cached, and its arrival reopens the popup.
   */
  private provideHints(context: CompletionContext): CompletionResult | null {
    const tab = this.activePlaygroundDocument;
    if (tab === "compiled") {
      return null;
    }

    const mixins = this.provideMixinHints(context);
    if (mixins) {
      return mixins;
    }

    const word = context.matchBefore(/[\w$.]*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const catalog =
      tab === "code" ? CODE_SUGGESTIONS : tab === "world" ? WORLD_SUGGESTIONS : RENDERER_SUGGESTIONS;
    const locals = extractLocalSuggestions(context.state.doc.toString(), tab);
    const options = [...this.metalsHintsFor(context), ...locals.map(toCompletion), ...catalog.map(toCompletion)];

    return {
      from: word.from,
      // Metals entries come first, so dedupe keeps the one carrying the real type.
      options: dedupeCompletions(options),
      // Labels are real identifiers, so CodeMirror's own fuzzy matcher does the filtering.
      validFor: /^[\w$.]*$/,
    };
  }

  /**
   * The `//using A, B` directive picks the traits the generated program mixes in, so it
   * needs its own completion set: nothing else in the language is valid there.
   */
  private provideMixinHints(context: CompletionContext): CompletionResult | null {
    if (this.activePlaygroundDocument !== "code" || this.activeEditorMode !== "easy-scala") {
      return null;
    }
    const line = context.state.doc.lineAt(context.pos);
    if (!/^\s*\/\/\s*using\b/.test(line.text)) {
      return null;
    }
    const word = context.matchBefore(/[\w$]*/);
    if (!word) {
      return null;
    }
    return {
      from: word.from,
      options: MIXIN_SUGGESTIONS.map(toCompletion),
      validFor: /^[\w$]*$/,
    };
  }

  /**
   * Type-aware entries for this exact position, if the presentation compiler has already
   * answered for it. Otherwise the request is started and the popup reopens when it lands
   * — the catalog is what the user sees in the meantime.
   */
  private metalsHintsFor(context: CompletionContext): Completion[] {
    const tab = this.activePlaygroundDocument;
    if (!this.metals || (tab !== "code" && tab !== "world")) {
      return [];
    }
    const text = context.state.doc.toString();
    const key = `${tab}\u0000${context.pos}\u0000${text}`;
    const cached = this.metalsCache.get(key);
    if (cached) {
      return cached;
    }
    void this.fetchMetalsHints(tab, text, context.pos, key);
    return [];
  }

  private async fetchMetalsHints(
    tab: "code" | "world",
    text: string,
    pos: number,
    key: string,
  ): Promise<void> {
    if (!this.metals || this.metalsPending.has(key)) {
      return;
    }
    this.metalsPending.add(key);
    try {
      const source = this.buildSourceFor(tab, text);
      if (!source) {
        return;
      }
      const lineNumber = countLinesUpTo(text, pos);
      const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
      const wrapped = source.toWrapped(tab, { line: lineNumber, ch: pos - lineStart });
      if (!wrapped) {
        return;
      }

      const result = await this.metals.complete(source.code, source.offsetOf(wrapped));
      const options = (result?.items ?? []).map((item): Completion => {
        const base: Completion = {
          label: item.label,
          detail: item.detail,
          type: item.tpe,
          // Real types beat the catalog's prose for the same identifier.
          boost: 2,
        };
        const template = toSnippetTemplate(item.instructions.text);
        return template === item.label ? base : snippetCompletion(template, base);
      });
      this.rememberMetalsHints(key, options);

      // Nothing to add, or the user has moved on: leave the popup as it is.
      if (options.length === 0 || !this.codeEditor) {
        return;
      }
      if (this.codeEditor.state.doc.toString() === text && this.codeEditor.state.selection.main.head === pos) {
        startCompletion(this.codeEditor);
      }
    } catch {
      // The catalog already answered; a failed lookup must never break the popup.
      this.rememberMetalsHints(key, []);
    } finally {
      this.metalsPending.delete(key);
    }
  }

  private rememberMetalsHints(key: string, options: Completion[]): void {
    this.metalsCache.set(key, options);
    // Keyed by the whole document, so the cache has to be bounded.
    while (this.metalsCache.size > 40) {
      const oldest = this.metalsCache.keys().next().value;
      if (oldest === undefined) break;
      this.metalsCache.delete(oldest);
    }
  }

  /**
   * Type and scaladoc for the symbol under the pointer, straight from the presentation
   * compiler. Silently absent when Metals is off, offline, or has nothing to say here.
   */
  private async provideHover(view: EditorView, pos: number, side: -1 | 1): Promise<Tooltip | null> {
    const tab = this.activePlaygroundDocument;
    if (!this.metals || (tab !== "code" && tab !== "world")) {
      return null;
    }
    const word = wordAround(view.state.doc.toString(), pos);
    // `side` tells us which way the pointer leans when it sits between two tokens.
    if (!word || (word.from === pos && side < 0) || (word.to === pos && side > 0)) {
      return null;
    }

    const text = view.state.doc.toString();
    const source = this.buildSourceFor(tab, text);
    if (!source) {
      return null;
    }
    const line = view.state.doc.lineAt(word.to);
    const wrapped = source.toWrapped(tab, { line: line.number, ch: word.to - line.from });
    if (!wrapped) {
      return null;
    }

    let hover;
    try {
      hover = await this.metals.hover(source.code, source.offsetOf(wrapped));
    } catch {
      return null;
    }
    if (!hover?.content) {
      return null;
    }

    const content = hover.content;
    return {
      pos: word.from,
      end: word.to,
      above: true,
      create: () => {
        const dom = document.createElement("div");
        dom.className = "cm-metals-hover";
        // Plain text only: the content is markdown from an external service.
        dom.textContent = stripMarkdownFences(content);
        return { dom };
      },
    };
  }

  /** Builds the wrapped source for the document currently being edited. */
  private buildSourceFor(tab: "code" | "world", text: string): WrappedSource | undefined {
    const code = tab === "code" ? text : this.getCodeText();
    const world = tab === "world" ? text : this.worldDocument;
    try {
      return this.app.buildCompileSource(code, this.activeEditorMode, world);
    } catch {
      return undefined;
    }
  }

  private getCodeText(): string {
    if (this.activePlaygroundDocument === "code" && this.codeEditor) {
      return this.codeEditor.state.doc.toString();
    }
    return this.activeEditorMode === "easy-scala" ? this.easyScalaBuffer : this.fullScalaBuffer;
  }

  /**
   * The single lint source for the editor. `linter()` replaces the whole diagnostic set
   * every time it runs, so compiler messages have to be produced here alongside the local
   * checks rather than dispatched separately — otherwise the next keystroke erases them.
   */
  private provideDiagnostics(view: EditorView): Diagnostic[] {
    return [...this.provideLocalDiagnostics(view), ...this.provideCompileDiagnostics(view)];
  }

  /**
   * Structural checks that need neither the network nor a compilation: bracket balance in
   * the Scala documents, and the world DSL parser that already runs on every change.
   */
  private provideLocalDiagnostics(view: EditorView): Diagnostic[] {
    const tab = this.activePlaygroundDocument;
    if (tab === "compiled") {
      return [];
    }
    const text = view.state.doc.toString();
    const diagnostics: Diagnostic[] = findStructuralProblems(text).map((problem) => ({
      from: Math.min(problem.from, view.state.doc.length),
      to: Math.min(problem.to, view.state.doc.length),
      severity: "error" as const,
      source: "syntax",
      message: problem.message,
    }));

    if (tab === "world" && diagnostics.length === 0 && text.trim().length > 0) {
      try {
        parseWorldDocument(text);
      } catch (error) {
        diagnostics.push(worldDiagnostic(error, view));
      }
    }

    return diagnostics;
  }

  /** Pushes compiler messages into the open editor without rebuilding it. */
  setCompileProblems(problems: readonly CompileProblem[], source?: WrappedSource): void {
    this.compileProblems = problems;
    this.compileSource = source;
    this.refreshCompileDiagnostics();
  }

  private provideCompileDiagnostics(view: EditorView): Diagnostic[] {
    const tab = this.activePlaygroundDocument;
    if (!this.compileSource || this.compileProblems.length === 0 || (tab !== "code" && tab !== "world")) {
      return [];
    }
    return toEditorDiagnostics(this.compileProblems, this.compileSource, tab, view.state.doc).diagnostics;
  }

  private refreshCompileDiagnostics(): void {
    if (!this.codeEditor) {
      return;
    }
    // Re-arms the lint plugin, which `forceLinting` alone cannot do once it has gone idle.
    this.codeEditor.dispatch({ effects: compileProblemsChanged.of(null) });
    forceLinting(this.codeEditor);
  }
}

const WORD_CHARACTER = /[\w$]/;

function wordAround(text: string, pos: number): { from: number; to: number } | undefined {
  let from = pos;
  let to = pos;
  while (from > 0 && WORD_CHARACTER.test(text[from - 1])) from -= 1;
  while (to < text.length && WORD_CHARACTER.test(text[to])) to += 1;
  return from === to ? undefined : { from, to };
}

/** Metals returns markdown; the tooltip shows it as text, so the fences would only be noise. */
function stripMarkdownFences(content: string): string {
  return content
    .replace(/```[a-z]*\n?/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

function countLinesUpTo(text: string, pos: number): number {
  let line = 1;
  for (let index = 0; index < pos && index < text.length; index += 1) {
    if (text[index] === "\n") line += 1;
  }
  return line;
}

/** Keeps the first entry for each label, so earlier (better-typed) entries win. */
function dedupeCompletions(options: Completion[]): Completion[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.label)) {
      return false;
    }
    seen.add(option.label);
    return true;
  });
}

/**
 * Metals emits `$0` for the final cursor stop and `${1:name}` for fields, which is already
 * CodeMirror's snippet syntax apart from the terminator.
 */
function toSnippetTemplate(text: string): string {
  return text.replace(/\$0/g, "${}");
}

function worldDiagnostic(error: unknown, view: EditorView): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  const anchor = error instanceof WorldDocumentError ? error.anchor : undefined;
  const at = anchor ? view.state.doc.toString().indexOf(anchor) : -1;
  const from = at >= 0 ? at : toOffset(view.state.doc, 1, 0) ?? 0;
  const to = at >= 0 ? at + anchor!.length : Math.min(from + 1, view.state.doc.length);
  return { from, to, severity: "error", source: "world", message };
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

