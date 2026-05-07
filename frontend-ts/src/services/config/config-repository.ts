import type { EditorDocument, SupportConfiguration } from "../../domain/contracts";
import type { KeyValueStore } from "../browser/key-value-store";

const CONFIGURATION_KEY = "configuration";
const EDITOR_DOCUMENT_KEY = "editor-document";
const WORLD_DOCUMENT_KEY = "world-document";
const RENDERER_DOCUMENT_KEY = "renderer-document";
const THEME_KEY = "ui-theme";

export class ConfigRepository {
  constructor(private readonly store: KeyValueStore) {}

  saveConfiguration(configuration: SupportConfiguration): void {
    this.store.set(CONFIGURATION_KEY, JSON.stringify(configuration));
  }

  loadConfiguration(): SupportConfiguration | undefined {
    return this.readJson<SupportConfiguration>(CONFIGURATION_KEY);
  }

  saveEditorDocument(document: EditorDocument): void {
    this.store.set(EDITOR_DOCUMENT_KEY, JSON.stringify(document));
  }

  loadEditorDocument(): EditorDocument | undefined {
    return this.readJson<EditorDocument>(EDITOR_DOCUMENT_KEY);
  }

  saveWorldDocument(document: string): void {
    this.store.set(WORLD_DOCUMENT_KEY, document);
  }

  loadWorldDocument(): string | undefined {
    return this.store.get(WORLD_DOCUMENT_KEY) ?? undefined;
  }

  saveRendererDocument(document: string): void {
    this.store.set(RENDERER_DOCUMENT_KEY, document);
  }

  loadRendererDocument(): string | undefined {
    return this.store.get(RENDERER_DOCUMENT_KEY) ?? undefined;
  }

  saveTheme(theme: "dark" | "light"): void {
    this.store.set(THEME_KEY, theme);
  }

  loadTheme(): "dark" | "light" | undefined {
    const value = this.store.get(THEME_KEY);
    if (value === "dark" || value === "light") {
      return value;
    }
    return undefined;
  }

  private readJson<T>(key: string): T | undefined {
    const raw = this.store.get(key);
    if (!raw) {
      return undefined;
    }
    return JSON.parse(raw) as T;
  }
}