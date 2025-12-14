/**
 * 微代理管理器
 *
 * 负责注册、管理和调度微代理
 */

import type { IMicroAgent, MicroAgentContext, MicroAgentResult, MicroAgentTrigger, MicroAgentRegistration } from './types';

export class MicroAgentManager {
  private agents: Map<string, MicroAgentRegistration> = new Map();
  private triggerMap: Map<MicroAgentTrigger, IMicroAgent[]> = new Map();

  /**
   * 注册微代理
   */
  register(agent: IMicroAgent): void {
    if (this.agents.has(agent.config.id)) {
      console.warn(`[MicroAgentManager] ⚠️ 微代理 ${agent.config.id} 已存在，将被覆盖`);
    }

    const registration: MicroAgentRegistration = {
      agent,
      registeredAt: Date.now(),
      executionCount: 0,
    };

    this.agents.set(agent.config.id, registration);

    // 注册到触发映射
    const triggers = Array.isArray(agent.config.trigger) ? agent.config.trigger : [agent.config.trigger];
    for (const triggerType of triggers) {
      if (!this.triggerMap.has(triggerType)) {
        this.triggerMap.set(triggerType, []);
      }
      this.triggerMap.get(triggerType)!.push(agent);
    }

    // 按优先级排序
    for (const [, agents] of this.triggerMap.entries()) {
      agents.sort((a, b) => {
        const priorityA = a.config.priority ?? 100;
        const priorityB = b.config.priority ?? 100;
        return priorityA - priorityB;
      });
    }

    console.log(`[MicroAgentManager] ✅ 已注册微代理: ${agent.config.id} (${agent.config.name})`);
  }

  /**
   * 注销微代理
   */
  unregister(agentId: string): void {
    const registration = this.agents.get(agentId);
    if (!registration) {
      console.warn(`[MicroAgentManager] ⚠️ 微代理 ${agentId} 不存在`);
      return;
    }

    const agent = registration.agent;
    const triggers = Array.isArray(agent.config.trigger) ? agent.config.trigger : [agent.config.trigger];

    // 从触发映射中移除
    for (const trigger of triggers) {
      const agents = this.triggerMap.get(trigger);
      if (agents) {
        const index = agents.indexOf(agent);
        if (index >= 0) {
          agents.splice(index, 1);
        }
      }
    }

    this.agents.delete(agentId);
    console.log(`[MicroAgentManager] 🗑️ 已注销微代理: ${agentId}`);
  }

  /**
   * 获取微代理
   */
  getAgent(agentId: string): IMicroAgent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  /**
   * 获取所有微代理
   */
  getAllAgents(): IMicroAgent[] {
    return Array.from(this.agents.values()).map((reg) => reg.agent);
  }

  /**
   * 获取指定触发时机的微代理列表
   */
  getAgentsByTrigger(trigger: MicroAgentTrigger): IMicroAgent[] {
    return this.triggerMap.get(trigger)?.filter((agent) => agent.config.enabled !== false) ?? [];
  }

  /**
   * 执行指定触发时机的所有微代理
   * @param trigger 触发时机
   * @param context 执行上下文
   * @returns 所有微代理的执行结果
   */
  async executeByTrigger(trigger: MicroAgentTrigger, context: MicroAgentContext): Promise<MicroAgentResult[]> {
    const agents = this.getAgentsByTrigger(trigger);
    if (agents.length === 0) {
      return [];
    }

    console.log(`[MicroAgentManager] 🔄 执行 ${trigger} 时机的 ${agents.length} 个微代理`);

    const results: MicroAgentResult[] = [];

    // 按顺序执行（因为可能有依赖关系）
    for (const agent of agents) {
      try {
        // 检查是否应该执行
        if (agent.shouldExecute && !(await agent.shouldExecute(context))) {
          console.log(`[MicroAgentManager] ⏭️ 微代理 ${agent.config.id} 跳过执行`);
          continue;
        }

        // 执行微代理
        const result = await agent.execute(context);
        results.push(result);

        // 更新统计信息
        const registration = this.agents.get(agent.config.id);
        if (registration) {
          registration.executionCount++;
          registration.lastExecutedAt = Date.now();
        }

        // 如果微代理返回错误，记录但不中断其他微代理的执行
        if (!result.success) {
          console.error(`[MicroAgentManager] ❌ 微代理 ${agent.config.id} 执行失败:`, result.error);
        } else {
          console.log(`[MicroAgentManager] ✅ 微代理 ${agent.config.id} 执行成功`);
        }
      } catch (error) {
        console.error(`[MicroAgentManager] ❌ 微代理 ${agent.config.id} 执行异常:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * 执行指定的微代理（按需执行）
   */
  async executeAgent(agentId: string, context: MicroAgentContext): Promise<MicroAgentResult | null> {
    const registration = this.agents.get(agentId);
    if (!registration) {
      console.warn(`[MicroAgentManager] ⚠️ 微代理 ${agentId} 不存在`);
      return null;
    }

    const agent = registration.agent;

    // 检查是否启用
    if (agent.config.enabled === false) {
      console.log(`[MicroAgentManager] ⏭️ 微代理 ${agentId} 已禁用`);
      return null;
    }

    try {
      // 检查是否应该执行
      if (agent.shouldExecute && !(await agent.shouldExecute(context))) {
        console.log(`[MicroAgentManager] ⏭️ 微代理 ${agentId} 跳过执行`);
        return null;
      }

      // 执行微代理
      const result = await agent.execute(context);

      // 更新统计信息
      registration.executionCount++;
      registration.lastExecutedAt = Date.now();

      return result;
    } catch (error) {
      console.error(`[MicroAgentManager] ❌ 微代理 ${agentId} 执行异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取微代理统计信息
   */
  getStats(): Record<string, { executionCount: number; lastExecutedAt?: number }> {
    const stats: Record<string, { executionCount: number; lastExecutedAt?: number }> = {};
    for (const [id, registration] of this.agents.entries()) {
      stats[id] = {
        executionCount: registration.executionCount,
        lastExecutedAt: registration.lastExecutedAt,
      };
    }
    return stats;
  }

  /**
   * 清理所有微代理资源
   */
  async cleanup(): Promise<void> {
    console.log(`[MicroAgentManager] 🧹 清理 ${this.agents.size} 个微代理`);
    for (const registration of this.agents.values()) {
      if (registration.agent.cleanup) {
        try {
          await registration.agent.cleanup();
        } catch (error) {
          console.error(`[MicroAgentManager] ❌ 清理微代理 ${registration.agent.config.id} 失败:`, error);
        }
      }
    }
  }
}

// 导出单例
export const microAgentManager = new MicroAgentManager();

