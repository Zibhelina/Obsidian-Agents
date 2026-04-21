export interface AppletDefinition {
	id: string;
	render(container: HTMLElement, props: Record<string, unknown>): void;
	cleanup?(): void;
}

const registry = new Map<string, AppletDefinition>();

export function registerApplet(def: AppletDefinition): void {
	registry.set(def.id, def);
}

export function createAppletElement(
	id: string,
	props: Record<string, unknown>
): HTMLElement {
	const wrapper = document.createDiv({ cls: "agentchat-applet" });
	wrapper.dataset.appletId = id;

	const def = registry.get(id);
	if (def) {
		def.render(wrapper, props);
	} else {
		const fallback = wrapper.createDiv({ cls: "agentchat-applet-error" });
		fallback.setText(`Unknown applet: ${id}`);
	}

	return wrapper;
}

// Built-in code-block applet
registerApplet({
	id: "code-block",
	render(container, props) {
		container.addClass("agentchat-applet-code");
		const code = String(props.code ?? props.content ?? "");
		const lang = String(props.language ?? props.lang ?? "");
		const pre = container.createEl("pre", { cls: "agentchat-applet-code-pre" });
		const el = pre.createEl("code", {
			cls: lang ? `language-${lang}` : undefined,
		});
		el.setText(code);
	},
});

// Built-in chart applet placeholder
registerApplet({
	id: "chart",
	render(container, props) {
		container.addClass("agentchat-applet-chart");
		const canvas = container.createEl("canvas", { cls: "agentchat-applet-chart-canvas" });
		canvas.width = Number(props.width ?? 400);
		canvas.height = Number(props.height ?? 200);
		// Placeholder: consumers can draw on the canvas via props or external hooks
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = getComputedStyle(container).getPropertyValue("--text-muted") || "#999";
			ctx.font = "14px sans-serif";
			ctx.fillText("Chart placeholder", 10, canvas.height / 2);
		}
	},
});
