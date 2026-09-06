import standaloneRuntimeTemplate from "../../../../standalone-runtime/src/main/template/ScafiStandaloneRuntime.template.scala?raw";

const USER_CODE_PLACEHOLDER = "// $$USER_CODE$$";
const WORLD_DOCUMENT_PLACEHOLDER = "// $$WORLD_DOCUMENT$$";

/** Columns added to every line of the injected world document. */
export const WORLD_DOCUMENT_INDENT = 4;

export interface RuntimeWrap {
  /** The full Scala source sent to Scastie. */
  code: string;
  /** 1-based line of `code` holding the first line of the world document. */
  worldStartLine: number;
  /** Number of world-document lines injected. */
  worldLineCount: number;
  /** Columns added to every world-document line. */
  worldIndent: number;
  /** 1-based line of `code` holding the first line of the user program. */
  userStartLine: number;
  /** Number of user-program lines injected. */
  userLineCount: number;
}

function findPlaceholderLine(lines: readonly string[], placeholder: string): number {
  const index = lines.findIndex((line) => line.includes(placeholder));
  if (index < 0) {
    throw new Error(`Runtime template is missing the ${placeholder} placeholder`);
  }
  return index;
}

/**
 * Substitutes both placeholders line by line and reports where each injected block landed.
 * The world document is injected first and is multi-line, so the user-code line index can
 * only be known after that substitution has happened.
 */
export function wrapStandaloneRuntimeCodeWithMap(core: string, worldDocument?: string): RuntimeWrap {
  const templateLines = standaloneRuntimeTemplate.split("\n");

  const worldLines = indentLines(buildWorldDocumentExpression(worldDocument ?? ""), WORLD_DOCUMENT_INDENT);
  const worldIndex = findPlaceholderLine(templateLines, WORLD_DOCUMENT_PLACEHOLDER);
  const withWorld = [
    ...templateLines.slice(0, worldIndex),
    ...worldLines,
    ...templateLines.slice(worldIndex + 1),
  ];

  const userLines = core.split("\n");
  const userIndex = findPlaceholderLine(withWorld, USER_CODE_PLACEHOLDER);
  const withUser = [...withWorld.slice(0, userIndex), ...userLines, ...withWorld.slice(userIndex + 1)];

  return {
    code: withUser.join("\n"),
    worldStartLine: worldIndex + 1,
    worldLineCount: worldLines.length,
    worldIndent: WORLD_DOCUMENT_INDENT,
    userStartLine: userIndex + 1,
    userLineCount: userLines.length,
  };
}

export function wrapStandaloneRuntimeCode(core: string, worldDocument?: string): string {
  return wrapStandaloneRuntimeCodeWithMap(core, worldDocument).code;
}

function buildWorldDocumentExpression(worldDocument: string): string {
  return worldDocument.trim().length > 0 ? worldDocument.trimEnd() : "world";
}

function indentLines(value: string, size: number): string[] {
  const padding = " ".repeat(size);
  return value.split("\n").map((line) => `${padding}${line}`);
}
