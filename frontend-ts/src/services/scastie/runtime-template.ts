import runtimeTemplateSource from "../../../../standalone-runtime/target/scala-2.13/src_managed/main/it/unibo/scafi/standalone/RuntimeTemplate.scala?raw";

const TEMPLATE_BLOCK_PATTERN = /Seq\[String\]\((?<content>[\s\S]*?)\)\.mkString\("\\n"\)/;
const STRING_LITERAL_PATTERN = /"(?:\\.|[^"\\])*"/g;
const USER_CODE_PLACEHOLDER = "__USER_CODE_PLACEHOLDER__";
const WORLD_DOCUMENT_PLACEHOLDER = '// $$WORLD_DOCUMENT$$';

const standaloneRuntimeTemplate = extractTemplate(runtimeTemplateSource);

export function wrapStandaloneRuntimeCode(core: string, worldDocument?: string): string {
  return standaloneRuntimeTemplate
    .replace(WORLD_DOCUMENT_PLACEHOLDER, buildWorldDocumentExpression(worldDocument ?? ""))
    .replace(USER_CODE_PLACEHOLDER, core);
}

function extractTemplate(source: string): string {
  const matchedBlock = source.match(TEMPLATE_BLOCK_PATTERN)?.groups?.content;
  if (!matchedBlock) {
    throw new Error("Unable to extract standalone runtime template");
  }

  const lines = Array.from(matchedBlock.matchAll(STRING_LITERAL_PATTERN), ([literal]) => JSON.parse(literal) as string);
  if (lines.length === 0) {
    throw new Error("Standalone runtime template is empty");
  }

  return lines.join("\n");
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