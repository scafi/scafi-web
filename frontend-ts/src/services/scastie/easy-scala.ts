const USING_PATTERN = /(?:\s*\/\/\s*using\s*)(\w*(?:\s*,\s*\w+)*)/;

export function convertEasyScalaToFull(code: string): string {
  const matched = code.match(USING_PATTERN);
  const libraries = matched?.[1]?.trim();
  const libsCode = libraries ? `with ${libraries.replace(/\s*,\s*/g, " with ")}` : "";
  const line = matched?.[0] ?? "";
  const body = code.replace(line, "");
  const shiftedBody = body
    .split("\n")
    .filter((currentLine) => currentLine.length > 0)
    .map((currentLine) => `    ${currentLine}`)
    .join("\n");

  return `class MyProgram extends AggregateProgram ${libsCode} {
  override def main() : Any = {
${shiftedBody}
  }
}
val program = new MyProgram
`;
}