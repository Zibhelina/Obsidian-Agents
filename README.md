# AgentChat

A high-quality chat interface for Hermes agents inside Obsidian.

## Features

- **Session Management** — Create, organize, and switch between chat sessions using folders.
- **Rich Media Support** — Paste images, files, and PDFs directly into the composer.
- **Thinking Traces & Metrics** — View agent reasoning, time taken, tokens used, and model info.
- **Hermes CLI Integration** — Run Hermes commands with `/` autocomplete and permission widgets.
- **Dynamic Layouts** — Position images and applets on the left, right, above, or below text.
- **Vault Mentions** — Use `@` to mention files and folders from your vault.
- **Minimal Settings** — Configure agent name, model, and effort level. Inherits Hermes CLI settings by default.

## Installation

### From Source

1. Clone or copy this repository into your vault's `.obsidian/plugins/` folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/
   git clone https://github.com/Zibhelina/Obsidian-Agent-Chat.git agentchat
   cd agentchat
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Enable **AgentChat** in Obsidian's Community Plugins settings.

### Development

Run the watcher for live rebuilds:
```bash
npm run dev
```

## Usage

Open AgentChat via:
- The **message-circle** ribbon icon
- The Command Palette: `AgentChat: Open AgentChat`

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter` — Send message
- `@` — Mention a vault file or folder
- `/` — Trigger Hermes command autocomplete

### Settings

AgentChat keeps settings minimal:

| Setting       | Description                                      |
|---------------|--------------------------------------------------|
| Agent name    | Display name for the AI agent                    |
| Model         | The AI model Hermes uses                         |
| Effort level  | Low / Medium / High reasoning effort             |

All other configuration (API keys, providers, tools) is inherited from your Hermes CLI setup.

## Architecture

```
src/
  plugin.ts          — Main plugin lifecycle, settings tab, session management
  types.ts           — Core TypeScript interfaces
  settings.ts        — Settings load/save helpers
  storage.ts         — Session/folder persistence
  hermes.ts          — Hermes CLI/gateway communication
  tokenizer.ts       — Token estimation utilities
  lib/
    id.ts            — ID generation
    vault.ts         — Vault file search & mention resolution
    layout.ts        — Layout block parsing & CSS grid helpers
  features/
    mentions.ts      — @mention parsing and context injection
    attachments.ts   — Clipboard/drag-drop file handling
    commands.ts      — Hermes CLI command autocomplete
    applets.ts       — Dynamic applet registry (code blocks, charts)
  ui/
    ChatView.ts      — Main Obsidian ItemView
    components/      — Sidebar, Composer, MessageList, MessageBubble,
                       ThinkingTrace, StatusBar, PermissionWidget,
                       LayoutEngine, MentionPopover
```

## Roadmap

- [ ] Real Hermes gateway streaming integration
- [ ] Markdown rendering via Obsidian's `MarkdownRenderer`
- [ ] Additional built-in applets (tables, diagrams, etc.)
- [ ] Export sessions to markdown
- [ ] Search across chat history

## Author

Joao Henrique Costa Araujo

## License

MIT — see [LICENSE](./LICENSE)
