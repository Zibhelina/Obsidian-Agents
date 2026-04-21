const HERMES_COMMANDS = [
	"/help",
	"/model",
	"/tools",
	"/memory",
	"/settings",
	"/clear",
	"/save",
	"/load",
	"/export",
];

export function getHermesCommands(): string[] {
	return [...HERMES_COMMANDS];
}

export function filterCommands(query: string): string[] {
	const lower = query.toLowerCase();
	return HERMES_COMMANDS.filter((cmd) => cmd.toLowerCase().includes(lower));
}

export function renderCommandPopover(
	container: HTMLElement,
	commands: string[],
	onSelect: (cmd: string) => void
): HTMLElement {
	const popover = container.createDiv({ cls: "obsidian-agents-command-popover" });
	popover.empty();

	if (commands.length === 0) {
		const empty = popover.createDiv({ cls: "obsidian-agents-command-empty" });
		empty.setText("No commands found");
		return popover;
	}

	const list = popover.createEl("ul", { cls: "obsidian-agents-command-list" });
	for (const cmd of commands) {
		const li = list.createEl("li", { cls: "obsidian-agents-command-item" });
		li.setText(cmd);
		li.addEventListener("click", () => {
			onSelect(cmd);
			popover.remove();
		});
	}

	return popover;
}

export function isCommand(text: string): boolean {
	return text.trimStart().startsWith("/");
}

export function parseCommand(text: string): { command: string; args: string } {
	const trimmed = text.trimStart();
	const spaceIdx = trimmed.indexOf(" ");
	if (spaceIdx === -1) {
		return { command: trimmed.slice(1), args: "" };
	}
	return {
		command: trimmed.slice(1, spaceIdx),
		args: trimmed.slice(spaceIdx + 1).trim(),
	};
}
