import { BaseSandboxManager, SandboxRunner } from './base';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

interface LocalSandboxConfig {
  agentPath?: string;
  port?: number;
}

export class LocalSandboxRunner extends SandboxRunner {
  constructor(
    public readonly id: string,
    private port: number = 7200,
  ) {
    super();
  }

  getRunnerDomain(): string {
    return `http://localhost:${this.port}`;
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
    return [new LocalSandboxRunner('local-agent', this.config.port)];
  }

  async findOneById(id: string): Promise<SandboxRunner> {
    if (id === 'local-agent') {
      return new LocalSandboxRunner(id, this.config.port);
    }
    throw new Error(`Sandbox with id ${id} not found`);
  }

  async create(): Promise<SandboxRunner> {
    // 本地模式下，创建就是启动进程
    const runner = new LocalSandboxRunner('local-agent', this.config.port);
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
