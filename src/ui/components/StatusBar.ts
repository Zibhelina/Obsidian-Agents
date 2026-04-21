export class StatusBar {
  private el: HTMLElement;
  private modelEl: HTMLElement;
  private tokensEl: HTMLElement;
  private timeEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container.createDiv({ cls: "obsidian-agents-status-bar" });
    this.modelEl = this.el.createSpan();
    this.tokensEl = this.el.createSpan();
    this.timeEl = this.el.createSpan();
  }

  update(model: string, tokensUsed: number, tokensTotal: number, durationMs: number): void {
    const usedK = tokensUsed >= 1000 ? `${(tokensUsed / 1000).toFixed(1)}k` : `${tokensUsed}`;
    const totalK = tokensTotal >= 1000 ? `${(tokensTotal / 1000).toFixed(0)}k` : `${tokensTotal}`;
    const seconds = (durationMs / 1000).toFixed(1);

    this.modelEl.setText(`Model: ${model}`);
    this.tokensEl.setText(`Tokens: ${usedK} / ${totalK}`);
    this.timeEl.setText(`Time: ${seconds}s`);
  }

  clear(): void {
    this.modelEl.setText("");
    this.tokensEl.setText("");
    this.timeEl.setText("");
  }
}
