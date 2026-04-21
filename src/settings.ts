import type { Plugin } from "obsidian";
import type { ObsidianAgentsSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export async function loadSettings(plugin: Plugin): Promise<ObsidianAgentsSettings> {
	const saved = await plugin.loadData();
	return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(
	plugin: Plugin,
	settings: ObsidianAgentsSettings
): Promise<void> {
	await plugin.saveData(settings);
}
