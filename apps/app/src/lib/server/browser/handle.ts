/**
 * BrowserHandle - 可序列化的 Browser 句柄
 * 用于在 Upstash Workflow state 中持久化 browser 信息
 * Agent 只能通过这个句柄引用 browser，不能访问 browser 的内部实现
 */

export type BrowserProvider = 'playwright' | 'browser-use';

export type BrowserStatus = 'creating' | 'ready' | 'idle' | 'expired';

/**
 * BrowserHandle - 可序列化的 Browser 句柄
 * 必须可以在 Upstash Workflow state 中安全存储
 *
 * 注意：浏览器在 sandbox 中运行，状态（cookies、localStorage 等）会持久化到 sandbox 的文件系统中
 */
export interface BrowserHandle {
  /** Browser 唯一标识符 */
  id: string;
  /** Browser Provider 类型 */
  provider: BrowserProvider;
  /** 关联的 Sandbox ID（浏览器在 sandbox 中运行） */
  sandboxId: string;
  /** Browser 状态 */
  status: BrowserStatus;
  /** 当前页面 URL */
  currentUrl?: string;
  /** 浏览器调试端口（用于前端 iframe 访问，在 sandbox 中） */
  debugPort?: number;
  /** 浏览器 WebSocket 端点（用于 CDP 连接） */
  wsEndpoint?: string;
  /** 浏览器状态文件路径（在 sandbox 中） */
  stateFilePath?: string;
  /** 创建时间（ISO 8601 字符串） */
  createdAt: string;
  /** 最后使用时间（ISO 8601 字符串） */
  lastUsedAt?: string;
}

/**
 * 创建默认的 BrowserHandle
 */
export function createBrowserHandle(
  id: string,
  provider: BrowserProvider,
  sandboxId: string,
  options: {
    status?: BrowserStatus;
    debugPort?: number;
    wsEndpoint?: string;
    stateFilePath?: string;
  } = {},
): BrowserHandle {
  const now = new Date().toISOString();
  return {
    id,
    provider,
    sandboxId,
    status: options.status ?? 'creating',
    debugPort: options.debugPort,
    wsEndpoint: options.wsEndpoint,
    stateFilePath: options.stateFilePath ?? `/workspace/.browser-state-${id}.json`,
    createdAt: now,
    lastUsedAt: now,
  };
}

/**
 * 更新 BrowserHandle 的最后使用时间
 */
export function updateBrowserHandleLastUsed(handle: BrowserHandle): BrowserHandle {
  return {
    ...handle,
    lastUsedAt: new Date().toISOString(),
  };
}

/**
 * 更新 BrowserHandle 的状态
 */
export function updateBrowserHandleStatus(handle: BrowserHandle, status: BrowserStatus): BrowserHandle {
  return {
    ...handle,
    status,
  };
}

/**
 * 更新 BrowserHandle 的当前 URL
 */
export function updateBrowserHandleUrl(handle: BrowserHandle, url: string): BrowserHandle {
  return {
    ...handle,
    currentUrl: url,
  };
}

