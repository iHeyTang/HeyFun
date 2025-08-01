import { BaseAgent, BaseAgentConfig, ReActAgentEvents } from './base';

export interface ReActAgentConfig extends BaseAgentConfig {
  // ReActAgent特有配置可以在这里扩展
}

/**
 * Abstract ReAct (Reasoning and Acting) Agent
 * 实现思考-行动循环模式的抽象代理类
 */
export abstract class ReActAgent extends BaseAgent {
  // Token计数器，用于跟踪每个步骤的token使用情况
  private preStepInputTokens: number = 0;
  private preStepCompletionTokens: number = 0;

  constructor(config: ReActAgentConfig) {
    super(config);
  }

  /**
   * Think phase - 处理当前状态并决定下一步行动
   * 必须由子类实现
   */
  public abstract think(): Promise<boolean>;

  /**
   * Act phase - 执行决定的行动
   * 必须由子类实现
   */
  public abstract act(): Promise<string>;

  /**
   * Execute a single step: think and act.
   * 执行单个步骤：思考和行动的完整流程
   */
  public async step(): Promise<string> {
    try {
      // Step开始事件
      this.emit(ReActAgentEvents.STEP_START, {});

      // Think阶段开始
      this.emit(ReActAgentEvents.THINK_START, {});

      const shouldAct = await this.think();

      // 计算Think阶段的token使用量
      const totalInputTokens = this.llm.totalInputTokens;
      const totalCompletionTokens = this.llm.totalCompletionTokens;
      const inputTokens = totalInputTokens - this.preStepInputTokens;
      const completionTokens = totalCompletionTokens - this.preStepCompletionTokens;

      this.emit(ReActAgentEvents.THINK_TOKEN_COUNT, {
        input: inputTokens,
        completion: completionTokens,
        total_input: totalInputTokens,
        total_completion: totalCompletionTokens,
      });

      // 更新token计数器
      this.preStepInputTokens = totalInputTokens;
      this.preStepCompletionTokens = totalCompletionTokens;

      this.emit(ReActAgentEvents.THINK_COMPLETE, {});

      // 如果不需要执行行动且没有终止标志，直接返回
      if (!shouldAct && !this.should_terminate) {
        return 'Thinking complete - no action needed';
      }

      // Act阶段开始
      this.emit(ReActAgentEvents.ACT_START, {});

      const result = await this.act();

      // 计算Act阶段的token使用量
      const finalInputTokens = this.llm.totalInputTokens;
      const finalCompletionTokens = this.llm.totalCompletionTokens;
      const actInputTokens = finalInputTokens - this.preStepInputTokens;
      const actCompletionTokens = finalCompletionTokens - this.preStepCompletionTokens;

      this.emit(ReActAgentEvents.ACT_TOKEN_COUNT, {
        input: actInputTokens,
        completion: actCompletionTokens,
        total_input: finalInputTokens,
        total_completion: finalCompletionTokens,
      });

      // 更新token计数器
      this.preStepInputTokens = finalInputTokens;
      this.preStepCompletionTokens = finalCompletionTokens;

      this.emit(ReActAgentEvents.ACT_COMPLETE, {});
      this.emit(ReActAgentEvents.STEP_COMPLETE, {});

      return result;
    } catch (error) {
      this.emit(ReActAgentEvents.STEP_ERROR, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}
