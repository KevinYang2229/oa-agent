import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // MVP：以 in-memory session 運作，DB/JWT 先給預設值（之後接 Prisma 再收緊）
  DATABASE_URL: z.string().default('postgresql://localhost:5432/oa_agent'),

  JWT_ACCESS_SECRET: z.string().min(32).default('dev-access-secret-please-change-32chars'),
  JWT_REFRESH_SECRET: z.string().min(32).default('dev-refresh-secret-please-change-32char'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('*'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('App <noreply@example.com>'),

  // ---- LLM provider（可抽換層；MVP 預設 anthropic）----
  LLM_PROVIDER: z.enum(['anthropic']).default('anthropic'),
  LLM_MODEL: z.string().default('claude-sonnet-4-5'),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  ANTHROPIC_API_KEY: z.string().default(''),

  // ---- OA 連接器（MVP 預設 stub）----
  OA_CONNECTOR: z.enum(['stub']).default('stub'),
  OA_BASE_URL: z.string().optional(),
  OA_API_KEY: z.string().optional(),
}).superRefine((val, ctx) => {
  // provider=anthropic 時必須有 API key，boot 時 fail-fast
  if (val.LLM_PROVIDER === 'anthropic' && !val.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ANTHROPIC_API_KEY'],
      message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
