import type { EditorDocument, ExampleGroup, SupportConfiguration, Vec2, UserSession } from "../domain/contracts";
import { AppStore, type AppState } from "../state/app-store";
import { EventBus } from "../state/event-bus";
import { ConfigRepository } from "../services/config/config-repository";
import { ExampleService } from "../services/examples/example-service";

export type AppEvent =
  | { type: "configuration-loaded"; configuration: SupportConfiguration }
  | { type: "examples-loaded"; examples: ExampleGroup[] }
  | { type: "editor-loaded"; document: EditorDocument }
  | { type: "state-changed"; state: AppState };

export class ScafiWebApp {
  constructor(
    readonly store: AppStore,
    private readonly configRepository: ConfigRepository,
    private readonly exampleService: ExampleService,
    private readonly bus = new EventBus<AppEvent>(),
  ) {}


  subscribe(listener: (event: AppEvent) => void): () => void {
    const unsubscribeEvents = this.bus.subscribe(listener);
    const unsubscribeState = this.store.subscribe((state) => {
      this.bus.publish({ type: "state-changed", state });
    });
    return () => {
      unsubscribeState();
      unsubscribeEvents();
    };
  }

  loadPersistedConfiguration(fallback: SupportConfiguration): SupportConfiguration {
    const configuration = this.configRepository.loadConfiguration() ?? fallback;
    this.store.evolve(configuration);
    this.bus.publish({ type: "configuration-loaded", configuration });
    return configuration;
  }

  saveConfiguration(configuration: SupportConfiguration): void {
    this.configRepository.saveConfiguration(configuration);
  }

  loadPersistedEditor(fallback: EditorDocument): EditorDocument {
    const document = this.configRepository.loadEditorDocument() ?? fallback;
    this.bus.publish({ type: "editor-loaded", document });
    return document;
  }

  saveEditor(document: EditorDocument): void {
    this.configRepository.saveEditorDocument(document);
  }

  loadPersistedWorldDocument(fallback: string): string {
    return this.configRepository.loadWorldDocument() ?? fallback;
  }

  saveWorldDocument(document: string): void {
    this.configRepository.saveWorldDocument(document);
  }

  loadPersistedRendererDocument(fallback: string): string {
    return this.configRepository.loadRendererDocument() ?? fallback;
  }

  saveRendererDocument(document: string): void {
    this.configRepository.saveRendererDocument(document);
  }

  loadPersistedTheme(): "dark" | "light" {
    return this.configRepository.loadTheme() ?? "dark";
  }

  saveTheme(theme: "dark" | "light"): void {
    this.configRepository.saveTheme(theme);
  }

  async loadExamples(): Promise<ExampleGroup[]> {
    const examples = await this.exampleService.loadExamples();
    const userSessions = this.configRepository.loadUserSessions();
    const merged = [...examples];
    if (userSessions.length > 0) {
      merged.push({
        groupName: "My Saved Files",
        examples: userSessions.map((session) => ({
          name: session.name,
          body: session.body,
          mode: session.mode,
          world: session.world,
          renderer: session.renderer,
        })),
      });
    }
    this.bus.publish({ type: "examples-loaded", examples: merged });
    return merged;
  }

  getUserSessions(): UserSession[] {
    return this.configRepository.loadUserSessions();
  }

  saveUserSession(session: UserSession): void {
    const sessions = this.configRepository.loadUserSessions();
    const index = sessions.findIndex((s) => s.name === session.name);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    this.configRepository.saveUserSessions(sessions);
    void this.refreshExamples();
  }

  deleteUserSession(name: string): void {
    const sessions = this.configRepository.loadUserSessions();
    const filtered = sessions.filter((s) => s.name !== name);
    this.configRepository.saveUserSessions(filtered);
    void this.refreshExamples();
  }

  private async refreshExamples(): Promise<void> {
    let builtIn: ExampleGroup[] = [];
    try {
      builtIn = await this.exampleService.loadRemote();
    } catch {
      try {
        builtIn = this.exampleService.loadCached();
      } catch {
        builtIn = [];
      }
    }
    const userSessions = this.configRepository.loadUserSessions();
    const merged = [...builtIn];
    if (userSessions.length > 0) {
      merged.push({
        groupName: "My Saved Files",
        examples: userSessions.map((session) => ({
          name: session.name,
          body: session.body,
          mode: session.mode,
          world: session.world,
          renderer: session.renderer,
        })),
      });
    }
    this.bus.publish({ type: "examples-loaded", examples: merged });
  }


  async loadScript(document: EditorDocument, worldDocument?: string): Promise<void> {
    this.saveEditor(document);
    await this.store.loadScript(document.code, document.mode, worldDocument);
  }

  previewCompiledSource(document: EditorDocument, worldDocument?: string): string {
    return this.store.previewCompiledSource(document.code, document.mode, worldDocument);
  }

  evolve(configuration: SupportConfiguration): void {
    this.saveConfiguration(configuration);
    this.store.evolve(configuration);
  }

  resetExecution(): void {
    this.store.resetExecution();
  }

  moveNodes(positionMap: Record<string, Vec2>): void {
    this.store.moveNodes(positionMap);
  }

  changeSensor(sensorName: string, nodeIds: string[], value: unknown): void {
    this.store.changeSensor(sensorName, nodeIds, value);
  }

  toggleSensor(sensorName: string, nodeIds: string[]): void {
    this.store.toggleSensor(sensorName, nodeIds);
  }

  async tick(): Promise<void> {
    await this.store.tick();
  }

  startDaemon(intervalMs: number): void {
    this.store.startDaemon(intervalMs);
  }

  stopDaemon(): void {
    this.store.stopDaemon();
  }

  dispose(): void {
    this.store.dispose();
  }
}