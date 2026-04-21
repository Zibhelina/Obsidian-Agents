import { setIcon } from "obsidian";

/**
 * Floating "Reply" button that appears next to a text selection inside
 * agent messages. Clicking it calls onReply with the selected text.
 */
export class ReplyHandle {
  private btn: HTMLElement;
  private onReply: (quote: string) => void;
  private currentText = "";

  constructor(root: HTMLElement, onReply: (quote: string) => void) {
    this.onReply = onReply;

    this.btn = document.createElement("div");
    this.btn.className = "obsidian-agents-reply-handle";
    this.btn.style.display = "none";
    const icon = this.btn.createSpan({ cls: "obsidian-agents-reply-handle-icon" });
    setIcon(icon, "reply");
    this.btn.createSpan({ text: "Reply" });
    document.body.appendChild(this.btn);

    this.btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.currentText) {
        this.onReply(this.currentText);
        this.hide();
        window.getSelection()?.removeAllRanges();
      }
    });

    document.addEventListener("selectionchange", this.handleSelectionChange);
    document.addEventListener("mousedown", this.handleDocMouseDown, true);
  }

  private handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      this.hide();
      return;
    }
    const range = sel.getRangeAt(0);
    const anchor = range.commonAncestorContainer;
    const el = anchor.nodeType === 1 ? (anchor as HTMLElement) : anchor.parentElement;
    if (!el) {
      this.hide();
      return;
    }
    // Accept selections anywhere inside any message wrapper — user or agent.
    const bubble =
      el.closest(".obsidian-agents-message-wrapper") ||
      el.closest(".obsidian-agents-message-bubble");
    if (!bubble) {
      this.hide();
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      this.hide();
      return;
    }
    this.currentText = text;

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hide();
      return;
    }

    // Show first so we can measure; use fixed sizing fallback if measure fails
    this.btn.style.display = "inline-flex";
    this.btn.style.visibility = "hidden";
    this.btn.style.top = "0px";
    this.btn.style.left = "0px";
    // Force layout
    const btnRect = this.btn.getBoundingClientRect();
    const bw = btnRect.width || 80;
    const bh = btnRect.height || 28;
    const top = Math.max(8, rect.top - bh - 6);
    const left = Math.max(
      8,
      Math.min(
        window.innerWidth - bw - 8,
        rect.left + rect.width / 2 - bw / 2
      )
    );
    this.btn.style.top = `${top}px`;
    this.btn.style.left = `${left}px`;
    this.btn.style.visibility = "visible";
  };

  private handleDocMouseDown = (e: MouseEvent) => {
    if (this.btn.contains(e.target as Node)) return;
    // Let selectionchange handle hide on next tick
  };

  private hide(): void {
    this.btn.style.display = "none";
    this.currentText = "";
  }

  destroy(): void {
    document.removeEventListener("selectionchange", this.handleSelectionChange);
    document.removeEventListener("mousedown", this.handleDocMouseDown, true);
    this.btn.remove();
  }
}
