import { App, TFile } from "obsidian";
import type { ChatMessage } from "../types";

const MENTION_REGEX = /(?:^|\s)@\[([^\]]+)\]\(([^)]+)\)|(?:^|\s)@"([^"]+)"|(?:^|\s)@([^\s@]+)/g;
const MARKER_PREFIX = "__AGENTCHAT_MENTION__";

// Extensions we refuse to read as text — vault.read() on these produces binary
// garbage that bloats the request and corrupts the payload.
const BINARY_EXTENSIONS = new Set([
  "png","jpg","jpeg","gif","webp","bmp","ico","tiff","tif","svg",
  "pdf","zip","gz","tar","7z","rar",
  "mp3","mp4","wav","ogg","flac","m4a","webm","mov","avi","mkv",
  "woff","woff2","ttf","otf","eot",
  "exe","dll","so","dylib",
]);

export function parseMentions(text: string): string[] {
	const paths: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = MENTION_REGEX.exec(text)) !== null) {
		const path = match[2] ?? match[3] ?? match[4];
		if (path && !paths.includes(path)) {
			paths.push(path);
		}
	}
	return paths;
}

export async function resolveMentions(
	text: string,
	app: App
): Promise<{ text: string; context: Record<string, string> }> {
	const paths = parseMentions(text);
	const context: Record<string, string> = {};
	let resolvedText = text;

	for (let i = 0; i < paths.length; i++) {
		const path = paths[i];
		const marker = `${MARKER_PREFIX}${i}__`;

		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const ext = file.extension.toLowerCase();
			if (BINARY_EXTENSIONS.has(ext)) {
				// Binary file — skip content injection, just note the reference.
				context[path] = `[Binary file: ${path} (${ext}) — contents not included]`;
			} else {
				try {
					const content = await app.vault.read(file);
					context[path] = content;
				} catch {
					context[path] = `[Unable to read file: ${path}]`;
				}
			}
		} else {
			context[path] = `[File not found: ${path}]`;
		}

		resolvedText = resolvedText.replace(
			new RegExp(`@\\[[^\\]]+\\]\\(${escapeRegex(path)}\\)|@"${escapeRegex(path)}"|@${escapeRegex(path)}`, "g"),
			marker
		);
	}

	return { text: resolvedText, context };
}

export function injectContextIntoMessage(
	message: ChatMessage,
	context: Record<string, string>
): ChatMessage {
	const entries = Object.entries(context);
	if (entries.length === 0) return message;

	const blocks = entries.map(([path, content]) => {
		return `<context file="${escapeHtml(path)}">\n${content}\n</context>`;
	});

	const prefix = blocks.join("\n\n") + "\n\n";
	return {
		...message,
		content: prefix + message.content,
	};
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
