import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./event-bus";

describe("EventBus", () => {
  it("publishes typed events to subscribers", () => {
    const bus = new EventBus<{ type: string; value: number }>();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.publish({ type: "x", value: 1 });

    expect(listener).toHaveBeenCalledWith({ type: "x", value: 1 });
  });
});