// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NodeInspectorComponent } from "./node-inspector-component";
import type { GraphNode } from "../../domain/contracts";

describe("NodeInspectorComponent", () => {
  let root: HTMLElement;
  let mockApp: any;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    mockApp = {};
  });

  describe("renderInspector", () => {
    it("returns empty string when no nodes are selected", () => {
      const component = new NodeInspectorComponent(root, mockApp);
      const html = component.renderInspector([], false);
      expect(html).toBe("");
    });

    it("renders single node details correctly with position coordinates", () => {
      const component = new NodeInspectorComponent(root, mockApp);
      const node: GraphNode = {
        id: "node-123",
        position: { x: 45.67, y: 89.12 },
        labels: { export: "hello-world", temp: 24.5 },
      };

      const html = component.renderInspector([node], false);

      expect(html).toContain("node-123");
      expect(html).toContain("1 node selected");
      expect(html).toContain("hello-world");
      expect(html).toContain('id="move-x"');
      expect(html).toContain('value="45.67"');
      expect(html).toContain('id="move-y"');
      expect(html).toContain('value="89.12"');
    });

    it("renders group layout with zero defaults when multiple nodes are selected", () => {
      const component = new NodeInspectorComponent(root, mockApp);
      const nodes: GraphNode[] = [
        { id: "node-1", position: { x: 10, y: 20 }, labels: {} },
        { id: "node-2", position: { x: 30, y: 40 }, labels: {} },
      ];

      const html = component.renderInspector(nodes, false);

      expect(html).toContain("node-1");
      expect(html).toContain("2 nodes selected");
      expect(html).toContain("ΔX");
      expect(html).toContain("ΔY");
      expect(html).toContain('id="move-x" type="number" value="0"');
      expect(html).toContain('id="move-y" type="number" value="0"');
    });

    it("resolves single consensus on overlapping labels and mixed flag on disagreement", () => {
      const component = new NodeInspectorComponent(root, mockApp);
      const nodes: GraphNode[] = [
        { id: "node-1", position: { x: 10, y: 10 }, labels: { status: true, region: "A" } },
        { id: "node-2", position: { x: 20, y: 20 }, labels: { status: true, region: "B" } },
      ];

      const html = component.renderInspector(nodes, false);

      // 'status' is identical across all nodes -> consensus
      expect(html).toContain("status");
      expect(html).toContain('value="true"');
      expect(html).toContain("Toggle"); // status is boolean, so Toggle button rendered

      // 'region' is different -> mixed
      expect(html).toContain("region");
      expect(html).toContain("mixed");
      expect(html).toContain('placeholder="(mixed)"');
    });
  });

  describe("callbacks and interactions", () => {
    const setupInspectorDOM = (html: string) => {
      root.innerHTML = html;
    };

    it("triggers onMoveSelection on apply move click", () => {
      const component = new NodeInspectorComponent(root, mockApp);
      const callbacks = { onMoveSelection: vi.fn() };
      component.setCallbacks(callbacks);

      const nodes: GraphNode[] = [
        { id: "node-1", position: { x: 10, y: 20 }, labels: {} },
      ];
      setupInspectorDOM(component.renderInspector(nodes, false));
      component.attachListeners();

      const moveX = root.querySelector<HTMLInputElement>("#move-x");
      const moveY = root.querySelector<HTMLInputElement>("#move-y");
      if (moveX && moveY) {
        moveX.value = "15";
        moveY.value = "25";
      }

      root.querySelector<HTMLButtonElement>("#apply-move")?.click();

      expect(callbacks.onMoveSelection).toHaveBeenCalledWith(15, 25);
    });

    it("triggers onChangeSensor on apply sensor click with typed parsing", () => {
      const component = new NodeInspectorComponent(root, mockApp);
      const callbacks = { onChangeSensor: vi.fn() };
      component.setCallbacks(callbacks);

      const nodes: GraphNode[] = [
        { id: "node-1", position: { x: 10, y: 20 }, labels: { active: false, count: 12, mode: "fast" } },
      ];
      setupInspectorDOM(component.renderInspector(nodes, false));
      component.attachListeners();

      // Test boolean value parsing
      const activeInput = root.querySelector<HTMLInputElement>('[data-runtime-sensor-input="active"]');
      if (activeInput) activeInput.value = "true";
      root.querySelector<HTMLButtonElement>('[data-apply-sensor="active"]')?.click();
      expect(callbacks.onChangeSensor).toHaveBeenCalledWith("active", true);

      // Test number parsing
      const countInput = root.querySelector<HTMLInputElement>('[data-runtime-sensor-input="count"]');
      if (countInput) countInput.value = "45.5";
      root.querySelector<HTMLButtonElement>('[data-apply-sensor="count"]')?.click();
      expect(callbacks.onChangeSensor).toHaveBeenCalledWith("count", 45.5);

      // Test string parsing
      const modeInput = root.querySelector<HTMLInputElement>('[data-runtime-sensor-input="mode"]');
      if (modeInput) modeInput.value = "slow";
      root.querySelector<HTMLButtonElement>('[data-apply-sensor="mode"]')?.click();
      expect(callbacks.onChangeSensor).toHaveBeenCalledWith("mode", "slow");
    });

    it("triggers onToggleSensor on toggle click", () => {
      const component = new NodeInspectorComponent(root, mockApp);
      const callbacks = { onToggleSensor: vi.fn() };
      component.setCallbacks(callbacks);

      const nodes: GraphNode[] = [
        { id: "node-1", position: { x: 10, y: 20 }, labels: { status: false } },
      ];
      setupInspectorDOM(component.renderInspector(nodes, false));
      component.attachListeners();

      root.querySelector<HTMLButtonElement>('[data-toggle-runtime-sensor="status"]')?.click();

      expect(callbacks.onToggleSensor).toHaveBeenCalledWith("status");
    });
  });
});
