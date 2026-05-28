import { ScafiWebApp } from "./scafi-web-app";
import { ThemeManager } from "./components/theme-manager";
import type { ExampleGroup } from "../domain/contracts";

export class ScafiWebEmbedGenerator {
  private readonly themeManager: ThemeManager;
  private examples: ExampleGroup[] = [];

  // Configurator state
  private theme: "dark" | "light" = "dark";
  private layout: "split-h" | "split-v" | "sim-only" | "code-only" = "split-h";
  private selectedExample = "Gradient";
  private isEditable = true;
  private showControls = true;
  private autoPlay = true;
  private interval = 30;
  private customCode = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly app: ScafiWebApp,
  ) {
    this.themeManager = new ThemeManager(root, app);
  }

  async mount(): Promise<void> {
    this.themeManager.applyTheme("dark"); // Generator looks best in dark mode
    this.root.classList.add("generator-page-mode");

    try {
      this.examples = await this.app.loadExamples();
      // Set the default customCode to the Gradient example
      const gradientEx = this.examples.flatMap((g) => g.examples).find((e) => e.name === "Gradient");
      if (gradientEx) {
        this.customCode = gradientEx.body;
      }
    } catch (err) {
      console.error("Failed to load examples in generator", err);
    }

    this.render();
    this.attachListeners();
  }

  private render(): void {
    const iframeUrl = this.generateUrl();
    const iframeSnippet = `<iframe src="${escapeHtml(iframeUrl)}" width="100%" height="520px" style="border: 1px solid var(--line-strong); border-radius: 12px; overflow: hidden;" allow="clipboard-write"></iframe>`;

    this.root.innerHTML = `
      <div class="gen-shell">
        <header class="gen-header">
          <div class="gen-brand-container">
            <span class="gen-kicker">Developers Tool</span>
            <h1 class="gen-title">ScaFi Embed Configurator</h1>
          </div>
          <button id="back-to-app" class="gen-btn">Go to Playground</button>
        </header>

        <main class="gen-grid">
          <!-- Left: Controls Panel -->
          <section class="gen-panel gen-controls">
            <div class="gen-panel-header">
              <h2>Configure Embed Options</h2>
              <p class="gen-panel-subtitle">Customize how the interactive simulation displays in your documentation.</p>
            </div>

            <div class="gen-form">
              <div class="gen-row">
                <label class="gen-field">
                  <span>Theme</span>
                  <select id="gen-theme">
                    <option value="dark" ${selected(this.theme === "dark")}>Dark</option>
                    <option value="light" ${selected(this.theme === "light")}>Light</option>
                  </select>
                </label>

                <label class="gen-field">
                  <span>Layout</span>
                  <select id="gen-layout">
                    <option value="split-h" ${selected(this.layout === "split-h")}>Horizontal Split</option>
                    <option value="split-v" ${selected(this.layout === "split-v")}>Vertical Split</option>
                    <option value="sim-only" ${selected(this.layout === "sim-only")}>Simulation Only</option>
                    <option value="code-only" ${selected(this.layout === "code-only")}>Code Only</option>
                  </select>
                </label>
              </div>

              <div class="gen-row">
                <label class="gen-field">
                  <span>Base Example</span>
                  <select id="gen-example">
                    ${this.renderExampleOptions()}
                  </select>
                </label>

                <label class="gen-field">
                  <span>Simulation Speed</span>
                  <select id="gen-interval">
                    <option value="60" ${selected(this.interval === 60)}>Slow (60ms)</option>
                    <option value="30" ${selected(this.interval === 30)}>Normal (30ms)</option>
                    <option value="10" ${selected(this.interval === 10)}>Fast (10ms)</option>
                  </select>
                </label>
              </div>

              <div class="gen-checkbox-card">
                <h3>Interactions & Controls</h3>
                <div class="gen-checkboxes">
                  <label class="gen-checkbox-row">
                    <input id="gen-controls" type="checkbox" ${checked(this.showControls)} />
                    <div class="gen-checkbox-label">
                      <strong>Show Control Bar</strong>
                      <p>Renders Step, Run, Stop, Compile and Speed buttons inside the iframe.</p>
                    </div>
                  </label>

                  <label class="gen-checkbox-row">
                    <input id="gen-editable" type="checkbox" ${checked(this.isEditable)} />
                    <div class="gen-checkbox-label">
                      <strong>Editable Code</strong>
                      <p>Allows readers of your documentation to edit and compile Scala code in-place.</p>
                    </div>
                  </label>

                  <label class="gen-checkbox-row">
                    <input id="gen-autoplay" type="checkbox" ${checked(this.autoPlay)} />
                    <div class="gen-checkbox-label">
                      <strong>Autoplay</strong>
                      <p>Starts the collective simulation immediately when the iframe loads.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div class="gen-field gen-field-fill">
                <div class="gen-field-header">
                  <span>Custom Script Code (Optional)</span>
                  <button id="gen-reset-code" class="gen-btn-link">Reset to Example Code</button>
                </div>
                <textarea id="gen-custom-code" class="gen-textarea" placeholder="Paste custom Scala script..." spellcheck="false">${escapeHtml(this.customCode)}</textarea>
              </div>
            </div>
          </section>

          <!-- Right: Live Preview & Markup -->
          <section class="gen-panel gen-preview">
            <div class="gen-panel-header">
              <h2>Live Preview</h2>
              <p class="gen-panel-subtitle">This is exactly how it will appear embedded in your web page.</p>
            </div>

            <div class="gen-iframe-wrapper">
              <iframe id="preview-iframe" src="${iframeUrl}" width="100%" height="400px" style="border: none; background: #000;" allow="clipboard-write"></iframe>
            </div>

            <div class="gen-snippet-box">
              <div class="gen-snippet-header">
                <h3>Copy HTML Markup</h3>
                <button id="copy-snippet" class="gen-btn-copy">${iconCopy()} Copy HTML</button>
              </div>
              <pre class="gen-snippet-code"><code>${escapeHtml(iframeSnippet)}</code></pre>
            </div>
          </section>
        </main>
      </div>
    `;
  }

  private generateUrl(): string {
    const origin = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set("embed", "true");

    if (this.theme !== "dark") params.set("theme", this.theme);
    if (this.layout !== "split-h") params.set("layout", this.layout);
    if (!this.showControls) params.set("controls", "false");
    if (!this.isEditable) params.set("editable", "false");
    if (this.autoPlay) params.set("autoplay", "true");
    if (this.interval !== 30) params.set("interval", String(this.interval));

    // Custom code can be Base64 encoded to safely transmit multi-line scripts
    const activeEx = this.examples.flatMap((g) => g.examples).find((e) => e.name === this.selectedExample);
    if (activeEx && activeEx.body !== this.customCode) {
      params.set("code_b64", encodeBase64(this.customCode));
    } else if (this.selectedExample) {
      params.set("example", this.selectedExample);
    }

    return `${origin}?${params.toString()}`;
  }

  private renderExampleOptions(): string {
    return this.examples
      .map(
        (group) => `
          <optgroup label="${escapeHtml(group.groupName)}">
            ${group.examples
              .map(
                (example) => `<option value="${escapeHtml(example.name)}" ${selected(this.selectedExample === example.name)}>${escapeHtml(example.name)}</option>`,
              )
              .join("")}
          </optgroup>
        `,
      )
      .join("");
  }

  private attachListeners(): void {
    const updatePreview = () => {
      const url = this.generateUrl();
      const iframe = this.root.querySelector<HTMLIFrameElement>("#preview-iframe");
      if (iframe) {
        iframe.src = url;
      }
      const snippet = `<iframe src="${escapeHtml(url)}" width="100%" height="520px" style="border: 1px solid var(--line-strong); border-radius: 12px; overflow: hidden;" allow="clipboard-write"></iframe>`;
      const codeEl = this.root.querySelector<HTMLElement>(".gen-snippet-code code");
      if (codeEl) {
        codeEl.textContent = snippet;
      }
    };

    const bindSelect = (id: string, callback: (val: string) => void) => {
      this.root.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener("change", (e) => {
        callback((e.target as HTMLSelectElement).value);
        updatePreview();
      });
    };

    const bindCheckbox = (id: string, callback: (checked: boolean) => void) => {
      this.root.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("change", (e) => {
        callback((e.target as HTMLInputElement).checked);
        updatePreview();
      });
    };

    bindSelect("gen-theme", (val) => (this.theme = val as any));
    bindSelect("gen-layout", (val) => (this.layout = val as any));
    bindSelect("gen-interval", (val) => (this.interval = Number(val)));

    this.root.querySelector<HTMLSelectElement>("#gen-example")?.addEventListener("change", (e) => {
      const name = (e.target as HTMLSelectElement).value;
      this.selectedExample = name;
      const found = this.examples.flatMap((g) => g.examples).find((ex) => ex.name === name);
      if (found) {
        this.customCode = found.body;
        const textarea = this.root.querySelector<HTMLTextAreaElement>("#gen-custom-code");
        if (textarea) textarea.value = this.customCode;
      }
      updatePreview();
    });

    bindCheckbox("gen-controls", (val) => (this.showControls = val));
    bindCheckbox("gen-editable", (val) => (this.isEditable = val));
    bindCheckbox("gen-autoplay", (val) => (this.autoPlay = val));

    const textarea = this.root.querySelector<HTMLTextAreaElement>("#gen-custom-code");
    textarea?.addEventListener("input", (e) => {
      this.customCode = (e.target as HTMLTextAreaElement).value;
      updatePreview();
    });

    this.root.querySelector<HTMLButtonElement>("#gen-reset-code")?.addEventListener("click", () => {
      const found = this.examples.flatMap((g) => g.examples).find((ex) => ex.name === this.selectedExample);
      if (found) {
        this.customCode = found.body;
        if (textarea) textarea.value = this.customCode;
        updatePreview();
      }
    });

    this.root.querySelector<HTMLButtonElement>("#back-to-app")?.addEventListener("click", () => {
      window.location.search = "";
    });

    const copyBtn = this.root.querySelector<HTMLButtonElement>("#copy-snippet");
    copyBtn?.addEventListener("click", () => {
      const snippet = this.root.querySelector(".gen-snippet-code code")?.textContent ?? "";
      void navigator.clipboard.writeText(snippet);
      
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = `${iconCheck()} Copied!`;
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove("copied");
      }, 1500);
    });
  }
}

// Helpers
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function selected(value: boolean): string {
  return value ? "selected" : "";
}

function checked(value: boolean): string {
  return value ? "checked" : "";
}

function encodeBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    console.error("Base64 encoding failed:", e);
    return "";
  }
}

function iconCopy(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function iconCheck(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
}
