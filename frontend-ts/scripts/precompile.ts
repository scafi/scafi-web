// Compiles the built-in examples, the default program and the embeds listed in precompiled-embeds.txt through Scastie,
// and writes the results to public/precompiled, so that they start without Scastie. Run with: npm run precompile
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ScastieService, compilationKey, type EventSourceLike } from "../src/services/scastie/scastie-service";
import { resolveEmbedProgram } from "../src/app/embed-program";
import type { ExampleGroup } from "../src/domain/contracts";

const SCALA_VERSION = "2.13.18"; // the embeds default
const CONCURRENCY = 3;

// Node has no EventSource: read the server-sent events with fetch.
function fetchEventSource(url: string): EventSourceLike {
  const controller = new AbortController();
  const source: EventSourceLike = { onmessage: null, onerror: null, close: () => controller.abort() };
  void (async () => {
    try {
      const response = await fetch(url, { headers: { Accept: "text/event-stream" }, signal: controller.signal });
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
        for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
          const data = buffer.slice(0, end).split("\n").filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart()).join("\n");
          buffer = buffer.slice(end + 2);
          if (data) source.onmessage?.({ data });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) source.onerror?.(error);
    }
  })();
  return source;
}

const examples: ExampleGroup[] = JSON.parse(await readFile("public/config/examples.json", "utf8"));
const embeds = (await readFile("scripts/precompiled-embeds.txt", "utf8"))
  .split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
const queries = ["", ...examples.flatMap((group) => group.examples.map((e) => `example=${encodeURIComponent(e.name)}`)), ...embeds];
const service = new ScastieService({ scalaVersion: SCALA_VERSION, eventSourceFactory: fetchEventSource });

async function precompile(query: string): Promise<void> {
  const { code, mode, worldDocument: world } = resolveEmbedProgram(new URLSearchParams(query), examples);
  const path = `public/precompiled/${service.precompiledPath(compilationKey(code, mode, world))}`;
  if (existsSync(path)) return;
  try {
    const result = await service.compile(code, mode, world);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(result));
    console.log(`ok    ${query || "(default program)"}`);
  } catch (error) {
    console.error(`fail  ${query}: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

const pending = [...new Set(queries)];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (pending.length > 0) await precompile(pending.shift()!);
}));
