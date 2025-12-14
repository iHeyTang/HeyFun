/**
 * 性能分析微代理
 *
 * 在迭代后分析性能指标，提供优化建议
 * 适用于所有场景，帮助优化 Agent 性能
 */

import type { IMicroAgent, MicroAgentContext, MicroAgentResult, MicroAgentConfig } from './types';
import { MicroAgentTrigger } from './types';

/**
 * 性能分析结果
 */
export interface PerformanceAnalysisResult {
  tokenUsage: {
    total: number;
    prompt: number;
    completion: number;
    cost?: number;
  };
  iterationCount: number;
  toolCallCount: number;
  averageResponseTime?: number;
  suggestions: Array<{
    type: 'token_optimization' | 'context_compression' | 'tool_optimization' | 'model_selection';
    priority: 'high' | 'medium' | 'low';
    message: string;
    action?: string;
  }>;
  score: number; // 性能分数 0-100
}

/**
 * 性能分析微代理
 */
export class PerformanceMicroAgent implements IMicroAgent {
  readonly config: MicroAgentConfig;
  private performanceHistory: Array<{
    timestamp: number;
    tokenUsage: { prompt: number; completion: number; total: number };
    iterationCount: number;
    toolCallCount: number;
  }> = [];

  constructor(options?: { enabled?: boolean; priority?: number }) {
    this.config = {
      id: 'performance-analysis',
      name: '性能分析',
      description: '分析 Agent 性能指标，提供优化建议',
      trigger: MicroAgentTrigger.POST_ITERATION,
      enabled: options?.enabled !== false,
      priority: options?.priority ?? 150, // 较低优先级，在最后执行
    };
  }

  async shouldExecute(_context: MicroAgentContext): Promise<boolean> {
    // 每次迭代后都执行性能分析
    return true;
  }

