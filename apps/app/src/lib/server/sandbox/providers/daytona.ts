/**
 * Daytona Sandbox Provider
 * 直接使用 @daytonaio/sdk，不依赖 packages/agent
 */

import { SandboxRuntimeManager, SandboxRuntimeInstance, SandboxExecResult } from '../runtime-manager';
import { SandboxHandle, createSandboxHandle } from '../handle';
import { Daytona, DaytonaConfig, Sandbox, SandboxState } from '@daytonaio/sdk';
import { resolve } from 'path';

// Volume 类型从 SDK 的 volume.get 返回值推断
type DaytonaVolume = Awaited<ReturnType<Daytona['volume']['get']>>;

/**
 * 等待 Volume 变为 ready 状态
 * 通过轮询检查 volume 状态，直到它变为 ready 或超时
 * @param daytona Daytona 客户端
 * @param sandboxId Sandbox ID（用于查找 volume，volume 通过 sandbox ID 标识）
 * @param timeout 超时时间（毫秒），默认 60 秒
 * @param interval 轮询间隔（毫秒），默认 2 秒
 */
async function waitForVolumeReady(daytona: Daytona, sandboxId: string, timeout: number = 60 * 1000, interval: number = 2 * 1000): Promise<void> {
  const startTime = Date.now();
  const expiredTime = startTime + timeout;

  while (Date.now() < expiredTime) {
    try {
      // 使用 sandbox ID 来获取 volume（volume 通过 sandbox ID 标识）
      // 第二个参数 false 表示不创建，只获取
      const volume = await daytona.volume.get(sandboxId, false);

      // 如果 volume.get() 成功返回，说明 volume 已经存在
      // 检查 state 属性（Daytona volume 使用 state 而不是 status）
      if (volume) {
        // 检查 state 属性（Daytona volume 使用 state）
        if ('state' in volume && volume.state) {
          // 如果状态是 ready 或类似的状态，认为 volume 可用
          const state = volume.state.toLowerCase();
          if (state === 'ready' || state === 'created' || state === 'active') {
            console.log(`[DaytonaSRM] Volume for sandbox ${sandboxId} is ready (state: ${volume.state})`);
            return;
          }
          // 如果状态是 pending_create、creating 或其他非 ready 状态，继续等待
          console.log(`[DaytonaSRM] Volume for sandbox ${sandboxId} state: ${volume.state}, waiting...`);
        } else {
          // 如果没有 state 属性，但 volume 对象已经返回
          // 说明 volume 已经创建，实际的状态验证会在创建 sandbox 时进行
          console.log(
            `[DaytonaSRM] Volume for sandbox ${sandboxId} exists but no state property. Proceeding - actual state will be validated during creation`,
          );
          return;
        }
      } else {
        console.log(`[DaytonaSRM] Volume for sandbox ${sandboxId} is null or undefined, waiting...`);
      }
    } catch (error) {
      // 检查错误信息，如果是"未就绪"相关错误，继续等待
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('not in a ready state') ||
        errorMessage.includes('Current state: pending_create') ||
        errorMessage.includes('pending_create')
      ) {
        // Volume 还在创建中，继续等待
        console.log(`[DaytonaSRM] Volume for sandbox ${sandboxId} is still creating, waiting...`);
      } else if (errorMessage.includes('not found')) {
        // Volume 不存在，继续等待（可能还在创建）
        console.log(`[DaytonaSRM] Volume for sandbox ${sandboxId} not found yet, waiting...`);
      } else {
        // 其他错误直接抛出
        throw error;
      }
    }

    // 等待指定间隔后继续轮询
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // 超时
  throw new Error(`Volume for sandbox ${sandboxId} did not become ready within ${timeout}ms`);
}

/**
 * Daytona SRM 实现
 *
 * 注意：在 serverless 环境中，不维护任何连接状态
 * 每次操作都重新获取 sandbox 连接，确保完全无状态
 */
