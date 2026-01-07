/**
 * SandboxHandle - 可序列化的 Sandbox 句柄
 * 用于在 Upstash Workflow state 中持久化 sandbox 信息
 * Agent 只能通过这个句柄引用 sandbox，不能访问 sandbox 的内部实现
 */

export type SandboxProvider = 'daytona' | 'e2b';

export type SandboxStatus = 'creating' | 'ready' | 'idle' | 'expired';

export type SandboxCostProfile = 'cheap' | 'standard' | 'expensive';

/**
 * SandboxHandle - 可序列化的 Sandbox 句柄
 * 必须可以在 Upstash Workflow state 中安全存储
 *
 * 注意：所有文件已通过 Volume 持久化，不需要额外的状态管理
 */
export interface SandboxHandle {
  /** Sandbox 唯一标识符 */
  id: string;
  /** Sandbox Provider 类型 */
  provider: SandboxProvider;
  /** 工作区根路径 */
  workspaceRoot: string;
  /** Sandbox 状态 */
  status: SandboxStatus;
  /** 成本配置 */
  costProfile: SandboxCostProfile;
  /** 预览 URL 映射（端口 -> previewUrl，用于外部访问，Daytona 等 provider 需要） */
  previewUrls?: Record<number, string>;
  /** 创建时间（ISO 8601 字符串） */
  createdAt: string;
  /** 最后使用时间（ISO 8601 字符串） */
  lastUsedAt?: string;
}

/**
 * 创建默认的 SandboxHandle
 */
export function createSandboxHandle(
  id: string,
  provider: SandboxProvider,
  options: {
    workspaceRoot?: string;
    status?: SandboxStatus;
    costProfile?: SandboxCostProfile;
    previewUrls?: Record<number, string>;
  } = {},
): SandboxHandle {
  const now = new Date().toISOString();
  return {
    id,
    provider,
    workspaceRoot: options.workspaceRoot ?? '/workspace',
    status: options.status ?? 'creating',
    costProfile: options.costProfile ?? 'standard',
    previewUrls: options.previewUrls,
    createdAt: now,
    lastUsedAt: now,
  };
}

/**
 * 更新 SandboxHandle 的最后使用时间
 */
export function updateSandboxHandleLastUsed(handle: SandboxHandle): SandboxHandle {
  return {
    ...handle,
    lastUsedAt: new Date().toISOString(),
  };
}

/**
 * 更新 SandboxHandle 的状态
 */
export function updateSandboxHandleStatus(handle: SandboxHandle, status: SandboxStatus): SandboxHandle {
  return {
    ...handle,
    status,
  };
}

