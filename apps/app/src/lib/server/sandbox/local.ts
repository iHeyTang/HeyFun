import { FunMaxConfig } from '@repo/agent';
import { BaseSandboxManager, SandboxAgentEvent, SandboxAgentProxy, SandboxProcess, SandboxRunner } from './base';
import { spawn, ChildProcess, exec } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';
import { to } from '@/lib/shared/to';

const execAsync = promisify(exec);

interface LocalSandboxConfig {
  agentPath?: string;
  port?: number;
}

class LocalSandboxProcess extends SandboxProcess {
  private longTermProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    super();
  }

  async executeCommand(params: { command: string; args: string[]; env: Record<string, string> }): Promise<string> {
    const cmd = `${params.command} ${params.args.join(' ')}`;
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        env: { ...process.env, ...params.env },
        cwd: process.cwd(),
      });

      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
      }

      return stdout;
    } catch (error) {
      throw new Error(`Failed to execute command: ${cmd}. Error: ${error}`);
    }
  }

  async executeLongTermCommand(params: { id: string; command: string; args: string[]; env: Record<string, string> }): Promise<void> {
    const cmd = `${params.command} ${params.args.join(' ')}`;

    // 检查是否已经有相同 ID 的进程在运行
    if (this.longTermProcesses.has(params.id)) {
      const existingProcess = this.longTermProcesses.get(params.id);
      if (existingProcess && !existingProcess.killed) {
        console.log(`Long-term command ${params.id} is already running`);
        return;
      } else {
        // 清理已退出的进程
        this.longTermProcesses.delete(params.id);
      }
    }

    try {
      const childProcess = spawn(params.command, params.args, {
        env: { ...process.env, ...params.env },
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      // 存储进程引用
      this.longTermProcesses.set(params.id, childProcess);

      // 监听输出
      childProcess.stdout?.on('data', data => {
        console.log(`[LongTerm-${params.id}] ${data.toString().trim()}`);
      });

      childProcess.stderr?.on('data', data => {
        console.error(`[LongTerm-${params.id}-Error] ${data.toString().trim()}`);
      });

      // 监听进程退出
      childProcess.on('exit', code => {
        console.log(`Long-term command ${params.id} exited with code ${code}`);
        this.longTermProcesses.delete(params.id);
      });

      // 监听进程错误
      childProcess.on('error', error => {
        console.error(`Long-term command ${params.id} failed:`, error);
        this.longTermProcesses.delete(params.id);
      });

      console.log(`Started long-term command ${params.id}: ${cmd}`);
    } catch (error) {
      throw new Error(`Failed to execute long-term command: ${cmd}. Error: ${error}`);
    }
  }

  // 添加一个方法来停止长期运行的命令
  async stopLongTermCommand(id: string): Promise<void> {
    const process = this.longTermProcesses.get(id);
    if (process && !process.killed) {
      console.log(`Stopping long-term command ${id}...`);
      process.kill('SIGTERM');

      // 等待进程优雅退出
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          process.kill('SIGKILL');
          resolve();
        }, 5000);

        process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.longTermProcesses.delete(id);
      console.log(`Long-term command ${id} stopped`);
    } else {
      console.log(`Long-term command ${id} is not running`);
    }
  }

  // 添加一个方法来列出所有长期运行的命令
  getLongTermCommands(): string[] {
    return Array.from(this.longTermProcesses.keys());
  }
}

class LocalSandboxAgentProxy extends SandboxAgentProxy {
  constructor() {
    super();
  }

  async createTask(params: FunMaxConfig): Promise<string> {
    const [error, response] = await to(
      fetch(`http://localhost:7200/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(params),
      }).then(async res => {
        if (res.status >= 200 && res.status < 300) {
          return (await res.json()) as Promise<{ taskId: string }>;
        }
        throw Error(`Server Error: ${JSON.stringify(await res.json())}`);
      }),
    );

    if (error || !response.taskId) {
      throw error || new Error('Unkown Error');
    }

    return response.taskId;
  }

  async terminateTask(params: { taskId: string }): Promise<void> {
    await fetch(`http://localhost:7200/api/tasks/terminate`, {
      method: 'POST',
      body: JSON.stringify({ task_id: params.taskId }),
    });
  }

