import { parseWorldDocument, tryParseWorldDocument, serializeWorldDocument } from "../services/config/world-document";
import { defaultRendererDocument } from "./renderer-document";
import { defaultConfiguration, defaultEditorDocument } from "./defaults";
import type { EditorDocument, ExampleDefinition, ExampleGroup, SupportConfiguration } from "../domain/contracts";

export interface EmbedProgram {
  code: string;
  mode: EditorDocument["mode"];
  configuration: SupportConfiguration;
  /** The world as compiled: an example's own text (as in the playground), else the serialized configuration. */
  worldDocument: string;
  renderer: string;
}

/** The program, world and renderer an embed runs, from its URL parameters. */
export function resolveEmbedProgram(params: URLSearchParams, examples: ExampleGroup[]): EmbedProgram {
  let initialConfig = defaultConfiguration;
  let initialCode = defaultEditorDocument.code;
  let initialMode: EditorDocument["mode"] = "easy-scala";
  let customRendererDoc = defaultRendererDocument;
  let exampleWorld: { text: string; configuration: SupportConfiguration } | undefined;

  // A. Check for predefined example
  const exampleName = params.get("example");
  if (exampleName) {
    const found = examples
      .flatMap((g) => g.examples)
      .find((e) => e.name.toLowerCase() === exampleName.toLowerCase());
    if (found) {
      initialCode = found.body;
      initialConfig = buildExampleConfiguration(found);
      exampleWorld = { text: found.world ?? serializeWorldDocument(initialConfig), configuration: initialConfig };
      customRendererDoc = found.renderer ?? defaultRendererDocument;
    }
  }

  // B. Check for explicit code parameter override (raw or b64)
  const codeRaw = params.get("code");
  const codeB64 = params.get("code_b64");
  if (codeRaw) {
    initialCode = codeRaw;
  } else if (codeB64) {
    initialCode = decodeBase64(codeB64);
  }

  const modeParam = params.get("mode");
  if (modeParam === "full-scala" || modeParam === "advanced") {
    initialMode = "full-scala";
  }

  // C. Check for world/config parameter override (raw or b64)
  const worldRaw = params.get("world");
  const worldB64 = params.get("world_b64");
  if (worldRaw) {
    const parsed = tryParseWorldDocument(worldRaw);
    if (parsed) initialConfig = parsed;
  } else if (worldB64) {
    const decoded = decodeBase64(worldB64);
    const parsed = tryParseWorldDocument(decoded);
    if (parsed) initialConfig = parsed;
  }

  // D. Check for custom renderer override
  const rendererRaw = params.get("renderer");
  const rendererB64 = params.get("renderer_b64");
  if (rendererRaw) {
    customRendererDoc = rendererRaw;
  } else if (rendererB64) {
    customRendererDoc = decodeBase64(rendererB64);
  }

  // E. Grid size overrides from query parameters
  const rowsParam = params.get("rows");
  const colsParam = params.get("cols");
  if (rowsParam || colsParam) {
    if (initialConfig.network.kind === "grid") {
      initialConfig = {
        ...initialConfig,
        network: {
          ...initialConfig.network,
          rows: rowsParam ? Number(rowsParam) : initialConfig.network.rows,
          cols: colsParam ? Number(colsParam) : initialConfig.network.cols,
        }
      };
    }
  }
  const gridParam = params.get("grid");
  if (gridParam) {
    const match = gridParam.match(/^(\d+)[xX](\d+)$/);
    if (match && initialConfig.network.kind === "grid") {
      initialConfig = {
        ...initialConfig,
        network: {
          ...initialConfig.network,
          rows: Number(match[1]),
          cols: Number(match[2]),
        }
      };
    }
  }

  const worldDocument = exampleWorld?.configuration === initialConfig ? exampleWorld.text : serializeWorldDocument(initialConfig);
  return { code: initialCode, mode: initialMode, configuration: initialConfig, worldDocument, renderer: customRendererDoc };
}

function buildExampleConfiguration(example: ExampleDefinition): SupportConfiguration {
  if (example.world) {
    const parsedWorld = tryParseWorldDocument(example.world);
    if (parsedWorld) {
      return parsedWorld;
    }
  }
  return parseWorldDocument(
    serializeWorldDocument({
      network: {
        kind: "grid",
        rows: 10,
        cols: 10,
        stepX: 60,
        stepY: 60,
        tolerance: 10,
      },
      neighbour: {
        range: 70,
      },
      deviceShape: { sensors: {}, initialValues: {} },
      seed: {
        configSeed: 0,
        simulationSeed: 0,
        randomSensorSeed: 0,
      },
    }),
  );
}

function decodeBase64(str: string): string {
  try {
    const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(normalized)));
  } catch (e) {
    console.error("Base64 decoding failed:", e);
    return "";
  }
}
