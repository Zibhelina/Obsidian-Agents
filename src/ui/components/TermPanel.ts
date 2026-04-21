import { Component, MarkdownRenderer } from "obsidian";
import { TermDefinition, getTerm } from "./rich-layouts";

/**
 * Slide-in right panel that shows detail for a term when the user clicks
 * an inline `[[Label]]{#slug}` pill. Inspired by the ChatGPT "reference
 * sidebar" pattern: lightweight, theme-native, no route change.
 *
 * Lifecycle:
 *   new TermPanel(containerEl, app, sourcePath)
 *   panel.open(termId)  -> resolves the id against the global registry
 *   panel.close()       -> hides and clears content
 *
 * The panel is created once per ChatView and toggled in/out; a backdrop
 * under it dims the message area and absorbs click-to-dismiss. Escape
 * key also dismisses.
 */
export class TermPanel extends Component {
  private host: HTMLElement;
  private panel: HTMLElement;
  private backdrop: HTMLElement;
  private content: HTMLElement;
  private titleEl: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private sourcePath: string;
  private app: any;
  private innerComponent: Component;

  private isOpen = false;
  private keyListener = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.isOpen) {
      this.close();
    }
  };

  constructor(container: HTMLElement, app: any, sourcePath: string) {
    super();
    this.app = app;
    this.sourcePath = sourcePath;

    this.host = container.createDiv({ cls: "obsidian-agents-term-panel-host" });

    this.backdrop = this.host.createDiv({ cls: "obsidian-agents-term-panel-backdrop" });
    this.backdrop.addEventListener("click", () => this.close());

    this.panel = this.host.createDiv({ cls: "obsidian-agents-term-panel" });
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "Term detail");

    const header = this.panel.createDiv({ cls: "obsidian-agents-term-panel-header" });
    this.titleEl = header.createEl("h3", { cls: "obsidian-agents-term-panel-title" });
    this.closeBtn = header.createEl("button", {
      cls: "obsidian-agents-term-panel-close",
      attr: { "aria-label": "Close term panel" },
    });
    this.closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    this.closeBtn.addEventListener("click", () => this.close());

    this.content = this.panel.createDiv({ cls: "obsidian-agents-term-panel-content" });

    this.innerComponent = new Component();
    this.addChild(this.innerComponent);

    document.addEventListener("keydown", this.keyListener);
  }

  onunload(): void {
    document.removeEventListener("keydown", this.keyListener);
  }

  open(termId: string): void {
    const def = getTerm(termId);
    if (!def) {
      // Surface a minimal "not found" view so the UI doesn't silently
      // swallow a click — helps both users and the model debug term ids.
      this.renderNotFound(termId);
    } else {
      this.renderDefinition(def);
    }
    this.host.addClass("is-open");
    this.isOpen = true;
  }

  close(): void {
    this.host.removeClass("is-open");
    this.isOpen = false;
    // Leave content in place until next open to avoid a flash-empty
    // during the slide-out transition.
  }

  private renderNotFound(termId: string): void {
    this.titleEl.setText("Unknown term");
    this.content.empty();
    const msg = this.content.createDiv({ cls: "obsidian-agents-term-panel-missing" });
    msg.setText(`No definition registered for "${termId}".`);
  }

  private renderDefinition(def: TermDefinition): void {
    this.titleEl.setText(def.title || def.id);
    this.content.empty();

    // Carousel of images at the top — matches the reference screenshot
    // where the panel opens to a swipeable hero strip.
    if (Array.isArray(def.images) && def.images.length > 0) {
      this.renderImageCarousel(def.images);
    }

    // Optional canonical link just under the title, as a muted chip.
    if (def.href) {
      const linkRow = this.content.createDiv({ cls: "obsidian-agents-term-panel-linkrow" });
      const a = linkRow.createEl("a", { cls: "obsidian-agents-term-panel-canonical" });
      a.href = def.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setText(def.href.replace(/^https?:\/\//, "").replace(/^www\./, ""));
    }

    // Summary paragraph.
    if (def.summary) {
      const summary = this.content.createDiv({ cls: "obsidian-agents-term-panel-summary" });
      summary.setText(def.summary);
    }

    // Key facts list.
    if (Array.isArray(def.keyFacts) && def.keyFacts.length > 0) {
      const block = this.content.createDiv({ cls: "obsidian-agents-term-panel-keyfacts" });
      block.createEl("h4", {
        cls: "obsidian-agents-term-panel-section-heading",
        text: "Key facts",
      });
      const ul = block.createEl("ul", { cls: "obsidian-agents-term-panel-keyfacts-list" });
      for (const f of def.keyFacts) {
        if (!f || !f.label) continue;
        const li = ul.createEl("li");
        li.createEl("strong", { text: `${f.label}: ` });
        li.createSpan({ text: f.value || "" });
      }
    }

    // Free-form sections (heading + markdown body).
    if (Array.isArray(def.sections)) {
      for (const sec of def.sections) {
        if (!sec || !sec.body) continue;
        const wrap = this.content.createDiv({ cls: "obsidian-agents-term-panel-section" });
        if (sec.heading) {
          wrap.createEl("h4", {
            cls: "obsidian-agents-term-panel-section-heading",
            text: sec.heading,
          });
        }
        const body = wrap.createDiv({ cls: "obsidian-agents-term-panel-section-body markdown-rendered" });
        if (this.app) {
          MarkdownRenderer.render(
            this.app,
            sec.body,
            body,
            this.sourcePath,
            this.innerComponent
          ).catch(() => {
            body.setText(sec.body);
          });
        } else {
          body.setText(sec.body);
        }
      }
    }

    // Sources footer (reuses the same visual language as layout sources).
    if (Array.isArray(def.sources) && def.sources.length > 0) {
      const footer = this.content.createDiv({ cls: "obsidian-agents-rich-sources obsidian-agents-term-panel-sources" });
      footer.createSpan({ cls: "obsidian-agents-rich-sources-label", text: "Sources" });
      def.sources.forEach((s, i) => {
        if (!s || typeof s.href !== "string") return;
        const href = s.href.trim();
        if (!/^https?:\/\/|^mailto:/i.test(href)) return;
        const link = footer.createEl("a", { cls: "obsidian-agents-rich-source" });
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.createSpan({ cls: "obsidian-agents-rich-source-num", text: `${i + 1}` });
        link.createSpan({ cls: "obsidian-agents-rich-source-label", text: s.label || href });
        const site = s.site || this.hostnameOf(href);
        if (site) {
          link.createSpan({ cls: "obsidian-agents-rich-source-site", text: site });
        }
      });
    }
  }

  private renderImageCarousel(images: NonNullable<TermDefinition["images"]>): void {
    const wrap = this.content.createDiv({ cls: "obsidian-agents-term-panel-carousel" });
    const track = wrap.createDiv({ cls: "obsidian-agents-term-panel-carousel-track" });
    images.forEach((img) => {
      const slide = track.createDiv({ cls: "obsidian-agents-term-panel-carousel-slide" });
      const el = slide.createEl("img");
      el.src = img.src;
      el.alt = img.alt || "";
      el.loading = "lazy";
      if (img.caption) {
        slide.createDiv({ cls: "obsidian-agents-term-panel-carousel-caption", text: img.caption });
      }
    });

    if (images.length > 1) {
      const dots = wrap.createDiv({ cls: "obsidian-agents-term-panel-carousel-dots" });
      images.forEach((_, i) => {
        const d = dots.createDiv({ cls: "obsidian-agents-term-panel-carousel-dot" });
        if (i === 0) d.addClass("is-active");
      });
      // Update active dot on scroll.
      track.addEventListener(
        "scroll",
        () => {
          const slideW = track.clientWidth;
          const idx = slideW > 0 ? Math.round(track.scrollLeft / slideW) : 0;
          const children = dots.querySelectorAll(".obsidian-agents-term-panel-carousel-dot");
          children.forEach((el, i) => {
            el.classList.toggle("is-active", i === idx);
          });
        },
        { passive: true }
      );
    }
  }

  private hostnameOf(href: string): string {
    try {
      return new URL(href).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
}
