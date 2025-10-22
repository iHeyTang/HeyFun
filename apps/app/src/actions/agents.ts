/**
 * Agent 相关的 Server Actions
 */

'use server';

import { getAgent } from '@/agents/server';

/**
 * 获取 Agent 配置
 */
export async function getAgentConfig(agentId?: string) {
  try {
    const config = getAgent(agentId);
    return {
      success: true,
      data: config,
    };
  } catch (error) {
    console.error('Error getting agent config:', error);
    return {
      success: false,
      error: 'Failed to get agent config',
    };
  }
}

