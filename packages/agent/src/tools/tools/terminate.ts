import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { BaseToolParameters, ToolResult } from '../types';
import { AbstractBaseTool } from './base';

interface ToolParameters extends BaseToolParameters {
  reason: string;
  summary: string;
}

/**
 * Terminate工具 - 用于终止任务执行
 */
export class TerminateTool extends AbstractBaseTool<ToolParameters> {
  public name = 'terminate';
  public description = 'Terminate the current task execution when the task is completed or should be stopped';

  async execute(input: ToolParameters): Promise<ToolResult> {
    const reason = input.reason || 'Task completed';
    const summary = input.summary || 'No summary provided';

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
