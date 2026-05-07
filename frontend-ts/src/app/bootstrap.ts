import { createScafiWebApp } from "./composition-root";
import { ScafiWebUiShell } from "./ui-shell";

export function renderBootstrap(root: HTMLElement): void {
  const app = createScafiWebApp();
  const shell = new ScafiWebUiShell(root, app);
  void shell.mount();
}