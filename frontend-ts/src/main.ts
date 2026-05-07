import "./app/styles.css";
import { renderBootstrap } from "./app/bootstrap";

const root = document.querySelector("#app");

if (!(root instanceof HTMLElement)) {
  throw new Error("#app root not found");
}

renderBootstrap(root);