import { createScafiWebApp } from "./composition-root";
import { ScafiWebUiShell } from "./ui-shell";
import { ScafiWebEmbedShell } from "./embed-shell";
import { ScafiWebEmbedGenerator } from "./embed-generator";

export function renderBootstrap(root: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  let isScala3 = params.get("scala") === "3" || params.get("scalaVersion")?.startsWith("3");

  if (!params.has("scala") && !params.has("scalaVersion")) {
    const savedVersion = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("scala-version") : null;
    if (savedVersion) {
      isScala3 = savedVersion.startsWith("3.");
    }
  }

  const scalaVersion = isScala3 ? "3.7.4" : "2.13.18";
  const app = createScafiWebApp({ scalaVersion });

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("scala-version", scalaVersion);
  }

  if (params.has("embed")) {
    const shell = new ScafiWebEmbedShell(root, app);
    void shell.mount();
  } else if (params.has("generator")) {
    const shell = new ScafiWebEmbedGenerator(root, app);
    void shell.mount();
  } else {
    const shell = new ScafiWebUiShell(root, app);
    void shell.mount();
  }
}