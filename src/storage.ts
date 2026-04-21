import type { App } from "obsidian";
import type { ChatSession, SessionFolder } from "./types";
import { generateId } from "./lib/id";

const SESSIONS_PATH = ".obsidian/agentchat-sessions.json";

export function createSession(folderId: string | null): ChatSession {
	const now = Date.now();
	return {
		id: generateId(),
		name: "New Chat",
		folderId,
		messages: [],
		createdAt: now,
		updatedAt: now,
		model: "auto",
	};
}

export function createFolder(parentId: string | null): SessionFolder {
	return {
		id: generateId(),
		name: "New Folder",
		parentId,
		collapsed: false,
	};
}

export async function loadSessions(
	app: App
): Promise<{ sessions: ChatSession[]; folders: SessionFolder[] }> {
	try {
		const data = await app.vault.adapter.read(SESSIONS_PATH);
		const parsed = JSON.parse(data);
		return {
			sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
			folders: Array.isArray(parsed.folders) ? parsed.folders : [],
		};
	} catch {
		return { sessions: [], folders: [] };
	}
}

export async function saveSessions(
	app: App,
	data: { sessions: ChatSession[]; folders: SessionFolder[] }
): Promise<void> {
	await app.vault.adapter.write(SESSIONS_PATH, JSON.stringify(data, null, 2));
}
