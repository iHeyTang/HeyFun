import type { Chat } from '@repo/llm/chat';
import type { BaseTool, BaseToolParameters, ToolResult } from '../types';

/**
 * 抽象基础工具类
 */
export abstract class AbstractBaseTool<P extends BaseToolParameters> implements BaseTool<P> {
  public abstract name: string;
  public abstract description: string;

  abstract execute(params: P): Promise<ToolResult>;

  /**
   * 转换为OpenAI工具格式
   */
  toOpenAITool(): Chat.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.getParametersSchema(),
      },
    };
  }

  /**
   * 获取参数schema，子类需要实现
   */
  protected abstract getParametersSchema(): any;

  /**
   * 清理资源（可选实现）
   */
  async cleanup?(): Promise<void> {
    // 默认不需要清理
  }
}