  async execute(context: MicroAgentContext): Promise<MicroAgentResult> {
    try {
      const iteration = context.iteration || 0;
      const messages = context.messages || [];

      // 统计工具调用次数
      const toolCallCount = messages.filter((msg: any) => {
        return msg.content && Array.isArray(msg.content) && msg.content.some((item: any) => item.type === 'tool_use');
      }).length;

      // 从上下文元数据中提取 token 使用情况
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let totalCost = 0;

      // 尝试从消息元数据中提取 token 使用情况
      messages.forEach((msg: any) => {
        const usage = msg.response_metadata?.usage || msg.usage_metadata || msg.tokenUsage;
        if (usage) {
          totalPromptTokens += usage.prompt_tokens || usage.input_tokens || usage.promptTokens || 0;
          totalCompletionTokens += usage.completion_tokens || usage.output_tokens || usage.completionTokens || 0;
          totalCost += usage.cost || 0;
        }
      });

      const totalTokens = totalPromptTokens + totalCompletionTokens;

      // 记录性能数据
      this.performanceHistory.push({
        timestamp: Date.now(),
        tokenUsage: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalTokens,
        },
        iterationCount: iteration,
        toolCallCount,
      });

      // 只保留最近 10 次记录
      if (this.performanceHistory.length > 10) {
        this.performanceHistory.shift();
      }

      // 生成性能分析建议
      const suggestions = this.generateSuggestions({
        tokenUsage: {
          total: totalTokens,
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          cost: totalCost,
        },
        iterationCount: iteration,
        toolCallCount,
        messageCount: messages.length,
      });

      // 计算性能分数（基于 token 使用效率和工具调用效率）
      const score = this.calculatePerformanceScore({
        tokenUsage: totalTokens,
        iterationCount: iteration,
        toolCallCount,
        messageCount: messages.length,
      });

      const result: PerformanceAnalysisResult = {
        tokenUsage: {
          total: totalTokens,
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          cost: totalCost,
        },
        iterationCount: iteration,
        toolCallCount,
        suggestions,
        score,
      };

      // 只在有建议或性能问题时记录日志
      if (suggestions.length > 0 || score < 70) {
        console.log(`[PerformanceMicroAgent] 📊 性能分析 (迭代 ${iteration}):`);
        console.log(`  Token 使用: ${totalTokens} (Prompt: ${totalPromptTokens}, Completion: ${totalCompletionTokens})`);
        console.log(`  工具调用: ${toolCallCount} 次`);
        console.log(`  性能分数: ${score}/100`);
        if (suggestions.length > 0) {
          console.log(`  优化建议: ${suggestions.length} 条`);
          suggestions.forEach((suggestion, idx) => {
            console.log(`    ${idx + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.message}`);
          });
        }
      }

      return {
        success: true,
        data: result,
        tokenUsage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens,
          cost: totalCost,
        },
        metadata: {
          performance: result,
        },
      };
    } catch (error) {
      console.error('[PerformanceMicroAgent] ❌ 性能分析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: {
          tokenUsage: { total: 0, prompt: 0, completion: 0 },
          iterationCount: 0,
          toolCallCount: 0,
          suggestions: [],
          score: 0,
        } as PerformanceAnalysisResult,
      };
    }
  }

  /**
   * 生成性能优化建议
   */
  private generateSuggestions(metrics: {
    tokenUsage: { total: number; prompt: number; completion: number; cost?: number };
    iterationCount: number;
    toolCallCount: number;
    messageCount: number;
  }): PerformanceAnalysisResult['suggestions'] {
    const suggestions: PerformanceAnalysisResult['suggestions'] = [];

    // Token 使用优化建议
    if (metrics.tokenUsage.total > 10000) {
      suggestions.push({
        type: 'token_optimization',
        priority: 'high',
        message: `Token 使用量较高 (${metrics.tokenUsage.total})，建议压缩上下文或使用更短的提示词`,
        action: '考虑启用上下文压缩微代理',
      });
    } else if (metrics.tokenUsage.total > 5000) {
      suggestions.push({
        type: 'token_optimization',
        priority: 'medium',
        message: `Token 使用量中等 (${metrics.tokenUsage.total})，可以进一步优化`,
        action: '检查是否有冗余的提示词片段',
      });
    }

    // 工具调用优化建议
    if (metrics.toolCallCount > 10) {
      suggestions.push({
        type: 'tool_optimization',
        priority: 'medium',
        message: `工具调用次数较多 (${metrics.toolCallCount})，可能存在重复调用`,
        action: '检查工具调用逻辑，避免重复调用',
      });
    }

    // 迭代次数优化建议
    if (metrics.iterationCount > 5) {
      suggestions.push({
        type: 'context_compression',
        priority: 'medium',
        message: `迭代次数较多 (${metrics.iterationCount})，建议压缩上下文`,
        action: '启用上下文压缩微代理',
      });
    }

    // 消息数量优化建议
    if (metrics.messageCount > 30) {
      suggestions.push({
        type: 'context_compression',
        priority: 'high',
        message: `消息数量较多 (${metrics.messageCount})，上下文可能过长`,
        action: '启用上下文压缩微代理，提取关键信息',
      });
    }

    return suggestions;
  }

  /**
   * 计算性能分数
   */
  private calculatePerformanceScore(metrics: { tokenUsage: number; iterationCount: number; toolCallCount: number; messageCount: number }): number {
    let score = 100;

    // Token 使用惩罚（超过 5000 开始扣分）
    if (metrics.tokenUsage > 5000) {
      score -= Math.min(30, (metrics.tokenUsage - 5000) / 200);
    }

    // 迭代次数惩罚（超过 3 次开始扣分）
    if (metrics.iterationCount > 3) {
      score -= Math.min(20, (metrics.iterationCount - 3) * 5);
    }

    // 工具调用次数惩罚（超过 5 次开始扣分）
    if (metrics.toolCallCount > 5) {
      score -= Math.min(20, (metrics.toolCallCount - 5) * 3);
    }

    // 消息数量惩罚（超过 20 条开始扣分）
    if (metrics.messageCount > 20) {
      score -= Math.min(30, (metrics.messageCount - 20) / 2);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 获取性能历史统计
   */
  getPerformanceHistory(): PerformanceAnalysisResult['tokenUsage'][] {
    return this.performanceHistory.map((h) => h.tokenUsage);
  }
}
