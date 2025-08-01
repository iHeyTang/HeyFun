import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolResult } from '../types';
import { AbstractBaseTool } from './base';

/**
 * Terminate工具 - 用于终止任务执行
 */
export class TerminateTool extends AbstractBaseTool {
  public name = 'terminate';
  public description = 'Terminate the current task execution when the task is completed or should be stopped';

  async execute(params: Parameters<Client["callTool"]>[0]): Promise<ToolResult> {
    const reason = (params.arguments as any)?.reason || 'Task completed';
    const summary = (params.arguments as any)?.summary || 'No summary provided';

    return {
      content: [
        {
          type: 'text',
          text: `Task terminated: ${reason}\nSummary: ${summary}`,
        },
      ],
    };
  }

  protected getParametersSchema(): any {
    return {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'The reason for terminating the task',
        },
        summary: {
          type: 'string',
          description: 'A summary of what was accomplished',
        },
      },
      required: [],
    };
  }
}