  async getTaskEventStream(params: { taskId: string }, onEvent: (event: SandboxAgentEvent) => Promise<void>): Promise<void> {
    const streamResponse = await fetch(`http://localhost:7200/api/tasks/event?taskId=${params.taskId}`);
    const reader = streamResponse.body?.getReader();
    if (!reader) throw new Error('Failed to get response stream');

    const decoder = new TextDecoder();

    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        const lines = buffer.split('\n');
        // Keep the last line (might be incomplete) if not the final read
        buffer = done ? '' : lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;

          try {
            const parsed = JSON.parse(line.slice(6)) as {
              id: string;
              name: string;
              step: number;
              timestamp: string;
              content: any;
            };
            await onEvent(parsed);
          } catch (error) {
            console.error('Failed to process message:', error);
          }
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class LocalSandboxRunner extends SandboxRunner {
  public readonly process: SandboxProcess;
  public readonly agent: SandboxAgentProxy;

  constructor(public readonly id: string) {
    super();
    this.agent = new LocalSandboxAgentProxy();
    this.process = new LocalSandboxProcess();
  }
}

export class LocalSandboxManager extends BaseSandboxManager {
  private config: LocalSandboxConfig;
  private processes: Map<string, ChildProcess> = new Map();

  constructor(config: LocalSandboxConfig = {}) {
    super();
    this.config = {
      agentPath: join(process.cwd(), '..', 'agent'),
      port: 7200,
      ...config,
    };
  }

  async list(): Promise<SandboxRunner[]> {
    // 本地模式下，我们只返回一个固定的 sandbox
    return [new LocalSandboxRunner('local-agent')];
  }

  async findOneById(id: string): Promise<SandboxRunner> {
    if (id === 'local-agent') {
      return new LocalSandboxRunner(id);
    }
    throw new Error(`Sandbox with id ${id} not found`);
  }

  async create(): Promise<SandboxRunner> {
    // 本地模式下，创建就是启动进程
    const runner = new LocalSandboxRunner('local-agent');
    await this.start('local-agent');
    return runner;
  }

  async delete(id: string, timeout?: number): Promise<void> {
    await this.stop(id);
  }

  async start(id: string): Promise<void> {
    if (id !== 'local-agent') {
      throw new Error(`Only 'local-agent' is supported in local mode`);
    }

    // 检查进程是否已经在运行
    if (this.processes.has(id)) {
      const process = this.processes.get(id);
      if (process && !process.killed) {
        console.log('Agent process is already running');
        return;
      }
    }

    console.log('Starting local agent with bun dev...');

    // 启动 bun dev 进程
    console.log(this.config.agentPath);
    const childProcess = spawn('bun', ['start:dev'], {
      cwd: this.config.agentPath,
      stdio: 'pipe',
      env: {
        ...process.env,
        PORT: this.config.port?.toString() || '7200',
      },
    });

    // 监听进程输出
    childProcess.stdout?.on('data', data => {
      console.log(`[Agent] ${data.toString().trim()}`);
    });

    childProcess.stderr?.on('data', data => {
      console.error(`[Agent Error] ${data.toString().trim()}`);
    });

    // 监听进程退出
    childProcess.on('exit', code => {
      console.log(`Agent process exited with code ${code}`);
      this.processes.delete(id);
    });

    // 监听进程错误
    childProcess.on('error', error => {
      console.error('Failed to start agent process:', error);
      this.processes.delete(id);
    });

    // 等待一段时间确保进程启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.processes.set(id, childProcess);
    console.log(`Agent started on port ${this.config.port}`);
  }

  async stop(id: string): Promise<void> {
    if (id !== 'local-agent') {
      throw new Error(`Only 'local-agent' is supported in local mode`);
    }

    const process = this.processes.get(id);
    if (process && !process.killed) {
      console.log('Stopping agent process...');
      process.kill('SIGTERM');

      // 等待进程优雅退出
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          process.kill('SIGKILL');
          resolve();
        }, 5000);

        process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.processes.delete(id);
      console.log('Agent process stopped');
    }
  }
}
