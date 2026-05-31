/**
 * LLM provider 抽象（vendor-neutral）。
 *
 * 對話模組只依賴此介面，不 import 任何廠商 SDK；
 * 訊息用 text / tool_use / tool_result 區塊、工具用 JSON Schema，方便日後換 OpenAI/Azure/local。
 */

export interface LLMTool {
  name: string;
  description: string;
  /** JSON Schema（標準），描述工具參數 */
  inputSchema: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: LLMContentBlock[];
}

export interface LLMCreateParams {
  system: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  maxTokens?: number;
  /** 啟用 system + tools 的 prompt caching */
  cache?: boolean;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}

export interface LLMResult {
  text: string;
  toolCalls: LLMToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'other';
  usage?: LLMUsage;
}

export interface LLMProvider {
  readonly name: string;
  createMessage(params: LLMCreateParams): Promise<LLMResult>;
}
