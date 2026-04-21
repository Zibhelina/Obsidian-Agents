import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { MentionItem } from "../types";

const MAX_RESULTS = 30;

function toMention(file: TAbstractFile): MentionItem {
	if (file instanceof TFile) {
		return { type: "file", path: file.path, displayName: file.basename };
	}
	return { type: "folder", path: file.path, displayName: file.name };
}

export function getVaultTree(app: App): MentionItem[] {
	return app.vault.getAllLoadedFiles().map(toMention);
}

function score(basename: string, path: string, query: string): number {
	if (!query) return 1;

	const nameLower = basename.toLowerCase();
	const pathLower = path.toLowerCase();

	if (nameLower === query) return 1000;
	if (nameLower.startsWith(query)) return 800 - nameLower.length;

	const nameIdx = nameLower.indexOf(query);
	if (nameIdx !== -1) return 600 - nameIdx - nameLower.length * 0.1;

	const wordIdx = nameLower.search(new RegExp(`\\b${escapeRegex(query)}`));
	if (wordIdx !== -1) return 500 - wordIdx;

	const pathIdx = pathLower.indexOf(query);
	if (pathIdx !== -1) return 300 - pathIdx * 0.1;

	if (isSubsequence(query, nameLower)) return 200;

	return -1;
}

function isSubsequence(needle: string, haystack: string): boolean {
	let i = 0;
	for (let j = 0; j < haystack.length && i < needle.length; j++) {
		if (needle[i] === haystack[j]) i++;
	}
	return i === needle.length;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function searchVaultFiles(app: App, query: string): MentionItem[] {
	const lower = query.toLowerCase().trim();
	const files = app.vault.getAllLoadedFiles();

	const scored: { item: MentionItem; score: number }[] = [];

	for (const f of files) {
		if (f instanceof TFolder && f.isRoot()) continue;

		const basename = f instanceof TFile ? f.basename : f.name;
		const s = score(basename, f.path, lower);
		if (s < 0) continue;

		const adjusted = f instanceof TFile ? s + 5 : s;
		scored.push({ item: toMention(f), score: adjusted });
	}

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, MAX_RESULTS).map((r) => r.item);
}

export async function resolveMention(
	app: App,
	path: string
): Promise<string> {
	const file = app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) {
		return app.vault.cachedRead(file);
	}
	throw new Error(`File not found: ${path}`);
}
