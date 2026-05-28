import { createScafiWebApp } from "./composition-root";
import { ScafiWebUiShell } from "./ui-shell";
import { ScafiWebEmbedShell } from "./embed-shell";
import { ScafiWebEmbedGenerator } from "./embed-generator";

export function renderBootstrap(root: HTMLElement): void {
  const app = createScafiWebApp();
  const params = new URLSearchParams(window.location.search);

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