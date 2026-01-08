/**
 * Daytona SDK 类型扩展
 * 扩展 @daytonaio/sdk 的类型定义，添加 previewUrls 等属性
 */

import '@daytonaio/sdk';

declare module '@daytonaio/sdk' {
  interface Sandbox {
    /**
     * 预览 URL 映射（端口 -> URL）
     * 用于外部访问 sandbox 中运行的服务
     * 例如：{ 9222: "https://preview-xxx.daytona.dev", 8080: "https://preview-yyy.daytona.dev" }
     */
    previewUrls?: Record<number, string>;
    /**
     * 预览 URL（单个，如果存在）
     * 某些情况下可能只有一个基础 previewUrl
     */
    previewUrl?: string;
    /**
     * 预览 URL（下划线命名，兼容不同命名风格）
     */
    preview_urls?: Record<number, string>;
    preview_url?: string;
    /**
     * Sandbox URL（可能用于外部访问）
     */
    url?: string;
  }

  /**
   * Sandbox 创建选项扩展
   * 添加端口暴露配置和 idle 超时配置
   */
  interface SandboxCreateOptions {
    /**
     * 要暴露的端口列表
     * 这些端口将被映射到外部可访问的 previewUrl
     * 例如：[9222, 8080] 会暴露 CDP 端口和 Web 服务端口
     */
    ports?: number[];
    /**
     * 端口范围（如果指定，会暴露该范围内的所有端口）
     * 例如：{ start: 9000, end: 9999 } 会暴露 9000-9999 的所有端口
     */
    portRange?: { start: number; end: number };
    /**
     * idle 超时时间（秒）
     * sandbox 在 idle 状态超过此时间后自动关闭
     * 例如：300 表示 5 分钟后自动关闭
     */
    idleTimeout?: number;
  }
}

