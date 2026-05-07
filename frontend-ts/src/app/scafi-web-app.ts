import type { EditorDocument, ExampleGroup, SupportConfiguration, Vec2 } from "../domain/contracts";
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

  async loadExamples(): Promise<ExampleGroup[]> {
    const examples = await this.exampleService.loadExamples();
    this.bus.publish({ type: "examples-loaded", examples });
    return examples;
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