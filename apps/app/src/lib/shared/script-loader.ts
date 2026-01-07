/**
 * 脚本加载工具
 * 用于从文件系统加载脚本文件（如 Python、Shell 等）
 *
 * 使用场景：
 * - Python 脚本
 * - Shell 脚本
 * - 其他需要在运行时读取的脚本文件
 *
 * 特性：
 * - 使用 import.meta.url 自动获取当前文件目录
 * - 支持相对路径加载
 * - 统一的错误处理
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * 从文件加载脚本内容（原始字符串）
 * @param importMetaUrl - 当前文件的 import.meta.url，用于获取文件目录
 * @param filename - 脚本文件名（相对于当前文件目录）
 * @returns 脚本文件的原始内容
 */
export function loadScriptFile(importMetaUrl: string, filename: string): string {
  if (typeof import.meta === 'undefined' || !importMetaUrl) {
    throw new Error('import.meta.url is not available. This code requires ESM environment.');
  }

  try {
    // 使用 import.meta.url 获取当前文件的目录路径
    const currentDir = dirname(fileURLToPath(importMetaUrl));
    const scriptPath = join(currentDir, filename);
    const script = readFileSync(scriptPath, 'utf-8');
    return script;
  } catch (error) {
    console.error(`[ScriptLoader] Failed to load script file "${filename}":`, error);
    throw new Error(`Failed to load script file "${filename}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 创建脚本加载器（工厂函数）
 * 用于在模块级别创建脚本加载器，避免重复传递 import.meta.url
 *
 * @example
 * ```typescript
 * // 在模块顶部
 * const loadScript = createScriptLoader(import.meta.url);
 *
 * // 使用时
 * const pythonScript = loadScript('my-script.py');
 * ```
 */
export function createScriptLoader(importMetaUrl: string) {
  return (filename: string): string => {
    return loadScriptFile(importMetaUrl, filename);
  };
}

