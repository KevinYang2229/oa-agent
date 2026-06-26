/**
 * 測試環境前置：在任何模組 import `@/config/env` 之前補上必要環境變數。
 *
 * env.ts 於載入時 safeParse(process.env)，缺 ANTHROPIC_API_KEY 會 process.exit(1)。
 * jest 會自動把 NODE_ENV 設為 'test'，故 production 守門（dev 預設密鑰 fail-fast）不會觸發。
 */
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key';
