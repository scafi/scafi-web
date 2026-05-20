import type { GraphNode, Vec2 } from "../../domain/contracts";
import type { AppState } from "../../state/app-store";
import type { ScafiWebApp } from "../scafi-web-app";

export interface NodeInspectorCallbacks {
  onMoveSelection?(x: number, y: number): void;
  onChangeSensor?(sensorName: string, value: unknown): void;
  onToggleSensor?(sensorName: string): void;
  onSelectNode?(nodeId: string): void;
  onClearSelection?(): void;
  onHidePanel?(): void;
}

export class NodeInspectorComponent {
  private callbacks: NodeInspectorCallbacks = {};

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {}

  setCallbacks(callbacks: NodeInspectorCallbacks): void {
    this.callbacks = callbacks;
  }

  renderInspector(selectedNodes: GraphNode[], disabled: boolean): string {
    if (selectedNodes.length === 0) {
      return "";
    }
    const primaryNode = selectedNodes[0];
    const sensorConsensus = this.buildSensorConsensus(selectedNodes);
    const exportValue = primaryNode.labels.export ?? null;
    const isGroup = selectedNodes.length > 1;
    const moveLabel = isGroup ? "ΔX" : "X";
    const moveLabelY = isGroup ? "ΔY" : "Y";
    const moveDefault = isGroup ? 0 : Number(primaryNode.position.x.toFixed(2));
    const moveDefaultY = isGroup ? 0 : Number(primaryNode.position.y.toFixed(2));
    return `
      <div class="inspector-stack">
        <div class="inspector-card inspector-card-export">
          <div class="selection-node-header">
            <div>
              <p class="section-kicker">Node</p>
              <h3>${escapeHtml(primaryNode.id)}</h3>
            </div>
            <p class="muted">${selectedNodes.length} node${selectedNodes.length === 1 ? "" : "s"} selected${selectedNodes.length > 1 ? ` — showing ${escapeHtml(primaryNode.id)}` : ""}</p>
          </div>
          <div class="export-callout">
            <span class="export-callout-label">Current output</span>
            <p class="export-summary" data-inspector-export-summary>${escapeHtml(summarizeInspectorValue(exportValue))}</p>
          </div>
          <pre class="export-preview" data-inspector-export-preview>${escapeHtml(formatInspectorJson(exportValue))}</pre>
        </div>

        <div class="inspector-card">
          <div class="inline-heading">
            <h3>Move</h3>
            <span class="muted">${isGroup ? "delta to selection" : "selection transform"}</span>
          </div>
          <div class="config-grid compact-grid">
            <label class="field"><span>${escapeHtml(moveLabel)}</span><input id="move-x" type="number" value="${moveDefault}" ${disabled ? "disabled" : ""} /></label>
            <label class="field"><span>${escapeHtml(moveLabelY)}</span><input id="move-y" type="number" value="${moveDefaultY}" ${disabled ? "disabled" : ""} /></label>
          </div>
          <button id="apply-move" class="primary" type="button" ${disabled ? "disabled" : ""}>Move selection</button>
        </div>

        <div class="inspector-card">
          <div class="inline-heading">
            <h3>Sensors</h3>
            <span class="muted">apply to selection</span>
          </div>
          ${sensorConsensus.length > 0 ? sensorConsensus.map((entry) => this.renderSensorEditor(entry.name, entry.value, entry.mixed, disabled)).join("") : `<p class="muted">No scalar sensors available.</p>`}
        </div>

      </div>
    `;
  }

  private buildSensorConsensus(selectedNodes: GraphNode[]): Array<{ name: string; value: unknown; mixed: boolean }> {
    const seen = new Set<string>();
    const result: Array<{ name: string; value: unknown; mixed: boolean }> = [];
    for (const node of selectedNodes) {
      for (const [label, value] of Object.entries(node.labels)) {
        if (label === "export" || label === "matrix") continue;
        if (seen.has(label)) continue;
        seen.add(label);
        const allSame = selectedNodes.every((other) => other.labels[label] === value);
        result.push({ name: label, value: allSame ? value : undefined, mixed: !allSame });
      }
    }
    return result;
  }

  private renderSensorEditor(name: string, value: unknown, mixed = false, disabled = false): string {
    const displayValue = mixed ? "" : String(value);
    const isBoolean = typeof value === "boolean" && !mixed;
    const mixedAttr = mixed ? ' data-sensor-mixed="true"' : "";
    return `
      <div class="sensor-editor">
        <label class="field grow-field">
          <span>${escapeHtml(name)}${mixed ? ` <small class="sensor-mixed-hint">(mixed)</small>` : ""}</span>
          <input data-runtime-sensor-input="${escapeHtml(name)}"${mixedAttr} type="text" value="${escapeHtml(displayValue)}" placeholder="${mixed ? "(mixed)" : ""}" ${disabled ? "disabled" : ""} />
        </label>
        <button class="ghost" type="button" data-apply-sensor="${escapeHtml(name)}" ${disabled ? "disabled" : ""}>Apply</button>
        ${isBoolean ? `<button class="ghost" type="button" data-toggle-runtime-sensor="${escapeHtml(name)}" ${disabled ? "disabled" : ""}>Toggle</button>` : ""}
      </div>
    `;
  }

  attachListeners(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-select-node]")) {
      button.addEventListener("click", () => {
        const nodeId = button.dataset.selectNode;
        if (nodeId) {
          this.callbacks.onSelectNode?.(nodeId);
        }
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-clear-selection]")) {
      button.addEventListener("click", () => {
        this.callbacks.onClearSelection?.();
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-hide-selection-panel]")) {
      button.addEventListener("click", () => {
        this.callbacks.onHidePanel?.();
      });
    }

    const applyMoveBtn = this.root.querySelector<HTMLButtonElement>("#apply-move");
    applyMoveBtn?.addEventListener("click", () => {
      const x = Number((this.root.querySelector<HTMLInputElement>("#move-x")?.value ?? "0").trim());
      const y = Number((this.root.querySelector<HTMLInputElement>("#move-y")?.value ?? "0").trim());
      this.callbacks.onMoveSelection?.(x, y);
    });

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-apply-sensor]")) {
      button.addEventListener("click", () => {
        const sensorName = button.dataset.applySensor;
        if (!sensorName) return;
        const input = this.root.querySelector<HTMLInputElement>(`[data-runtime-sensor-input="${cssEscape(sensorName)}"]`);
        if (!input) return;
        this.callbacks.onChangeSensor?.(sensorName, parseRuntimeValue(input.value));
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-toggle-runtime-sensor]")) {
      button.addEventListener("click", () => {
        const sensorName = button.dataset.toggleRuntimeSensor;
        if (sensorName) {
          this.callbacks.onToggleSensor?.(sensorName);
        }
      });
    }
  }
}

// Internal pure utilities
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssEscape(value: string): string {
  return value.replaceAll('"', '\\"');
}

function parseRuntimeValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.length > 0 && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return value;
}

function summarizeInspectorValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "object") return "Object";
  return String(value);
}

function formatInspectorJson(value: unknown): string {
  if (value === null || value === undefined) return "None";
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}
