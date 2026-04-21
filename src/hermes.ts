import { AgentChatSettings, ChatMessage, StreamHandlers, ToolCall } from "./types";
import { estimateTokens } from "./tokenizer";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { generateId } from "./lib/id";

const HERMES_ENV_PATH = join(homedir(), ".hermes", ".env");

function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    result[line.slice(0, eqIndex).trim()] = line.slice(eqIndex + 1).trim();
  }
  return result;
}

function readTextFile(path: string): string {
  try {
    return existsSync(path) ? readFileSync(path, "utf-8") : "";
  } catch {
    return "";
  }
}

function normalizeGatewayUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.endsWith("/v1")
      ? parsed.pathname.replace(/\/+$/, "")
      : `${parsed.pathname.replace(/\/+$/, "")}/v1`;
    parsed.pathname = path;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function getGatewayUrl(settings: AgentChatSettings): string {
  if (settings.hermesGatewayUrl) {
    const normalized = normalizeGatewayUrl(settings.hermesGatewayUrl);
    if (normalized) return normalized;
  }
  const env = parseEnv(readTextFile(HERMES_ENV_PATH));
  const host = env.API_SERVER_HOST || "localhost";
  const port = env.API_SERVER_PORT || "8080";
  return `http://${host}:${port}/v1`;
}

function getApiKey(settings: AgentChatSettings): string {
  if (settings.hermesApiKey) return settings.hermesApiKey;
  const env = parseEnv(readTextFile(HERMES_ENV_PATH));
  return env.API_SERVER_KEY || "";
}

const AGENTCHAT_SYSTEM_PROMPT = `You are running inside the AgentChat Obsidian plugin. The UI renders your responses as markdown and supports a special capability: **inline applets** (interactive HTML or React) that you can embed and position anywhere in your reply.

## Reasoning trace

The AgentChat UI has a collapsible "Reasoning" panel on each agent message that is hidden by default and opens when the user clicks it. Put any thinking, planning, or tool-use commentary you'd like to expose inside \`<thinking>…</thinking>\` tags. Everything between those tags is routed to the Reasoning panel and does NOT appear in the visible reply.

Guidelines:
- Use \`<thinking>\` for step-by-step reasoning, plans, uncertainty, and narration of what tool calls you're about to make. Close the tag before you start writing the user-facing answer.
- Keep the visible reply outside the thinking block focused, polished, and final — no "Let me check…" preambles out there.
- You may open/close \`<thinking>\` tags multiple times in one turn if you need to reason, write a paragraph, then reason again.
- Do not put rich layout blocks (\`agentchat-hero\`, \`agentchat-gallery\`, etc.) inside \`<thinking>\` — only the final visible reply should contain them.


## Applet syntax

Use a fenced code block with language \`agentchat-applet\` (for raw HTML + vanilla JS) or \`agentchat-react\` (for React 18, already imported as \`React\` and \`createRoot\`). The info line accepts these attributes:

- \`position=inline|left|right|above|below\` — default: \`inline\`. Use \`left\` / \`right\` to float the applet and let surrounding paragraphs wrap around it (Wikipedia-style).
- \`width=320px\` (or any CSS length)
- \`height=240px\`

## Theming

The applet renders in a sandboxed iframe that is auto-themed: the user's current Obsidian theme colors are exposed as CSS custom properties inside the applet:
\`--background-primary\`, \`--background-secondary\`, \`--background-modifier-border\`, \`--background-modifier-hover\`, \`--text-normal\`, \`--text-muted\`, \`--text-faint\`, \`--text-on-accent\`, \`--interactive-accent\`, \`--interactive-accent-hover\`, \`--font-interface\`, \`--font-monospace\`.

**Always** style your applets using these variables so they blend into the user's theme. Never hard-code colors.

## Layout philosophy

Compose replies like a polished Wikipedia article:
- Put a floated applet (\`position=right\` or \`position=left\`, \`width=320px\`) next to explanatory prose so paragraphs wrap around it.
- Place a full-width interactive demo \`position=below\` between two paragraphs of discussion.
- Chain multiple applets with text between them when each illustrates a distinct idea.

Only emit an applet when it adds genuine interactive or visual value — otherwise use plain markdown.

## Rich layout blocks

In addition to applets, AgentChat renders JSON-driven layout blocks for polished media-heavy replies (see the \`agentchat-layouts\` skill for full schemas):

- \`\`\`agentchat-hero\`\`\` — one large image + 1-2 stacked thumbnails (Wikipedia-style opener).
- \`\`\`agentchat-gallery\`\`\` — responsive grid of images (good for moodboards, comparisons).
- \`\`\`agentchat-carousel\`\`\` — horizontal scroller with arrows + counter (sequential browsing).
- \`\`\`agentchat-map\`\`\` — Leaflet map with rating-style pins \`[{lat, lng, label, rating}]\`.
- \`\`\`agentchat-card-list\`\`\` — vertical list of result cards (title, rating, category, status, body, thumbnail).
- \`\`\`agentchat-split\`\`\` — visual (image / mini-gallery / interactive applet) on one side, markdown prose on the other. Use when the text is a first-class partner to the visual.
- \`\`\`agentchat-terms\`\`\` — silent glossary block; pair with inline \`[[Label]]{#slug}\` markers to give key entities a click-to-open detail panel (hero images, summary, key facts, sources).

Use these blocks for images, maps, and structured results instead of plain markdown image lists. Load the \`agentchat-layouts\` skill for exact schemas and when-to-use guidance.`;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildMessageContent(msg: ChatMessage): string | ContentPart[] {
  const images = (msg.attachments ?? []).filter(
    (a) => a.type === "image" && typeof a.dataUrl === "string" && a.dataUrl.length > 0
  );
  if (images.length === 0) return msg.content;

  const parts: ContentPart[] = [];
  if (msg.content && msg.content.length > 0) {
    parts.push({ type: "text", text: msg.content });
  }
  for (const img of images) {
    parts.push({ type: "image_url", image_url: { url: img.dataUrl as string } });
  }
  return parts;
}

