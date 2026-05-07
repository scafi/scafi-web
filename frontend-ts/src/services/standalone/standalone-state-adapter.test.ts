import { describe, expect, it } from "vitest";
import { StandaloneStateAdapter } from "./standalone-state-adapter";

describe("StandaloneStateAdapter", () => {
  it("converts standalone state into graph snapshot and preserves matrix labels", () => {
    const adapter = new StandaloneStateAdapter();
    const result = adapter.toGraph({
      nodes: [
        {
          id: "0",
          x: 10,
          y: 20,
          labels: {
            matrix: {
              dimension: 2,
              pixels: [
                [[0, 1], "#ffffff"],
                [[1, 0], "#000000"],
              ],
            },
          },
        },
        { id: "1", x: 30, y: 40, source: true },
      ],
      edges: [["0", "1"], ["1", "missing"]],
    });

    expect(result).toBeDefined();
    expect(result?.graph.nodes).toHaveLength(2);
    expect(result?.graph.edges).toEqual([{ from: "0", to: "1" }]);
    expect(result?.warnings).toContain(
      "Dropping standalone edge 1 -> missing because at least one node is missing",
    );
    expect(result?.graph.nodes[0]?.labels.matrix).toEqual({
      dimension: 2,
      pixels: {
        "0:1": "#ffffff",
        "1:0": "#000000",
      },
    });
  });
});