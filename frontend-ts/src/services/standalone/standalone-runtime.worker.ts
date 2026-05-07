import type { StandaloneRuntimeApi } from "../../domain/contracts";

const REQUIRED_METHODS: Array<keyof StandaloneRuntimeApi> = [
  "loadAndInit",
  "tick",
  "setPosition",
  "setSensorValue",
  "getState",
  "dispose",
];

type WorkerRequest =
  | { id: number; type: "load-source"; javascript: string }
  | { id: number; type: "loadAndInit"; configJson: string }
  | { id: number; type: "tick" }
  | { id: number; type: "setPosition"; nodeId: string; x: number; y: number }
  | { id: number; type: "setSensorValue"; sensorName: string; nodeIds: string[]; value: unknown }
  | { id: number; type: "getState" }
  | { id: number; type: "dispose" };

type WorkerResponse =
  | { id: number; ok: true; value?: unknown }
  | { id: number; ok: false; error: string };

let runtime: StandaloneRuntimeApi | undefined;

globalThis.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case "load-source": {
        await Promise.resolve(runtime?.dispose());
        runtime = loadRuntime(message.javascript);
        respond({ id: message.id, ok: true });
        return;
      }
      case "loadAndInit": {
        await Promise.resolve(requireRuntime().loadAndInit(message.configJson));
        respond({ id: message.id, ok: true });
        return;
      }
      case "tick": {
        await Promise.resolve(requireRuntime().tick());
        respond({ id: message.id, ok: true });
        return;
      }
      case "setPosition": {
        await Promise.resolve(requireRuntime().setPosition(message.nodeId, message.x, message.y));
        respond({ id: message.id, ok: true });
        return;
      }
      case "setSensorValue": {
        await Promise.resolve(requireRuntime().setSensorValue(message.sensorName, message.nodeIds, message.value));
        respond({ id: message.id, ok: true });
        return;
      }
      case "getState": {
        const value = await Promise.resolve(requireRuntime().getState());
        respond({ id: message.id, ok: true, value });
        return;
      }
      case "dispose": {
        await Promise.resolve(runtime?.dispose());
        runtime = undefined;
        respond({ id: message.id, ok: true });
        return;
      }
    }
  } catch (error) {
    respond({ id: message.id, ok: false, error: stringifyError(error) });
  }
};

function loadRuntime(javascript: string): StandaloneRuntimeApi {
  const loaded = new Function(
    `${javascript}\nreturn typeof scafiStandalone !== "undefined" ? scafiStandalone : undefined;`,
  )() as unknown;
  assertRuntimeApi(loaded);
  return loaded;
}

function assertRuntimeApi(candidate: unknown): asserts candidate is StandaloneRuntimeApi {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("scafiStandalone not defined");
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof (candidate as Record<string, unknown>)[method] !== "function") {
      throw new Error(`scafiStandalone is missing method ${method}`);
    }
  }
}

function requireRuntime(): StandaloneRuntimeApi {
  if (!runtime) {
    throw new Error("Worker runtime not initialized");
  }
  return runtime;
}

function respond(message: WorkerResponse): void {
  globalThis.postMessage(message);
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export {};