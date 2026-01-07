/**
 * Python 脚本加载器
 * 在运行时读取 Python 脚本文件，避免 Turbopack 的限制
 *
 * 使用共享的 script-loader 工具
 */
import { loadScriptFile } from '@/lib/shared/script-loader';

// 获取当前文件的 import.meta.url（在模块级别）
const currentModuleUrl = typeof import.meta !== 'undefined' ? import.meta.url : '';

// 预加载所有脚本（在模块加载时）
// 脚本文件在 scripts 子目录下，所以需要指定相对路径
export const checkBrowserScript = loadScriptFile(currentModuleUrl, 'scripts/check-browser.py');
export const navigateScript = loadScriptFile(currentModuleUrl, 'scripts/navigate.py');
export const clickScript = loadScriptFile(currentModuleUrl, 'scripts/click.py');
export const clickAtScript = loadScriptFile(currentModuleUrl, 'scripts/click-at.py');
export const scrollScript = loadScriptFile(currentModuleUrl, 'scripts/scroll.py');
export const typeScript = loadScriptFile(currentModuleUrl, 'scripts/type.py');
export const extractContentScript = loadScriptFile(currentModuleUrl, 'scripts/extract-content.py');
export const screenshotScript = loadScriptFile(currentModuleUrl, 'scripts/screenshot.py');
export const browserLauncherScript = loadScriptFile(currentModuleUrl, 'scripts/browser-launcher.py');
