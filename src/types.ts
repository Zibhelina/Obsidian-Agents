export interface ChatSession {
  id: string;
  name: string;
  folderId: string | null;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
}

export interface SessionFolder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  attachments: Attachment[];
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface Attachment {
  id: string;
  type: "image" | "file" | "pdf";
  name: string;
  path: string;
  dataUrl?: string;
}

export interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  tokensTotal?: number;
  durationMs?: number;
  thinking?: string;
  toolCalls?: ToolCall[];
}

export type LayoutPosition = "left" | "right" | "above" | "below" | "inline";

export interface LayoutBlock {
  type: "text" | "image" | "applet";
  content: string;
  position: LayoutPosition;
  width?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "accepted" | "denied" | "running" | "completed" | "failed";
  result?: string;
}

export interface PendingPermission {
  toolCall: ToolCall;
  resolve: (decision: PermissionDecision) => void;
}

export type PermissionDecision =
  | { action: "accept" }
  | { action: "deny" }
  | { action: "explain"; reason: string };

export type ApprovalMode = "manual" | "smart" | "off";

export interface AgentChatSettings {
  agentName: string;
  model: string;
  effortLevel: "low" | "medium" | "high";
  hermesGatewayUrl: string;
  hermesApiKey: string;
  contextWindow: number;
  approvalMode: ApprovalMode;
}

export const DEFAULT_SETTINGS: AgentChatSettings = {
  agentName: "Hermes",
  model: "auto",
  effortLevel: "medium",
  hermesGatewayUrl: "",
  hermesApiKey: "",
  contextWindow: 128000,
  approvalMode: "manual",
};

export interface MentionItem {
  type: "file" | "folder";
  path: string;
  displayName: string;
}

export interface StreamHandlers {
  onStart?: (info: { userMsg: ChatMessage; agentMsg: ChatMessage }) => void;
  onToken: (token: string) => void;
  onThinking: (thinking: string) => void;
  onToolCall: (toolCall: ToolCall) => void;
  onLayoutBlock: (block: LayoutBlock) => void;
  onComplete: (metadata: Partial<MessageMetadata>) => void;
  onError: (error: Error) => void;
}
