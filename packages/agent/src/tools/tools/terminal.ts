import { BaseToolParameters, ToolResult } from '../types';
import { AbstractBaseTool } from './base';
import { SandboxRunner } from '../../sandbox/base';

interface TerminalParameters extends BaseToolParameters {
  operation: 'execute' | 'execute_long' | 'stop_long' | 'list_long' | 'get_output';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  id?: string;
  timeout?: number;
}

/**
 * 终端工具 - 用于执行命令和获取输出
 */
export class TerminalTool extends AbstractBaseTool<TerminalParameters> {
  public name = 'terminal';
  public description =
    'Execute commands in the sandbox terminal environment. Supports both short-term and long-term command execution, with process management capabilities.';

  private sandbox: SandboxRunner;

  constructor(sandbox: SandboxRunner) {
    super();
    this.sandbox = sandbox;
  }

  async execute(input: TerminalParameters): Promise<ToolResult> {
    try {
      switch (input.operation) {
        case 'execute':
          return await this.executeCommand(input.command!, input.args || [], input.env || {});
        case 'execute_long':
          return await this.executeLongTermCommand(input.id!, input.command!, input.args || [], input.env || {});
        case 'stop_long':
          return await this.stopLongTermCommand(input.id!);
        case 'list_long':
          return await this.listLongTermCommands();
        case 'get_output':
          return await this.getCommandOutput(input.id!);
        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown operation '${input.operation}'` }],
            error: 'Unknown operation',
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Terminal operation failed: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async executeCommand(command: string, args: string[], env: Record<string, string>): Promise<ToolResult> {
    try {
      const output = await this.sandbox.process.executeCommand({ command, args, env });
      if (output.exitCode !== 0) {
        return {
          content: [{ type: 'text', text: `Command executed error:\n${output}` }],
        };
      }

      return {
        content: [{ type: 'text', text: `Command executed successfully:\n${output}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error executing command: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async executeLongTermCommand(id: string, command: string, args: string[], env: Record<string, string>): Promise<ToolResult> {
    try {
      await this.sandbox.process.executeLongTermCommand({ id, command, args, env });

      return {
        content: [{ type: 'text', text: `Long-term command '${id}' started successfully: ${command} ${args.join(' ')}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error executing long-term command: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async stopLongTermCommand(id: string): Promise<ToolResult> {
    try {
      // �� sandbox.process /&	 stopLongTermCommand ��
      if ('stopLongTermCommand' in this.sandbox.process && typeof this.sandbox.process.stopLongTermCommand === 'function') {
        await (this.sandbox.process as any).stopLongTermCommand(id);
        return {
          content: [{ type: 'text', text: `Long-term command '${id}' stopped successfully` }],
        };
      } else {
        return {
          content: [{ type: 'text', text: `Stop long-term command not supported in current sandbox implementation` }],
          error: 'Operation not supported',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error stopping long-term command: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async listLongTermCommands(): Promise<ToolResult> {
    try {
      // �� sandbox.process /&	 getLongTermCommands ��
      if ('getLongTermCommands' in this.sandbox.process && typeof this.sandbox.process.getLongTermCommands === 'function') {
        const commands = (this.sandbox.process as any).getLongTermCommands();
        if (commands.length === 0) {
          return {
            content: [{ type: 'text', text: 'No long-term commands are currently running' }],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Running long-term commands:\n${commands.map((cmd: string, index: number) => `${index + 1}. ${cmd}`).join('\n')}`,
              },
            ],
          };
        }
      } else {
        return {
          content: [{ type: 'text', text: `List long-term commands not supported in current sandbox implementation` }],
          error: 'Operation not supported',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error listing long-term commands: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async getCommandOutput(id: string): Promise<ToolResult> {
    try {
      // �� sandbox.process /&	 getCommandOutput ��
      if ('getCommandOutput' in this.sandbox.process && typeof this.sandbox.process.getCommandOutput === 'function') {
        const output = await (this.sandbox.process as any).getCommandOutput(id);
        return {
          content: [{ type: 'text', text: `Output for command '${id}':\n${output}` }],
        };
      } else {
        return {
          content: [{ type: 'text', text: `Get command output not supported in current sandbox implementation` }],
          error: 'Operation not supported',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error getting command output: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  protected getParametersSchema(): any {
    return {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['execute', 'execute_long', 'stop_long', 'list_long', 'get_output'],
          description: 'The terminal operation to perform',
        },
        command: {
          type: 'string',
          description: 'The command to execute (required for execute and execute_long operations)',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments for the command',
        },
        env: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Environment variables for the command',
        },
        id: {
          type: 'string',
          description: 'Identifier for long-term commands (required for execute_long, stop_long, and get_output operations)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds for command execution',
        },
      },
      required: ['operation'],
    };
  }
}
