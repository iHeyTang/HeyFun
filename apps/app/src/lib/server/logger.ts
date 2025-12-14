/**
 * 日志工具
 * 使用 Consola 提供美观的日志输出
 */

import { consola } from 'consola';

// 配置 Consola
const logger = consola.withTag('Server Action');

// ANSI 颜色代码
const colors = {
  dim: '\x1b[2m',
  reset: '\x1b[0m',
} as const;

/**
 * 将对象转换为 JSON 字符串，并使用淡色显示
 */
const formatMeta = (meta?: Record<string, any>): string | undefined => {
  if (!meta || Object.keys(meta).length === 0) {
    return undefined;
  }
  try {
    const jsonStr = JSON.stringify(meta);
    // 使用 dim 颜色让数据部分更淡
    return `${colors.dim}${jsonStr}${colors.reset}`;
  } catch (error) {
    const errorJson = JSON.stringify({ error: 'Failed to stringify meta', original: String(meta) });
    return `${colors.dim}${errorJson}${colors.reset}`;
  }
};

export const serverLogger = {
  /**
   * 记录开始日志
   */
  start: (actionName: string, meta?: Record<string, any>) => {
    const metaStr = formatMeta(meta);
    if (metaStr) {
      logger.info(`→ ${actionName} - Started\n${metaStr}`);
    } else {
      logger.info(`→ ${actionName} - Started`);
    }
  },

  /**
   * 记录成功日志
   */
  success: (actionName: string, duration: number, meta?: Record<string, any>) => {
    const metaStr = formatMeta(meta);
    if (metaStr) {
      logger.success(`✓ ${actionName} - Success (${duration}ms)\n${metaStr}`);
    } else {
      logger.success(`✓ ${actionName} - Success (${duration}ms)`);
    }
  },

  /**
   * 记录错误日志
   */
  error: (actionName: string, duration: number, error: Error | string, meta?: Record<string, any>) => {
    const errorMessage = error instanceof Error ? error.message : error;
    const fullMeta = {
      ...meta,
      error: errorMessage,
    };
    const metaStr = formatMeta(fullMeta);
    if (metaStr) {
      logger.error(`✗ ${actionName} - Error (${duration}ms)\n${metaStr}`);
    } else {
      logger.error(`✗ ${actionName} - Error (${duration}ms): ${errorMessage}`);
    }
  },

  /**
   * 记录警告日志
   */
  warn: (actionName: string, message: string, meta?: Record<string, any>) => {
    const metaStr = formatMeta(meta);
    if (metaStr) {
      logger.warn(`⚠ ${actionName} - ${message}\n${metaStr}`);
    } else {
      logger.warn(`⚠ ${actionName} - ${message}`);
    }
  },

  /**
   * 记录调试日志
   */
  debug: (actionName: string, message: string, meta?: Record<string, any>) => {
    const metaStr = formatMeta(meta);
    if (metaStr) {
      logger.debug(`🔍 ${actionName} - ${message}\n${metaStr}`);
    } else {
      logger.debug(`🔍 ${actionName} - ${message}`);
    }
  },
};
