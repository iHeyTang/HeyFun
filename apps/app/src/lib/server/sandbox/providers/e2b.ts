/**
 * E2B Sandbox Provider
 * E2B 实现的占位符，可以根据需要后续实现
 */

import { SandboxRuntimeManager, SandboxRuntimeInstance, SandboxExecResult } from '../runtime-manager';
import { SandboxHandle, createSandboxHandle } from '../handle';

/**
 * E2B SRM 实现（占位符）
 * 当前返回错误，提示需要实现
 */
export class E2BSandboxRuntimeManager implements SandboxRuntimeManager {
  async create(
    options?: {
      workspaceRoot?: string;
      costProfile?: SandboxHandle['costProfile'];
      ports?: number[];
      idleTimeout?: number;
    },
    waitForReady: boolean = true,
  ): Promise<SandboxHandle> {
    throw new Error('E2B provider is not implemented yet');
  }

  async get(handle: SandboxHandle): Promise<SandboxRuntimeInstance> {
    throw new Error('E2B provider is not implemented yet');
  }

  async exec(
    handle: SandboxHandle,
    command: string,
    options?: {
      env?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<SandboxExecResult> {
    throw new Error('E2B provider is not implemented yet');
  }

  async readFile(handle: SandboxHandle, path: string): Promise<string> {
    throw new Error('E2B provider is not implemented yet');
  }

  async writeFile(handle: SandboxHandle, path: string, content: string): Promise<void> {
    throw new Error('E2B provider is not implemented yet');
  }

  async destroy(handle: SandboxHandle): Promise<SandboxHandle> {
    throw new Error('E2B provider is not implemented yet');
  }
}
