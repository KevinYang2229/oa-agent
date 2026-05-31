/**
 * OA 連接器工廠：依 env.OA_CONNECTOR 選擇實作。MVP 預設 stub。
 */
import { env } from '@/config/env';
import { stubOAConnector } from './stub.connector';
import type { OAConnector } from './types';

export function getOAConnector(): OAConnector {
  switch (env.OA_CONNECTOR) {
    case 'stub':
      return stubOAConnector;
    default:
      throw new Error(`Unsupported OA connector: ${env.OA_CONNECTOR as string}`);
  }
}

export * from './types';
