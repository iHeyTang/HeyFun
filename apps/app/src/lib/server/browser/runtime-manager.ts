/**
 * Browser Runtime Manager (BRM)
 * 作为 browser provider 的抽象层，屏蔽 Playwright / browser-use 等 provider 差异
 *
 * 注意：Agent 不能直接调用 BRM，只能通过 Tool 间接操作
 */

import type { BrowserHandle } from './handle';

/**
 * 浏览器操作结果
 */
export interface BrowserActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Browser Runtime Manager 接口
 * 所有 browser provider 必须实现此接口
 */
export interface BrowserRuntimeManager {
  /**
   * 创建新的 browser 实例
   * @param sandboxId 关联的 sandbox ID（浏览器在 sandbox 中运行）
   * @param sessionId Session ID（用于查找 sandbox）
   * @param options 创建选项
   */
  create(
    sandboxId: string,
    sessionId: string,
    options?: {
      headless?: boolean;
      debugPort?: number;
    },
  ): Promise<BrowserHandle>;

  /**
   * 根据 handle 恢复/获取已存在的 browser 实例
   * @param handle BrowserHandle
   */
  get(handle: BrowserHandle): Promise<BrowserRuntimeInstance>;

  /**
   * 导航到指定 URL
   * @param handle BrowserHandle
   * @param url 目标 URL
   * @param options 导航选项
   */
  navigate(
    handle: BrowserHandle,
    url: string,
    options?: {
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      timeout?: number;
      sessionId?: string;
      organizationId?: string;
    },
  ): Promise<BrowserActionResult>;

  /**
   * 点击元素
   * @param handle BrowserHandle
   * @param selector 元素选择器或坐标 (格式: "x,y" 或 CSS 选择器)
   * @param options 点击选项
   */
  click(
    handle: BrowserHandle,
    selector: string,
    options?: {
      timeout?: number;
      sessionId?: string;
    },
  ): Promise<BrowserActionResult>;

  /**
   * 坐标点击
   * @param handle BrowserHandle
   * @param x X 坐标
   * @param y Y 坐标
   * @param options 点击选项
   */
  clickAt(
    handle: BrowserHandle,
    x: number,
    y: number,
    options?: {
      sessionId?: string;
    },
  ): Promise<BrowserActionResult>;

  /**
   * 滚动页面
   * @param handle BrowserHandle
   * @param deltaX 水平滚动距离
   * @param deltaY 垂直滚动距离
   * @param options 滚动选项
   */
  scroll(
    handle: BrowserHandle,
    deltaX: number,
    deltaY: number,
    options?: {
      sessionId?: string;
    },
  ): Promise<BrowserActionResult>;

  /**
   * 输入文本
   * @param handle BrowserHandle
   * @param selector 元素选择器
   * @param text 要输入的文本
   * @param options 输入选项
   */
  type(
    handle: BrowserHandle,
    selector: string,
    text: string,
    options?: {
      timeout?: number;
      sessionId?: string;
    },
  ): Promise<BrowserActionResult>;

  /**
   * 提取页面内容
   * @param handle BrowserHandle
   * @param options 提取选项
   */
  extractContent(
    handle: BrowserHandle,
    options?: {
      selector?: string;
      extractType?: 'text' | 'html' | 'markdown';
      sessionId?: string;
      organizationId?: string;
    },
  ): Promise<BrowserActionResult>;

  /**
   * 截图
   * @param handle BrowserHandle
   * @param options 截图选项
   */
  screenshot(
    handle: BrowserHandle,
    options?: {
      fullPage?: boolean;
      format?: 'png' | 'jpeg';
      sessionId?: string;
      organizationId?: string;
    },
  ): Promise<BrowserActionResult>;

  /**
   * 保存浏览器状态（cookies、localStorage 等）
   * @param handle BrowserHandle
   */
  saveState(handle: BrowserHandle): Promise<void>;

  /**
   * 恢复浏览器状态（cookies、localStorage 等）
   * @param handle BrowserHandle
   */
  restoreState(handle: BrowserHandle): Promise<void>;

  /**
   * 删除 browser 实例
   * @param handle BrowserHandle
   * @returns handle（状态会自动保留）
   */
  destroy(handle: BrowserHandle): Promise<BrowserHandle>;
}

/**
 * Browser Runtime Instance
 * 用于直接操作 browser（内部使用，不暴露给 Agent）
 */
export interface BrowserRuntimeInstance {
  handle: BrowserHandle;
  // 可以添加其他内部状态
}