function buildMessages(
  history: ChatMessage[]
): Array<{ role: string; content: string | ContentPart[] }> {
  const withSystem: Array<{ role: string; content: string | ContentPart[] }> = [];
  const hasSystem = history.some((m) => m.role === "system");
  if (!hasSystem) {
    withSystem.push({ role: "system", content: AGENTCHAT_SYSTEM_PROMPT });
  }
  for (const msg of history) {
    withSystem.push({
      role: msg.role === "agent" ? "assistant" : msg.role,
      content: buildMessageContent(msg),
    });
  }
  return withSystem;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// --- Streaming helpers -----------------------------------------------------

interface SSEEvent {
  event: string;
  data: string;
}

/**
 * Parse a chunk of SSE text (possibly containing multiple events) and invoke
 * `onEvent` for each complete event. Returns leftover bytes that didn't end in
 * a blank-line boundary yet, to be prepended to the next chunk.
 */
function parseSSE(buffer: string, onEvent: (e: SSEEvent) => void): string {
  // Normalize CRLF → LF so the split works uniformly.
  const normalized = buffer.replace(/\r\n/g, "\n");
  const pieces = normalized.split("\n\n");
  // The last piece may be an incomplete event — keep it in the buffer.
  const leftover = pieces.pop() ?? "";

  for (const raw of pieces) {
    const block = raw.trim();
    if (!block) continue;

    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue; // comment / keepalive
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") eventName = value;
      else if (field === "data") dataLines.push(value);
    }

    if (dataLines.length === 0) continue;
    onEvent({ event: eventName, data: dataLines.join("\n") });
  }

  return leftover;
}

function extractReasoningFromDelta(delta: Record<string, unknown>): string {
  // OpenRouter puts streaming reasoning into delta.reasoning as text chunks.
  // Some providers use delta.reasoning_content.
  return (
    asString(delta.reasoning) ||
    asString(delta.reasoning_content) ||
    asString(delta.thinking)
  );
}

function formatToolDisplay(tool: string, label: string, emoji: string): string {
  const icon = emoji || "⚙";
  const name = tool.replace(/_/g, " ");
  if (label && label !== tool) return `${icon} ${name} — ${label}`;
  return `${icon} ${name}`;
}

/**
 * Stateful splitter that consumes streaming content and routes text inside
 * `<thinking>…</thinking>` / `<think>…</think>` / `<reasoning>…</reasoning>`
 * tags to the reasoning trace instead of the visible message body.
 *
 * Some models (Qwen, DeepSeek, local Ollama builds) emit raw thinking tags
 * inline with content instead of using structured reasoning fields. Without
 * this guard those tags appear as plain text in the bubble.
 *
 * The splitter holds a small lookback buffer so a tag that straddles a
 * chunk boundary is still matched.
 */
class ThinkingStripper {
  private mode: "content" | "thinking" = "content";
  private buffer = "";
  private static readonly OPEN_TAGS = /<(thinking|think|reasoning)>/i;
  private static readonly CLOSE_TAGS = /<\/(thinking|think|reasoning)>/i;
  private static readonly MAX_BUFFER = 32;

