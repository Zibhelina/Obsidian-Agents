/**
 * Minimal read/write helpers for the `approvals.mode` field in
 * `~/.hermes/config.yaml`. We intentionally do NOT pull in a full YAML
 * library — the Hermes config file is simple enough that a targeted regex
 * rewrite of the `approvals:` block is safer (preserves comments + field
 * order) than round-tripping through a YAML parser.
 *
 * The valid values mirror Hermes itself:
 *   - manual — always prompt the user (default, no auto-approve)
 *   - smart  — LLM auto-approves low-risk commands, prompts for high-risk
 *   - off    — skip all approval prompts (equivalent to --yolo)
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ApprovalMode } from "../types";

const HERMES_CONFIG_PATH = join(homedir(), ".hermes", "config.yaml");

const VALID_MODES: ReadonlySet<ApprovalMode> = new Set(["manual", "smart", "off"]);

export function getHermesConfigPath(): string {
  return HERMES_CONFIG_PATH;
}

export function hermesConfigExists(): boolean {
  try {
    return existsSync(HERMES_CONFIG_PATH);
  } catch {
    return false;
  }
}

export function readApprovalMode(): ApprovalMode | null {
  if (!hermesConfigExists()) return null;
  let text: string;
  try {
    text = readFileSync(HERMES_CONFIG_PATH, "utf-8");
  } catch {
    return null;
  }
  // Match a `mode:` key nested under `approvals:` at any indentation.
  const match = text.match(/^approvals\s*:\s*\n(?:\s*#[^\n]*\n)*(\s+)mode\s*:\s*['"]?([a-zA-Z]+)['"]?/m);
  if (!match) return null;
  const value = match[2].toLowerCase();
  return VALID_MODES.has(value as ApprovalMode) ? (value as ApprovalMode) : null;
}

/**
 * Rewrite the `approvals.mode` value in-place. Preserves surrounding
 * comments, indentation, and sibling fields. Creates the file (and
 * `approvals:` block) only if they don't already exist.
 *
 * Throws on I/O error — callers should surface a Notice.
 */
export function writeApprovalMode(mode: ApprovalMode): void {
  if (!VALID_MODES.has(mode)) {
    throw new Error(`Invalid approval mode: ${mode}`);
  }

  let text = "";
  if (hermesConfigExists()) {
    text = readFileSync(HERMES_CONFIG_PATH, "utf-8");
  }

  // Case 1: approvals block exists with a `mode:` inside — replace it.
  const modeRegex =
    /(^approvals\s*:\s*\n(?:\s*#[^\n]*\n)*)(\s+)mode\s*:\s*['"]?[a-zA-Z]+['"]?/m;
  if (modeRegex.test(text)) {
    text = text.replace(modeRegex, (_, header, indent) => `${header}${indent}mode: ${mode}`);
  } else if (/^approvals\s*:/m.test(text)) {
    // Case 2: approvals block exists but no `mode:` — insert on next line.
    text = text.replace(/^(approvals\s*:\s*\n)/m, `$1  mode: ${mode}\n`);
  } else {
    // Case 3: no approvals block — append one.
    if (text.length > 0 && !text.endsWith("\n")) text += "\n";
    text += `\napprovals:\n  mode: ${mode}\n`;
  }

  writeFileSync(HERMES_CONFIG_PATH, text, "utf-8");
}
