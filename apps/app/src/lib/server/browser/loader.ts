/**
 * Python 脚本加载器
 * 使用运行时文件系统读取脚本内容，兼容 Turbopack 和 webpack
 * 脚本文件会在构建时被包含在输出中
 */

import { createScriptLoader } from '@/lib/shared/script-loader';

// 创建脚本加载器
const loadScript = createScriptLoader(import.meta.url);

// 在运行时加载脚本内容（首次访问时加载，后续使用缓存）
export const checkBrowserScript = loadScript('scripts/check-browser.py');
export const navigateScript = loadScript('scripts/navigate.py');
export const clickScript = loadScript('scripts/click.py');
export const clickAtScript = loadScript('scripts/click-at.py');
export const scrollScript = loadScript('scripts/scroll.py');
export const typeScript = loadScript('scripts/type.py');
export const extractContentScript = loadScript('scripts/extract-content.py');
export const screenshotScript = loadScript('scripts/screenshot.py');
export const downloadScript = loadScript('scripts/download.py');
export const browserLauncherScript = loadScript('scripts/browser-launcher.py');
