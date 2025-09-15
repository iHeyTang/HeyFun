import { ToolExecutionProgress, ToolSelectionProgress } from '../tools/toolcall';
import { AgentState, BaseAgent, BaseAgentConfig, ReActAgentEvents, StepResult } from './base';

export interface ReActAgentConfig extends BaseAgentConfig {
  // ReActAgent特有配置可以在这里扩展
}

export type StepProgress =
  | {
      phase: typeof ReActAgentEvents.STEP_START;
      data: {};
    }
  | {
      phase: typeof ReActAgentEvents.THINK_START;
      data: {};
    }
  | {
      phase: typeof ReActAgentEvents.THINK_COMPLETE;
      data: {};
    }
  | {
      phase: typeof ReActAgentEvents.ACT_START;
      data: {};
    }
  | {
      phase: typeof ReActAgentEvents.ACT_COMPLETE;
      data: {};
    }
  | {
      phase: typeof ReActAgentEvents.STEP_COMPLETE;
      data: {};
    }
  | {
      phase: typeof ReActAgentEvents.THINK_TOKEN_COUNT;
      data: {
        input: number;
        completion: number;
        total_input: number;
        total_completion: number;
      };
    }
  | {
      phase: typeof ReActAgentEvents.ACT_TOKEN_COUNT;
      data: {
        input: number;
        completion: number;
        total_input: number;
        total_completion: number;
      };
    };

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
  public abstract think(): AsyncGenerator<ToolSelectionProgress, boolean, unknown>;

  /**
   * Act phase - 执行决定的行动（流式版本）
   * 必须由子类实现
   */
  public abstract act(): AsyncGenerator<ToolExecutionProgress, string, unknown>;

  /**
   * Execute a single step with streaming output.
   * 执行单个步骤并流式输出状态更新
   */
  public async *step(): AsyncGenerator<StepProgress | ToolExecutionProgress | ToolSelectionProgress, StepResult, unknown> {
    const usage: StepResult['usage'] = { think: { input: 0, completion: 0 }, act: { input: 0, completion: 0 }, total: { input: 0, completion: 0 } };

    try {
      // Step开始 - 通过yield输出进度状态
      yield {
        phase: ReActAgentEvents.STEP_START,
        data: {},
      };

      // Think阶段开始 - 通过yield输出进度状态
      yield {
        phase: ReActAgentEvents.THINK_START,
        data: {},
      };

      // 使用流式工具选择
      const thinkStream = this.think();
      let thinkIteratorResult;
      
      while (!(thinkIteratorResult = await thinkStream.next()).done) {
        const toolSelectionProgress = thinkIteratorResult.value;
        yield toolSelectionProgress;
      }
      
      const shouldAct = thinkIteratorResult.value;

      // 计算Think阶段的token使用量
      const totalInputTokens = this.llm.totalInputTokens;
      const totalCompletionTokens = this.llm.totalCompletionTokens;
      const inputTokens = totalInputTokens - this.preStepInputTokens;
      const completionTokens = totalCompletionTokens - this.preStepCompletionTokens;

      usage.think.input = inputTokens;
      usage.think.completion = completionTokens;
      usage.total.input = totalInputTokens;
      usage.total.completion = totalCompletionTokens;

      // Think阶段token统计 - 通过yield输出进度状态
      yield {
        phase: ReActAgentEvents.THINK_TOKEN_COUNT,
        data: {
          input: inputTokens,
          completion: completionTokens,
          total_input: totalInputTokens,
          total_completion: totalCompletionTokens,
        },
      };

      // 更新token计数器
      this.preStepInputTokens = totalInputTokens;
      this.preStepCompletionTokens = totalCompletionTokens;

      // Think阶段完成 - 通过yield输出进度状态
      yield {
        phase: ReActAgentEvents.THINK_COMPLETE,
        data: {},
      };

      // 如果不需要执行行动直接返回
      if (!shouldAct) {
        return { success: true, result: 'Thinking complete - no action needed', usage };
      }

      if (this.signalUserTerminate) {
        return { success: false, result: 'User Terminated', usage, terminated: this.signalUserTerminate };
      }

      // Act阶段开始 - 通过yield输出进度状态
      yield {
        phase: ReActAgentEvents.ACT_START,
        data: {},
      };

      // 使用流式工具执行
      const actStream = this.act();
      let actIteratorResult;
      
      while (!(actIteratorResult = await actStream.next()).done) {
        const toolProgress = actIteratorResult.value;
        yield toolProgress;
      }
      
      const result = actIteratorResult.value;

      // 计算Act阶段的token使用量
      const finalInputTokens = this.llm.totalInputTokens;
      const finalCompletionTokens = this.llm.totalCompletionTokens;
      const actInputTokens = finalInputTokens - this.preStepInputTokens;
      const actCompletionTokens = finalCompletionTokens - this.preStepCompletionTokens;

      usage.act.input = actInputTokens;
      usage.act.completion = actCompletionTokens;
      usage.total.input = finalInputTokens;
      usage.total.completion = finalCompletionTokens;

      // Act阶段token统计 - 通过yield输出进度状态
      yield {
        phase: ReActAgentEvents.ACT_TOKEN_COUNT,
        data: {
          input: actInputTokens,
          completion: actCompletionTokens,
          total_input: finalInputTokens,
          total_completion: finalCompletionTokens,
        },
      };

      // 更新token计数器
      this.preStepInputTokens = finalInputTokens;
      this.preStepCompletionTokens = finalCompletionTokens;

      // Act阶段完成 - 通过yield输出进度状态
      yield {
        phase: ReActAgentEvents.ACT_COMPLETE,
        data: {},
      };

      // 步骤完成 - 通过yield输出最终进度状态
      yield {
        phase: ReActAgentEvents.STEP_COMPLETE,
        data: {},
      };

      const finalResult = { success: true, result, usage, terminated: this.state === AgentState.FINISHED };
      return finalResult;
    } catch (error) {
      const errorResult = { success: false, result: error instanceof Error ? error.message : String(error), usage };
      return errorResult;
    }
  }
}
