import type { App, TFile } from "obsidian";
import type { Attachment } from "../types";

function generateId(): string {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function handlePasteEvent(
	evt: ClipboardEvent,
	app: App
): Promise<Attachment[]> {
	const attachments: Attachment[] = [];
	const items = evt.clipboardData?.items;
	if (!items) return attachments;

	for (const item of Array.from(items)) {
		if (item.kind === "file") {
			const file = item.getAsFile();
			if (!file) continue;

			const dataUrl = await fileToDataUrl(file);
			const type = getAttachmentType(file.name);
			attachments.push({
				id: generateId(),
				type,
				name: file.name,
				path: "",
				dataUrl,
			});
		}
	}

	return attachments;
}

export async function handleDropEvent(
	evt: DragEvent,
	app: App
): Promise<Attachment[]> {
	const attachments: Attachment[] = [];
	const files = evt.dataTransfer?.files;
	const items = evt.dataTransfer?.items;

	if (!files && !items) return attachments;

	for (const file of Array.from(files ?? [])) {
		const type = getAttachmentType(file.name);
		attachments.push({
			id: generateId(),
			type,
			name: file.name,
			path: "",
			dataUrl: await fileToDataUrl(file),
		});
	}

	// Handle internal vault file drops via dataTransfer text/uri-list or custom data
	const uriList = evt.dataTransfer?.getData("text/uri-list") ?? "";
	for (const line of uriList.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const vaultFile = app.vault.getAbstractFileByPath(trimmed);
		if (vaultFile instanceof (await import("obsidian")).TFile) {
			attachments.push({
				id: generateId(),
				type: getAttachmentType(vaultFile.name),
				name: vaultFile.name,
				path: vaultFile.path,
			});
		}
	}

	return attachments;
}

export function renderAttachmentPreview(
	container: HTMLElement,
	attachments: Attachment[],
	onRemove: (id: string) => void
): void {
	container.empty();
	if (attachments.length === 0) {
		container.style.display = "none";
		return;
	}
	container.style.display = "flex";
	container.addClass("agentchat-attachment-list");

	for (const att of attachments) {
		const chip = container.createDiv({ cls: "agentchat-attachment-chip" });

		const label = chip.createSpan({ cls: "agentchat-attachment-name" });
		label.setText(att.name);

		if (att.dataUrl && att.type === "image") {
			const thumb = chip.createEl("img", { cls: "agentchat-attachment-thumb" });
			thumb.src = att.dataUrl;
		}

		const removeBtn = chip.createEl("button", { cls: "agentchat-attachment-remove" });
		removeBtn.setText("\u00d7");
		removeBtn.addEventListener("click", () => onRemove(att.id));
	}
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => resolve("");
		reader.readAsDataURL(file);
	});
}

function getAttachmentType(name: string): "image" | "pdf" | "file" {
	const lower = name.toLowerCase();
	if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/.test(lower)) return "image";
	if (/\.pdf$/.test(lower)) return "pdf";
	return "file";
}