  push(
    chunk: string,
    onContent: (s: string) => void,
    onThinking: (s: string) => void
  ): void {
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (this.mode === "content") {
        const open = this.buffer.match(ThinkingStripper.OPEN_TAGS);
        if (!open || open.index === undefined) {
          // No open tag visible. Flush everything except a small tail
          // that might contain a partial tag across a chunk boundary.
          const safeLen = Math.max(0, this.buffer.length - ThinkingStripper.MAX_BUFFER);
          if (safeLen > 0) {
            onContent(this.buffer.slice(0, safeLen));
            this.buffer = this.buffer.slice(safeLen);
          }
          return;
        }
        if (open.index > 0) {
          onContent(this.buffer.slice(0, open.index));
        }
        this.buffer = this.buffer.slice(open.index + open[0].length);
        this.mode = "thinking";
      } else {
        const close = this.buffer.match(ThinkingStripper.CLOSE_TAGS);
        if (!close || close.index === undefined) {
          const safeLen = Math.max(0, this.buffer.length - ThinkingStripper.MAX_BUFFER);
          if (safeLen > 0) {
            onThinking(this.buffer.slice(0, safeLen));
            this.buffer = this.buffer.slice(safeLen);
          }
          return;
        }
        if (close.index > 0) {
          onThinking(this.buffer.slice(0, close.index));
        }
        this.buffer = this.buffer.slice(close.index + close[0].length);
        this.mode = "content";
      }
    }
  }

  flush(onContent: (s: string) => void, onThinking: (s: string) => void): void {
    if (!this.buffer) return;
    if (this.mode === "content") onContent(this.buffer);
    else onThinking(this.buffer);
    this.buffer = "";
  }
}

export class HermesInterface {
  private settings: AgentChatSettings;

  constructor(settings: AgentChatSettings) {
    this.settings = settings;
  }

  async sendMessage(
    messages: ChatMessage[],
    handlers: StreamHandlers,
    abortController?: AbortController
  ): Promise<void> {
    const controller = abortController ?? new AbortController();
    const signal = controller.signal;

    const gatewayUrl = getGatewayUrl(this.settings);
    const apiKey = getApiKey(this.settings);

    if (!gatewayUrl) {
      handlers.onError(
        new Error(
          "Hermes gateway URL not configured. Set it in AgentChat settings or ensure ~/.hermes/.env has API_SERVER_HOST and API_SERVER_PORT."
        )
      );
      return;
    }

    const body: Record<string, unknown> = {
      messages: buildMessages(messages),
      stream: true,
    };

    if (this.settings.model && this.settings.model !== "auto") {
      body.model = this.settings.model;
    }

    if (this.settings.effortLevel) {
      body.reasoning = { effort: this.settings.effortLevel, include_thoughts: true };
    } else {
      body.reasoning = { include_thoughts: true };
    }
    body.include_reasoning = true;

    try {
      await this.streamChatCompletion(gatewayUrl, apiKey, body, handlers, signal);
    } catch (error) {
      if (signal.aborted) {
        handlers.onComplete({});
        return;
      }
      const messageText = error instanceof Error ? error.message : String(error);
      handlers.onError(new Error(messageText));
    }
  }

