import type { Plugin } from "obsidian";
import type { AgentChatSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export async function loadSettings(plugin: Plugin): Promise<AgentChatSettings> {
	const saved = await plugin.loadData();
	return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(
	plugin: Plugin,
	settings: AgentChatSettings
): Promise<void> {
	await plugin.saveData(settings);
}
