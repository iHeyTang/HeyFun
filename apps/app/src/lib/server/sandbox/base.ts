import { FunMaxConfig } from '@repo/agent';

/**
 * 沙盒进程，它负责执行命令
 */
export abstract class SandboxProcess {
  abstract executeCommand(params: { command: string; args: string[]; env: Record<string, string> }): Promise<string>;
  abstract executeLongTermCommand(params: { id: string; command: string; args: string[]; env: Record<string, string> }): Promise<void>;
}

/**
 * 沙盒Agent事件
 */
export type SandboxAgentEvent = {
  id: string;
  name: string;
  step: number;
  timestamp: string;
  content: any;
};

/**
 * 沙盒Agent代理，它负责和沙盒中的Agent进行通信
 */
export abstract class SandboxAgentProxy {
  abstract createTask(params: FunMaxConfig): Promise<string>;

  abstract terminateTask(params: { taskId: string }): Promise<void>;

  abstract getTaskEventStream(params: { taskId: string }, onEvent: (event: SandboxAgentEvent) => Promise<void>): Promise<void>;
}

/**
 * 沙盒运行器，它负责连接到 sandbox 的 runner 使得当前进程可以和 sandbox 的 runner 进行通信
 */
export abstract class SandboxRunner {
  abstract readonly id: string;
  abstract process: SandboxProcess;
  abstract agent: SandboxAgentProxy;
}

export abstract class BaseSandboxManager {
  /**
   * 列出所有沙盒
   */
  abstract list(): Promise<SandboxRunner[]>;

  /**
   * 根据 id 获取沙盒
   */
  abstract findOneById(id: string): Promise<SandboxRunner>;

  /**
   * 创建沙盒
   */
  abstract create(): Promise<SandboxRunner>;

  /**
   * 删除沙盒
   */
  abstract delete(id: string, timeout?: number): Promise<void>;

  abstract start(id: string): Promise<void>;

  abstract stop(id: string): Promise<void>;
}