  private streamChatCompletion(
    gatewayUrl: string,
    apiKey: string,
    body: Record<string, unknown>,
    handlers: StreamHandlers,
    signal: AbortSignal
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let url: URL;
      try {
        url = new URL(`${gatewayUrl}/chat/completions`);
      } catch (e) {
        reject(new Error(`Invalid gateway URL: ${gatewayUrl}`));
        return;
      }

      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const payload = JSON.stringify(body);

      const req = lib.request(
        {
          method: "POST",
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          headers: { ...headers, "Content-Length": Buffer.byteLength(payload) },
        },
        (res) => {
          const status = res.statusCode ?? 0;

          if (status < 200 || status >= 300) {
            let errBody = "";
            res.setEncoding("utf8");
            res.on("data", (c) => (errBody += c));
            res.on("end", () => {
              let message = errBody.trim();
              try {
                const parsed = JSON.parse(errBody);
                const err = asRecord(parsed)?.error;
                const errRec = asRecord(err);
                message = asString(errRec?.message) || message;
              } catch {
                /* not JSON */
              }
              const suffix = /invalid api key/i.test(message)
                ? " Check your Hermes gateway key."
                : "";
              reject(
                new Error(
                  message
                    ? `Gateway error (${status}): ${message}${suffix}`
                    : `Gateway returned HTTP ${status}.${suffix}`
                )
              );
            });
            return;
          }

          res.setEncoding("utf8");

          let buffer = "";
          let collectedText = "";
          let collectedReasoning = "";
          let finalUsage: Record<string, unknown> | null = null;
          let finalModel: string | null = null;
          const seenToolIds = new Set<string>();
          let toolCounter = 0;
          const stripper = new ThinkingStripper();

          const pushContent = (text: string) => {
            if (!text) return;
            stripper.push(
              text,
              (visible) => {
                collectedText += visible;
                handlers.onToken(visible);
              },
              (thought) => {
                collectedReasoning += thought;
                handlers.onThinking(collectedReasoning);
              }
            );
          };

          const handleEvent = (evt: SSEEvent) => {
            if (evt.event === "hermes.tool.progress") {
              // Custom Hermes event — tool started executing.
              try {
                const payload = JSON.parse(evt.data) as Record<string, unknown>;
                const toolName = asString(payload.tool);
                if (!toolName) return;
                // De-dupe: same tool firing repeatedly in sequence gets one entry per call.
                const id = `tool_${++toolCounter}_${toolName}`;
                if (seenToolIds.has(id)) return;
                seenToolIds.add(id);

                const emoji = asString(payload.emoji);
                const label = asString(payload.label);
                const toolCall: ToolCall = {
                  id,
                  name: toolName,
                  arguments: { label, emoji },
                  status: "running",
                  result: formatToolDisplay(toolName, label, emoji),
                };
                handlers.onToolCall(toolCall);
              } catch {
                /* ignore malformed */
              }
              return;
            }

            // Default `data:` event — OpenAI-style chunk.
            if (evt.data === "[DONE]") return;

            let parsed: unknown;
            try {
              parsed = JSON.parse(evt.data);
            } catch {
              return;
            }

            const root = asRecord(parsed);
            if (!root) return;

            // Capture model + usage if provided on any chunk.
            const m = asString(root.model);
            if (m) finalModel = m;
            const usage = asRecord(root.usage);
            if (usage) finalUsage = usage;

            const choices = root.choices;
            if (!Array.isArray(choices) || choices.length === 0) return;
            const choice = asRecord(choices[0]);
            if (!choice) return;

            const delta = asRecord(choice.delta);
            if (!delta) return;

            const reasoning = extractReasoningFromDelta(delta);
            if (reasoning) {
              collectedReasoning += reasoning;
              handlers.onThinking(collectedReasoning);
            }

            const content = delta.content;
            if (typeof content === "string" && content.length > 0) {
              pushContent(content);
            } else if (Array.isArray(content)) {
              // Some providers stream content as an array of {type, text} blocks.
              for (const block of content) {
                const rec = asRecord(block);
                if (!rec) continue;
                const type = asString(rec.type);
                const text = asString(rec.text);
                if (!text) continue;
                if (type === "thinking" || type === "reasoning") {
                  collectedReasoning += text;
                  handlers.onThinking(collectedReasoning);
                } else {
                  pushContent(text);
                }
              }
            }
          };

          res.on("data", (chunk: string) => {
            if (signal.aborted) {
              req.destroy();
              return;
            }
            buffer += chunk;
            buffer = parseSSE(buffer, handleEvent);
          });

          res.on("end", () => {
            // Flush any trailing event.
            if (buffer.trim()) {
              parseSSE(buffer + "\n\n", handleEvent);
              buffer = "";
            }

            // Flush any content held back by the thinking-tag splitter.
            stripper.flush(
              (visible) => {
                collectedText += visible;
                handlers.onToken(visible);
              },
              (thought) => {
                collectedReasoning += thought;
                handlers.onThinking(collectedReasoning);
              }
            );

            if (signal.aborted) {
              handlers.onComplete({});
              resolve();
              return;
            }

            if (!collectedText.trim() && !collectedReasoning.trim()) {
              reject(new Error("Gateway returned an empty response."));
              return;
            }

            const promptTokens =
              typeof finalUsage?.prompt_tokens === "number"
                ? (finalUsage.prompt_tokens as number)
                : typeof finalUsage?.input_tokens === "number"
                ? (finalUsage.input_tokens as number)
                : undefined;
            const completionTokens =
              typeof finalUsage?.completion_tokens === "number"
                ? (finalUsage.completion_tokens as number)
                : typeof finalUsage?.output_tokens === "number"
                ? (finalUsage.output_tokens as number)
                : undefined;

            const totalTokens =
              promptTokens != null && completionTokens != null
                ? promptTokens + completionTokens
                : estimateTokens(collectedText);

            handlers.onComplete({
              model: finalModel || this.settings.model || "unknown",
              tokensUsed: totalTokens,
            });
            resolve();
          });

          res.on("error", (err) => {
            if (signal.aborted) {
              resolve();
              return;
            }
            reject(err);
          });
        }
      );

      req.on("error", (err) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        reject(err);
      });

      const onAbort = () => {
        req.destroy();
      };
      if (signal.aborted) {
        req.destroy();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      req.write(payload);
      req.end();
    });
  }
}

// Kept for backwards compatibility with existing imports.
export function parseModelFromResponse(
  headers: Record<string, string>
): string {
  return headers["x-model"] || headers["model"] || "unknown";
}

// Silence unused-import warning for generateId (kept to match prior exports surface).
void generateId;
