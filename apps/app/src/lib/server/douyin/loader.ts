/**
 * 抖音工具 Python 脚本加载器
 * 在运行时读取 Python 脚本文件，避免 Turbopack 的限制
 */
import { loadScriptFile } from '@/lib/shared/script-loader';

// 获取当前文件的 import.meta.url（在模块级别）
const currentModuleUrl = typeof import.meta !== 'undefined' ? import.meta.url : '';

// 预加载所有脚本（在模块加载时）
export const parseVideoScript = loadScriptFile(currentModuleUrl, 'scripts/parse-video.py');
export const downloadVideoScript = loadScriptFile(currentModuleUrl, 'scripts/download-video.py');
