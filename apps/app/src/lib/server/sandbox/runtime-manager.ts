/**
 * Sandbox Runtime Manager (SRM)
 * 作为 sandbox provider 的抽象层，屏蔽 Daytona / E2B 等 provider 差异
 *
 * 注意：Agent 不能直接调用 SRM，只能通过 Tool 间接操作
 */

import type { SandboxHandle } from './handle';

/**
 * 命令执行结果
 */
export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Sandbox Runtime Manager 接口
 * 所有 sandbox provider 必须实现此接口
 */
export interface SandboxRuntimeManager {
  /**
   * 创建新的 sandbox
   * @param options 创建选项
   */
  create(options?: {
    workspaceRoot?: string;
    costProfile?: SandboxHandle['costProfile'];
  }): Promise<SandboxHandle>;

  /**
   * 根据 handle 恢复/获取已存在的 sandbox
   * @param handle SandboxHandle
   */
  get(handle: SandboxHandle): Promise<SandboxRuntimeInstance>;

  /**
   * 执行命令
   * @param handle SandboxHandle
   * @param command 要执行的命令
   * @param options 执行选项
   */
  exec(
    handle: SandboxHandle,
    command: string,
    options?: {
      env?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<SandboxExecResult>;

  /**
   * 读取文件内容
   * @param handle SandboxHandle
   * @param path 文件路径（相对于 workspaceRoot）
   */
  readFile(handle: SandboxHandle, path: string): Promise<string>;

  /**
   * 写入文件内容
   * @param handle SandboxHandle
   * @param path 文件路径（相对于 workspaceRoot）
   * @param content 文件内容
   */
  writeFile(handle: SandboxHandle, path: string, content: string): Promise<void>;


  /**
   * 删除 sandbox
   * @param handle SandboxHandle
   * @returns handle（Volume 会自动保留）
   */
  destroy(handle: SandboxHandle): Promise<SandboxHandle>;
}

/**
 * Sandbox Runtime Instance
 * 用于直接操作 sandbox（内部使用，不暴露给 Agent）
 */
export interface SandboxRuntimeInstance {
  handle: SandboxHandle;
  exec(command: string, options?: { env?: Record<string, string>; timeout?: number }): Promise<SandboxExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * 文件信息
 */
export interface SandboxFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt?: string;
}

