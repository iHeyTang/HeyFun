/**
 * 沙盒运行器，它负责连接到 sandbox 的 runner 使得当前进程可以和 sandbox 的 runner 进行通信
 */
export abstract class SandboxRunner {
  abstract readonly id: string;
  abstract getRunnerDomain(): string;
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