export class DaytonaSandboxRuntimeManager implements SandboxRuntimeManager {
  /**
   * 获取 Daytona 客户端实例
   *
   * 注意：创建新的 Daytona 实例不会创建新的 sandbox
   * Daytona 只是客户端，用于与 Daytona API 通信
   * 每次调用都创建新实例，不缓存，确保 serverless 兼容性
   */
  private getDaytonaClient(): Daytona {
    return new Daytona({
      apiKey: process.env.DAYTONA_API_KEY,
      organizationId: process.env.DAYTONA_ORGANIZATION_ID,
    } as DaytonaConfig);
  }

  async create(options?: {
    workspaceRoot?: string;
    costProfile?: SandboxHandle['costProfile'];
    ports?: number[]; // 要暴露的端口列表（用于 CDP 等服务）
  }): Promise<SandboxHandle> {
    // 生成唯一的 sandbox ID
    const id = `sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // 创建新的 Daytona 客户端（确保无状态）
    const daytona = this.getDaytonaClient();

    // 获取或创建 volume（持久化存储）
    // 注意：volume.get(id, true) 使用 sandbox ID 来标识 volume
    const volume = await daytona.volume.get(id, true);

    // 等待 volume 变为 ready 状态（volume 创建是异步的，需要等待）
    // 使用 sandbox ID 而不是 volume.id（UUID），因为 volume 是通过 sandbox ID 标识的
    await waitForVolumeReady(daytona, id);

    // 尝试创建 sandbox，如果失败（volume 未就绪），等待后重试
    let retries = 3;
    let lastError: Error | null = null;
    let sandbox: Sandbox | null = null;

    while (retries > 0) {
      try {
        // 构建创建选项
        const createOptions: any = {
          snapshot: process.env.DAYTONA_SANDBOX_SNAPSHOT,
          user: 'daytona',
          labels: { id },
          volumes: [{ volumeId: volume.id, mountPath: '/heyfun/workspace' }],
        };

        // 如果指定了端口，添加到创建选项
        // 注意：Daytona SDK 的端口配置方式可能需要根据实际 API 文档调整
        // 可能的字段名：ports, exposePorts, forwardPorts, portMappings 等
        if (options?.ports && options.ports.length > 0) {
          // 尝试使用 ports 字段（如果 Daytona SDK 支持）
          // 如果 SDK 不支持，可能需要通过其他方式配置端口暴露
          createOptions.ports = options.ports;
          console.log(`[DaytonaSRM] Attempting to create sandbox with exposed ports:`, options.ports);
          console.log(`[DaytonaSRM] Note: If ports are not exposed, check Daytona SDK documentation for correct field name`);
        }

        sandbox = await daytona.create(createOptions);
        break; // 成功创建，跳出循环
      } catch (createError) {
        const errorMessage = createError instanceof Error ? createError.message : String(createError);
        if (
          errorMessage.includes('not in a ready state') ||
          errorMessage.includes('pending_create') ||
          errorMessage.includes('Current state: creating') ||
          (errorMessage.includes('Current state:') && errorMessage.includes('pending'))
        ) {
          // Volume 还未就绪，继续等待 volume ready 后重试
          lastError = createError instanceof Error ? createError : new Error(String(createError));
          retries--;
          if (retries > 0) {
            console.log(
              `[DaytonaSRM] Sandbox creation failed, volume not ready: ${errorMessage}. Waiting for volume ready and retrying... (${retries} retries left)`,
            );
            // 继续等待 volume ready
            await waitForVolumeReady(daytona, id, 30 * 1000, 2 * 1000); // 等待最多 30 秒
            continue;
          }
        }
        throw createError;
      }
    }

    // 如果所有重试都失败
    if (!sandbox) {
      throw lastError || new Error('Failed to create sandbox after retries');
    }

    // 确保工作区目录存在
    await sandbox.fs.createFolder('/heyfun/workspace', '777');

    // 获取 workspace 路径
    const workspaceRoot = options?.workspaceRoot ?? '/heyfun/workspace';

    // 获取 previewUrls（如果可用）
    // Daytona Sandbox 可能包含多个 previewUrl，每个端口对应一个
    // 格式可能是：previewUrls: { [port]: url } 或 previewUrl: baseUrl
    let previewUrls: Record<number, string> | undefined;
    try {
      // 检查 sandbox 对象是否有 previewUrls 或 previewUrl
      const sandboxPreviewUrls = sandbox.previewUrls || sandbox.preview_urls;
      const sandboxPreviewUrl = sandbox.previewUrl || sandbox.preview_url || sandbox.url;

      if (sandboxPreviewUrls && typeof sandboxPreviewUrls === 'object') {
        // 如果已经是对象格式 { [port]: url }
        previewUrls = sandboxPreviewUrls as Record<number, string>;
        console.log(`[DaytonaSRM] Found previewUrls for sandbox ${id}:`, Object.keys(previewUrls).length, 'ports');
      } else if (sandboxPreviewUrl && typeof sandboxPreviewUrl === 'string') {
        // 如果是单个 baseUrl，尝试解析并构建映射
        // 对于单个 URL，我们假设它可能对应多个端口，但无法确定具体映射
        // 为了兼容性，我们可以创建一个默认映射，或者在使用时动态处理
        try {
          const baseUrl = new URL(sandboxPreviewUrl);
          // 如果 URL 包含端口，提取端口号
          const port = baseUrl.port ? parseInt(baseUrl.port, 10) : baseUrl.protocol === 'https:' ? 443 : 80;
          // 创建单个端口的映射
          previewUrls = { [port]: sandboxPreviewUrl };
          console.log(`[DaytonaSRM] Created previewUrls from base URL for sandbox ${id}: port ${port} -> ${sandboxPreviewUrl}`);
        } catch (urlError) {
          // URL 解析失败，记录但不设置 previewUrls
          console.log(`[DaytonaSRM] Failed to parse previewUrl for sandbox ${id}: ${sandboxPreviewUrl}`);
        }
      }
    } catch (e) {
      // 忽略错误，previewUrls 可能不存在
      console.log(`[DaytonaSRM] No previewUrls found for sandbox ${id}`);
    }

    // 创建 handle（只包含可序列化的信息）
    const handle = createSandboxHandle(id, 'daytona', {
      workspaceRoot,
      status: 'ready',
      costProfile: options?.costProfile ?? 'standard',
      previewUrls,
    });

    // 注意：不返回 sandbox 对象，只返回可序列化的 handle
    return handle;
  }

  async get(handle: SandboxHandle): Promise<SandboxRuntimeInstance> {
    // 返回一个无状态的实例，每次操作都重新获取 sandbox
    // 不缓存 sandbox，确保 serverless 兼容性
    const instance = new DaytonaSandboxRuntimeInstance(handle, () => this.getDaytonaClient());

    // 依赖已通过 Volume 持久化，如果需要安装依赖，Agent 可以自己调用命令
    // 框架不做自动检测和安装，保持简单

    return instance;
  }

  async exec(
    handle: SandboxHandle,
    command: string,
    options?: {
      env?: Record<string, string>;
      timeout?: number;
      cwd?: string;
    },
  ): Promise<SandboxExecResult> {
    const instance = await this.get(handle);
    return await instance.exec(command, options);
  }

  async readFile(handle: SandboxHandle, path: string): Promise<string> {
    const instance = await this.get(handle);
    return await instance.readFile(path);
  }

  async writeFile(handle: SandboxHandle, path: string, content: string): Promise<void> {
    const instance = await this.get(handle);
    return await instance.writeFile(path, content);
  }

  async destroy(handle: SandboxHandle): Promise<SandboxHandle> {
    try {
      // 销毁 sandbox（但不删除 Volume，Volume 中的数据会保留）
      // 注意：Volume 会自动保留，工作区文件不会丢失
      const daytona = this.getDaytonaClient();
      const sandbox = await daytona.findOne({ labels: { id: handle.id } });
      await daytona.delete(sandbox);

      return handle;
    } catch (error) {
      // 如果 sandbox 不存在，忽略错误
      console.warn(`[DaytonaSRM] Failed to destroy sandbox ${handle.id}:`, error);
      return handle;
    }
  }
}

/**
 * Daytona Sandbox Runtime Instance 实现
 *
 * 完全无状态设计：不持有任何 sandbox 引用
 * 每次操作都重新获取 sandbox，确保 serverless 兼容性
 */
class DaytonaSandboxRuntimeInstance implements SandboxRuntimeInstance {
  constructor(
    public handle: SandboxHandle,
    private getDaytonaClient: () => Daytona,
  ) {}

  /**
   * 获取 sandbox 实例（每次调用都重新获取，不缓存）
   *
   * 重要：getOrCreateOneById 会先查找已存在的 sandbox（通过 id）
   * - 如果找到已存在的 sandbox，直接返回（不会创建新的）
   * - 只有找不到时才会创建新的 sandbox
   *
   * 因此，即使每次创建新的 Daytona 客户端，也不会重复创建 sandbox
   */
  private async getSandbox(): Promise<Sandbox> {
    const daytona = this.getDaytonaClient();

    try {
      // 先尝试查找已存在的 sandbox
      const sandbox = await daytona.findOne({ labels: { id: this.handle.id } });
      if (sandbox.state !== SandboxState.STARTED) {
        await daytona.start(sandbox);
      }

      // 更新 handle 的 previewUrls（如果 sandbox 有 previewUrls 但 handle 没有）
      if (!this.handle.previewUrls || Object.keys(this.handle.previewUrls).length === 0) {
        try {
          const sandboxPreviewUrls = sandbox.previewUrls || sandbox.preview_urls;
          const sandboxPreviewUrl = sandbox.previewUrl || sandbox.preview_url || sandbox.url;

          if (sandboxPreviewUrls && typeof sandboxPreviewUrls === 'object') {
            this.handle.previewUrls = sandboxPreviewUrls as Record<number, string>;
            console.log(`[DaytonaSRM] Updated previewUrls for sandbox ${this.handle.id}:`, Object.keys(this.handle.previewUrls).length, 'ports');
          } else if (sandboxPreviewUrl && typeof sandboxPreviewUrl === 'string') {
            // 处理单个 previewUrl
            try {
              const baseUrl = new URL(sandboxPreviewUrl);
              const port = baseUrl.port ? parseInt(baseUrl.port, 10) : baseUrl.protocol === 'https:' ? 443 : 80;
              this.handle.previewUrls = { [port]: sandboxPreviewUrl };
              console.log(`[DaytonaSRM] Updated previewUrls from base URL for sandbox ${this.handle.id}: port ${port} -> ${sandboxPreviewUrl}`);
            } catch (urlError) {
              console.log(`[DaytonaSRM] Failed to parse previewUrl for sandbox ${this.handle.id}: ${sandboxPreviewUrl}`);
            }
          }
        } catch (e) {
          // 忽略错误
        }
      }

      return sandbox;
    } catch (error) {
      // 如果找不到，创建新的 sandbox
      if (error instanceof Error && error.message.includes('No sandbox found with labels')) {
        // 获取或创建 volume（持久化存储）
        // 注意：volume.get(id, true) 使用 sandbox ID 来标识 volume
        const volume = await daytona.volume.get(this.handle.id, true);

        // 等待 volume 变为 ready 状态
        // 使用 sandbox ID 而不是 volume.id（UUID），因为 volume 是通过 sandbox ID 标识的
        await waitForVolumeReady(daytona, this.handle.id);

        // 尝试创建 sandbox，如果失败（volume 未就绪），等待后重试
        let retries = 3;
        let lastError: Error | null = null;
        let sandbox: Sandbox | null = null;

        while (retries > 0) {
          try {
            // 构建创建选项
            const createOptions: any = {
              snapshot: process.env.DAYTONA_SANDBOX_SNAPSHOT,
              user: 'daytona',
              labels: { id: this.handle.id },
              volumes: [{ volumeId: volume.id, mountPath: '/heyfun/workspace' }],
            };

            // 如果指定了端口，添加到创建选项
            // 注意：这里暂时不传递端口，因为这是在 getSandbox 中恢复已存在的 sandbox
            // 端口配置应该在初始创建时设置

            sandbox = await daytona.create(createOptions);
            break; // 成功创建，跳出循环
          } catch (createError) {
            const errorMessage = createError instanceof Error ? createError.message : String(createError);
            if (
              errorMessage.includes('not in a ready state') ||
              errorMessage.includes('pending_create') ||
              errorMessage.includes('Current state: creating') ||
              (errorMessage.includes('Current state:') && errorMessage.includes('pending'))
            ) {
              // Volume 还未就绪，继续等待 volume ready 后重试
              lastError = createError instanceof Error ? createError : new Error(String(createError));
              retries--;
              if (retries > 0) {
                console.log(
                  `[DaytonaSRM] Sandbox creation failed, volume not ready: ${errorMessage}. Waiting for volume ready and retrying... (${retries} retries left)`,
                );
                // 继续等待 volume ready
                await waitForVolumeReady(daytona, this.handle.id, 30 * 1000, 2 * 1000); // 等待最多 30 秒
                continue;
              }
            }
            throw createError;
          }
        }

        // 如果所有重试都失败
        if (!sandbox) {
          throw lastError || new Error('Failed to create sandbox after retries');
        }

        // 确保工作区目录存在
        await sandbox.fs.createFolder('/heyfun/workspace', '777');
        return sandbox;
      }
      throw error;
    }
  }

  async exec(command: string, options?: { env?: Record<string, string>; timeout?: number; cwd?: string }): Promise<SandboxExecResult> {
    try {
      // 每次操作都重新获取 sandbox（不缓存）
      const sandbox = await this.getSandbox();

      // 获取工作目录：优先使用options.cwd，否则使用handle中的workspaceRoot，最后使用默认值
      const cwd = options?.cwd || this.handle.workspaceRoot || '/heyfun/workspace';

      // 执行命令（Daytona SDK 接受完整命令字符串）
      // executeCommand 签名：executeCommand(command: string, cwd?: string, env?: Record<string, string>)
      const result = await sandbox.process.executeCommand(command, cwd, options?.env);

      return {
        exitCode: result.exitCode,
        stdout: result.result || '',
        stderr: result.exitCode !== 0 ? result.result || '' : '',
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async readFile(path: string): Promise<string> {
    const sandbox = await this.getSandbox();
    const fullPath = await this.resolvePath(sandbox, path);
    const buffer = await sandbox.fs.downloadFile(fullPath);
    // 返回 base64 编码的字符串，这样可以正确处理二进制文件（如图片）
    // 对于文本文件，调用方可以先用 Buffer.from(base64, 'base64').toString('utf-8') 转换
    return buffer.toString('base64');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const sandbox = await this.getSandbox();
    const fullPath = await this.resolvePath(sandbox, path);

    // 确保父目录存在
    const parentDir = resolve(fullPath, '..');
    try {
      await sandbox.fs.createFolder(parentDir, '755');
    } catch {
      // 目录可能已存在，忽略错误
    }

    // 写入文件
    const buffer = Buffer.from(content, 'utf-8');
    await sandbox.fs.uploadFile(buffer, fullPath);
  }

  async destroy(): Promise<void> {
    // 销毁由 SRM 统一管理
    // 这里不需要实现
  }

  private async resolvePath(sandbox: Sandbox, path: string): Promise<string> {
    const workspaceRoot = this.handle.workspaceRoot || '/heyfun/workspace';
    return resolve(workspaceRoot, path);
  }
}
