import CodeMirror from "codemirror";
import type { EditorFromTextArea } from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
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
    });
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
}

function codeMirrorMode(documentName: PlaygroundDocument, mode: EditorDocument["mode"]): string {
  if (documentName === "renderer") {
    return "javascript";
  }
  return "text/x-scala";
}
