// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ThemeManager } from "./theme-manager";
import type { ScafiWebApp } from "../scafi-web-app";

describe("ThemeManager", () => {
  let root: HTMLElement;
  let mockApp: any;

  beforeEach(() => {
    // Setup clean DOM
    root = document.createElement("div");
    root.innerHTML = `<button id="toggle-theme"></button>`;
    document.body.appendChild(root);

    mockApp = {
      loadPersistedTheme: vi.fn(() => "dark" as const),
      saveTheme: vi.fn(),
    };
  });

  it("loads and applies persisted theme on initialization", () => {
    mockApp.loadPersistedTheme.mockReturnValue("dark");
    const themeManager = new ThemeManager(root, mockApp as any);

    themeManager.load();

    expect(mockApp.loadPersistedTheme).toHaveBeenCalled();
    expect(themeManager.getTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    const themeButton = root.querySelector<HTMLButtonElement>("#toggle-theme");
    expect(themeButton?.innerHTML).toContain("svg"); // contains Sun icon
  });

  it("applies light theme and updates UI", () => {
    const themeManager = new ThemeManager(root, mockApp as any);
    themeManager.applyTheme("light");

    expect(themeManager.getTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    const themeButton = root.querySelector<HTMLButtonElement>("#toggle-theme");
    expect(themeButton?.innerHTML).toContain("svg"); // contains Moon icon
  });

  it("toggles the theme and saves preferences", () => {
    const themeManager = new ThemeManager(root, mockApp as any);
    themeManager.applyTheme("dark");

    const callback = vi.fn();
    themeManager.toggleTheme(callback);

    expect(themeManager.getTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(mockApp.saveTheme).toHaveBeenCalledWith("light");
    expect(callback).toHaveBeenCalledWith("light");

    themeManager.toggleTheme();
    expect(themeManager.getTheme()).toBe("dark");
    expect(mockApp.saveTheme).toHaveBeenCalledWith("dark");
  });
});
