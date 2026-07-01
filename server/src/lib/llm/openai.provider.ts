/**
 * OpenAI provider 實作：Chat Completions + function calling。
 *
 * 將本地 vendor-neutral 的 LLM* 型別（text / tool_use / tool_result 區塊）
 * 轉成 OpenAI 的 messages（system / user / assistant.tool_calls / tool）格式。
 * OpenAI 會自動做 prompt caching，故 params.cache 不需特別處理。
 */
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { env } from '@/config/env';
import type {
  LLMCreateParams,
  LLMMessage,
  LLMProvider,
  LLMResult,
  LLMToolCall,
} from './types';

// 延遲建立：OpenAI SDK 在無 key 時建構就拋錯，故不可在模組載入時 new
// （否則即使 provider=anthropic，靜態 import 也會因空 key 讓伺服器啟動失敗）。
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

/** 寬鬆解析工具參數（OpenAI 以 JSON 字串回傳 arguments） */
function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 將本地訊息結構攤平成 OpenAI messages（tool_result → role:'tool'） */
function toOpenAIMessages(system: string, messages: LLMMessage[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [{ role: 'system', content: system }];

  for (const m of messages) {
    if (m.role === 'assistant') {
      let text = '';
      const toolCalls: NonNullable<
        Extract<ChatCompletionMessageParam, { role: 'assistant' }>['tool_calls']
      > = [];
      for (const b of m.content) {
        if (b.type === 'text') text += b.text;
        else if (b.type === 'tool_use') {
          toolCalls.push({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          });
        }
      }
      out.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    } else {
      // user 訊息可能含 text（真使用者輸入）與／或 tool_result（工具輸出）
      const texts: string[] = [];
      for (const b of m.content) {
        if (b.type === 'tool_result') {
          out.push({ role: 'tool', tool_call_id: b.toolUseId, content: b.content });
        } else if (b.type === 'text') {
          texts.push(b.text);
        }
      }
      if (texts.length > 0) out.push({ role: 'user', content: texts.join('\n') });
    }
  }

  return out;
}

const STOP_MAP: Record<string, LLMResult['stopReason']> = {
  stop: 'end_turn',
  tool_calls: 'tool_use',
  length: 'max_tokens',
};

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async createMessage(params: LLMCreateParams): Promise<LLMResult> {
    const tools: ChatCompletionTool[] = (params.tools ?? []).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const resp = await getClient().chat.completions.create({
      model: params.model ?? env.LLM_MODEL,
      max_tokens: params.maxTokens ?? env.LLM_MAX_TOKENS,
      messages: toOpenAIMessages(params.system, params.messages),
      tools: tools.length > 0 ? tools : undefined,
    });

    const choice = resp.choices[0];
    const message = choice?.message;
    const text = message?.content ?? '';

    const toolCalls: LLMToolCall[] = (message?.tool_calls ?? [])
      .filter((tc) => tc.type === 'function')
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: parseArgs(tc.function.arguments),
      }));

    return {
      text,
      toolCalls,
      stopReason: STOP_MAP[choice?.finish_reason ?? ''] ?? 'other',
      usage: {
        inputTokens: resp.usage?.prompt_tokens ?? 0,
        outputTokens: resp.usage?.completion_tokens ?? 0,
        cacheReadTokens: resp.usage?.prompt_tokens_details?.cached_tokens ?? undefined,
      },
    };
  },
};
