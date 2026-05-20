import { ScafiWebApp } from "../scafi-web-app";

export class ThemeManager {
  private theme: "dark" | "light" = "dark";

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {}

  load(): void {
    this.theme = this.app.loadPersistedTheme();
    this.applyTheme(this.theme);
  }

  getTheme(): "dark" | "light" {
    return this.theme;
  }

  applyTheme(theme: "dark" | "light"): void {
    this.theme = theme;
    document.documentElement.dataset.theme = theme;
    const themeButton = this.root.querySelector<HTMLButtonElement>("#toggle-theme");
    if (themeButton) {
      themeButton.innerHTML = theme === "dark" ? iconSun() : iconMoon();
    }
  }

  toggleTheme(onThemeChanged?: (theme: "dark" | "light") => void): void {
    const next = this.theme === "dark" ? "light" : "dark";
    this.applyTheme(next);
    this.app.saveTheme(next);
    if (onThemeChanged) {
      onThemeChanged(next);
    }
  }
}

function iconSun(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
}

function iconMoon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
}
