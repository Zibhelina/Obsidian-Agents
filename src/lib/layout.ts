import { LayoutBlock, LayoutPosition } from "../types";

function isValidPosition(pos: string): pos is LayoutPosition {
	return ["left", "right", "above", "below", "inline"].includes(pos);
}

function isValidType(type: string): type is LayoutBlock["type"] {
	return ["text", "image", "applet"].includes(type);
}

export function parseLayoutBlocks(html: string): LayoutBlock[] {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	const blocks: LayoutBlock[] = [];

	const elements = doc.querySelectorAll("[data-agentchat-layout]");
	elements.forEach((el) => {
		const attr = el.getAttribute("data-agentchat-layout");
		if (!attr) return;

		let position: LayoutPosition = "inline";
		let width: string | undefined;
		let type: LayoutBlock["type"] = "text";

		try {
			const parsed = JSON.parse(attr);
			if (parsed.position && isValidPosition(parsed.position)) {
				position = parsed.position;
			}
			if (parsed.width) width = String(parsed.width);
			if (parsed.type && isValidType(parsed.type)) {
				type = parsed.type;
			}
		} catch {
			if (isValidPosition(attr)) {
				position = attr;
			}
		}

		const content = el.innerHTML || el.textContent || "";
		blocks.push({ type, content, position, width });
	});

	return blocks;
}

export function createLayoutContainer(): HTMLElement {
	const div = document.createElement("div");
	div.className = "agentchat-layout-container";
	div.style.display = "grid";
	div.style.gridTemplateColumns = "1fr 1fr";
	div.style.gap = "8px";
	return div;
}

export function applyLayout(container: HTMLElement): void {
	const children = Array.from(container.children) as HTMLElement[];
	children.forEach((child) => {
		const attr = child.getAttribute("data-agentchat-layout");
		if (!attr) return;

		let position: LayoutPosition = "inline";
		try {
			const parsed = JSON.parse(attr);
			if (parsed.position && isValidPosition(parsed.position)) {
				position = parsed.position;
			}
		} catch {
			if (isValidPosition(attr)) {
				position = attr;
			}
		}

		switch (position) {
			case "left":
				child.style.gridColumn = "1 / 2";
				break;
			case "right":
				child.style.gridColumn = "2 / 3";
				break;
			case "above":
				child.style.gridColumn = "1 / -1";
				child.style.gridRow = "1";
				break;
			case "below":
				child.style.gridColumn = "1 / -1";
				break;
			case "inline":
			default:
				child.style.display = "inline";
				break;
		}
	});
}
