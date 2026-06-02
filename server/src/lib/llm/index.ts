/**
 * LLM provider 工廠：依 env.LLM_PROVIDER 選擇實作（singleton）。
 */
import { env } from '@/config/env';
import { anthropicProvider } from './anthropic.provider';
import { openaiProvider } from './openai.provider';
import type { LLMProvider } from './types';

export function getLLMProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case 'anthropic':
      return anthropicProvider;
    case 'openai':
      return openaiProvider;
    default:
      throw new Error(`Unsupported LLM provider: ${env.LLM_PROVIDER as string}`);
  }
}

export * from './types';
