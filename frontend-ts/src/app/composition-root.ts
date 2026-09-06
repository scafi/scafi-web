import { defaultConfiguration } from "./defaults";
import { ScafiWebApp } from "./scafi-web-app";
import { AppStore } from "../state/app-store";
import { ConfigRepository } from "../services/config/config-repository";
import { ExampleService } from "../services/examples/example-service";
import { MemoryKeyValueStore, type KeyValueStore, LocalStorageStore } from "../services/browser/key-value-store";
import { RuntimeConfigSerializer } from "../services/serialization/runtime-config-serializer";
import { ScastieService } from "../services/scastie/scastie-service";
import { MetalsService } from "../services/scastie/metals-service";
import type { RuntimeWrapper } from "../services/scastie/source-map";
import { wrapStandaloneRuntimeCodeWithMap } from "../services/scastie/runtime-template";
import { StandaloneRuntimeLoader } from "../services/standalone/standalone-runtime-loader";
import { StandaloneSessionManager } from "../services/standalone/session-manager";
import { StandaloneStateAdapter } from "../services/standalone/standalone-state-adapter";

export interface CompositionRootOptions {
  store?: KeyValueStore;
  fetchImpl?: typeof fetch;
  wrapRuntime?: RuntimeWrapper;
  examplesUrl?: string;
  scalaVersion?: string;
  scafiVersion?: string;
}

export function createScafiWebApp(options: CompositionRootOptions = {}): ScafiWebApp {
  const store = options.store ?? safeBrowserStore();
  const serializer = new RuntimeConfigSerializer();
  const sessionManager = new StandaloneSessionManager();
  const scastieService = new ScastieService({
    fetchImpl: options.fetchImpl,
    wrapRuntime: options.wrapRuntime ?? wrapStandaloneRuntimeCodeWithMap,
    scalaVersion: options.scalaVersion,
    scafiVersion: options.scafiVersion,
  });
  const metalsService = new MetalsService({
    scalaVersion: scastieService.getScalaVersion(),
    scalaJsVersion: scastieService.getScalaJsVersion(),
    scafiVersion: scastieService.getScafiVersion(),
    fetchImpl: options.fetchImpl,
  });
  const runtimeLoader = new StandaloneRuntimeLoader();
  const stateAdapter = new StandaloneStateAdapter();
  const appStore = new AppStore(
    {
      scastie: scastieService,
      runtimeLoader,
      stateAdapter,
      sessionManager,
      serializer,
    },
    defaultConfiguration,
  );
  const configRepository = new ConfigRepository(store);
  const exampleService = new ExampleService(store, {
    fetchImpl: options.fetchImpl,
    examplesUrl: options.examplesUrl,
  });
  return new ScafiWebApp(appStore, configRepository, exampleService, undefined, metalsService);
}

function safeBrowserStore(): KeyValueStore {
  if (typeof window === "undefined" || !window.localStorage) {
    return new MemoryKeyValueStore();
  }
  return new LocalStorageStore(window.localStorage);
}