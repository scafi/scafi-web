import standaloneRuntimeTemplate from "../../../../standalone-runtime/src/main/template/ScafiStandaloneRuntime.template.scala?raw";

const USER_CODE_PLACEHOLDER = "// $$USER_CODE$$";
const WORLD_DOCUMENT_PLACEHOLDER = "// $$WORLD_DOCUMENT$$";

export function wrapStandaloneRuntimeCode(core: string, worldDocument?: string): string {
  return standaloneRuntimeTemplate
    .replace(WORLD_DOCUMENT_PLACEHOLDER, buildWorldDocumentExpression(worldDocument ?? ""))
    .replace(USER_CODE_PLACEHOLDER, core);
}

function buildWorldDocumentExpression(worldDocument: string): string {
  return indent(worldDocument.trim().length > 0 ? worldDocument.trimEnd() : "world", 4);
}

function indent(value: string, size: number): string {
  const padding = " ".repeat(size);
  return value
    .split("\n")
    .map((line) => `${padding}${line}`)
    .join("\n");
}