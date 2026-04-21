import { Component } from "obsidian";
import { ToolCall, PermissionDecision } from "../../types";

export class PermissionWidget extends Component {
  containerEl: HTMLElement;
  constructor(
    container: HTMLElement,
    toolCall: ToolCall,
    onDecide: (decision: PermissionDecision) => void
  ) {
    super();
    this.containerEl = container.createDiv({ cls: "obsidian-agents-permission-widget" });
    this.render(toolCall, onDecide);
  }

  private render(toolCall: ToolCall, onDecide: (decision: PermissionDecision) => void): void {
    const title = this.containerEl.createDiv({ cls: "obsidian-agents-permission-title" });
    title.setText(`\u2699\ufe0f ${toolCall.name}`);

    const args = this.containerEl.createDiv({ cls: "obsidian-agents-permission-args" });
    args.setText(JSON.stringify(toolCall.arguments, null, 2));

    const buttons = this.containerEl.createDiv({ cls: "obsidian-agents-permission-actions" });

    const acceptBtn = buttons.createEl("button", {
      cls: "obsidian-agents-btn-primary",
      text: "Accept",
    });
    const denyBtn = buttons.createEl("button", {
      cls: "obsidian-agents-btn-danger",
      text: "Deny",
    });
    const explainBtn = buttons.createEl("button", {
      text: "Explain",
    });

    let explainArea: HTMLTextAreaElement | null = null;

    this.registerDomEvent(acceptBtn, "click", () => {
      onDecide({ action: "accept" });
    });

    this.registerDomEvent(denyBtn, "click", () => {
      onDecide({ action: "deny" });
    });

    this.registerDomEvent(explainBtn, "click", () => {
      if (!explainArea) {
        explainArea = this.containerEl.createEl("textarea", {
          cls: "obsidian-agents-permission-explain-area",
        });
        explainArea.placeholder = "Explain your decision...";
        explainArea.focus();

        const submitBtn = this.containerEl.createEl("button", {
          cls: "obsidian-agents-btn-primary",
          text: "Submit explanation",
        });
        submitBtn.style.marginTop = "8px";
        this.registerDomEvent(submitBtn, "click", () => {
          onDecide({ action: "explain", reason: explainArea?.value || "" });
        });
      }
    });
  }
}
