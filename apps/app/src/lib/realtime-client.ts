'use client';

import { createRealtime } from '@upstash/realtime/client';
import type { RealtimeEvents } from './realtime';

// 直接导出，使用类型断言避免 TypeScript 类型推断问题
export const useRealtime = createRealtime<RealtimeEvents>().useRealtime as unknown as <const E extends string>(opts: {
  events?: readonly E[];
  onData?: (arg: { event: E; data: any; channel: string }) => void;
  channel: string;
  enabled?: boolean;
}) => { status: 'connected' | 'disconnected' | 'error' | 'connecting' };
