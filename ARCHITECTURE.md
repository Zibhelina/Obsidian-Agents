# Obsidian Agents Plugin Architecture

## Overview
Obsidian Agents is a high-quality Obsidian chat interface for Hermes agents. It is focused on rich UI, session management, and seamless Hermes CLI integration.

## Tech Stack
- TypeScript + esbuild (same as AIUI)
- Obsidian API
- CSS variables for theming (adapts to Obsidian themes)

## Module Structure

```
main.ts                          -- Entry point
manifest.json                    -- Plugin manifest
package.json                     -- Dependencies
esbuild.config.mjs               -- Build config
tsconfig.json                    -- TypeScript config
styles.css                       -- All styles (Obsidian loads this automatically)
src/
  plugin.ts                      -- Main Plugin class, lifecycle, commands
  types.ts                       -- Core shared types
  settings.ts                    -- Settings schema, defaults, validation
  storage.ts                     -- Session/folder persistence (flat file JSON)
  hermes.ts                      -- Hermes CLI/gateway communication
  tokenizer.ts                   -- Simple token estimation
  lib/
    vault.ts                     -- Vault file helpers for @mentions
    layout.ts                    -- Layout position enums & helpers
  features/
    mentions.ts                  -- @file / @folder resolution
    attachments.ts               -- File paste, drag-drop, embed handling
    commands.ts                  -- Hermes CLI command autocomplete/suggestions
    applets.ts                   -- Dynamic applet registry & renderer
  ui/
    ChatView.ts                  -- Main ItemView ("obsidian-agents")
    components/
      Sidebar.ts                 -- Session tree with folders
      Composer.ts                -- Input with @mention popover, file paste
      MessageList.ts             -- Scrollable message container
      MessageBubble.ts           -- Individual message renderer
      ThinkingTrace.ts           -- Expandable reasoning block
      StatusBar.ts               -- Model name, tokens, timer
      PermissionWidget.ts        -- Accept / Deny / Explain tool calls
      LayoutEngine.ts            -- Positions images/applets L/R/above/below
      MentionPopover.ts          -- File search dropdown for @
```

## Core Types

```typescript
// Session & Folder
interface ChatSession {
  id: string;
  name: string;
  folderId: string | null;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
}

interface SessionFolder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed: boolean;
}

// Message
interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  attachments: Attachment[];
  timestamp: number;
  metadata?: MessageMetadata;
}

interface Attachment {
  id: string;
  type: "image" | "file" | "pdf";
  name: string;
  path: string;        // vault path or data URL
  dataUrl?: string;    // inline for pasted images
}

interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  tokensTotal?: number;
  durationMs?: number;
  thinking?: string;
  toolCalls?: ToolCall[];
}

// Layout
 type LayoutPosition = "left" | "right" | "above" | "below" | "inline";

interface LayoutBlock {
  type: "text" | "image" | "applet";
  content: string;
  position: LayoutPosition;
  width?: string;      // e.g. "200px" or "40%"
}

// Tool / CLI
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "accepted" | "denied" | "running" | "completed" | "failed";
}

interface PendingPermission {
  toolCall: ToolCall;
  resolve: (decision: PermissionDecision) => void;
}

type PermissionDecision = { action: "accept" } | { action: "deny" } | { action: "explain"; reason: string };

// Settings
interface ObsidianAgentsSettings {
  agentName: string;
  model: string;
  effortLevel: "low" | "medium" | "high";
  hermesCliPath: string;
  hermesConfigDir: string;
}
```

## Data Flow

1. User opens ChatView -> loads active session from storage
2. User types message / pastes file / uses @mention -> Composer builds payload
3. Message added to session -> MessageList renders it
4. Hermes.ts spawns CLI or connects to gateway -> streams response
5. Streaming tokens parsed -> MessageBubble updates with LayoutEngine blocks
6. Tool calls detected -> PermissionWidget rendered, user decides
7. On stream end -> metadata (tokens, time) attached, storage saved

## Hermes Integration Strategy

Obsidian Agents inherits Hermes CLI config by default. The plugin communicates with the Hermes gateway (same pattern as AIUI) or spawns the CLI directly. For v1, we use a local gateway approach:

- `src/hermes.ts` exposes `sendMessage(session, message, handlers)`
- Handlers: onToken, onThinking, onToolCall, onComplete, onError
- Tool calls stream as JSON blocks; we parse them live

## Layout Engine

Messages from the agent can contain layout directives:

```markdown
<div data-obsidian-agents-layout="right" data-obsidian-agents-width="300px">
  ![image](path)
</div>

Some text here that wraps around the image.
```

The LayoutEngine scans rendered HTML for `data-obsidian-agents-layout` attributes and repositions elements using CSS flex/grid. Applets use `<iframe>` or sandboxed `<div>` with the same positioning system.

## Mention System

Composer listens for `@` keystroke. Popover searches vault files/folders fuzzy-match. Selection inserts `@"Folder/File.md"` syntax. When sending to Hermes, mentions are resolved to full file content (or summary) and injected into the user message context.

## Open Source Readiness

- MIT LICENSE
- Generic author in manifest
- README with install + dev instructions
- No hardcoded paths or keys
- `.gitignore`: node_modules, main.js, data.json, sessions.json
