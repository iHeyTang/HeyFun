/**
 * Python 脚本加载器
 * 在运行时读取 Python 脚本文件，避免 Turbopack 的限制
 *
 * 使用共享的 script-loader 工具
 */
import { loadScriptFile } from '@/lib/shared/script-loader';

// 获取当前文件的 import.meta.url（在模块级别）
const getCurrentModuleUrl = () => import.meta.url.replace('loader.ts', '');

// 预加载所有脚本（在模块加载时）
// 脚本文件在 scripts 子目录下，所以需要指定相对路径
export const checkBrowserScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/check-browser.py');
export const navigateScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/navigate.py');
export const clickScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/click.py');
export const clickAtScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/click-at.py');
export const scrollScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/scroll.py');
export const typeScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/type.py');
export const extractContentScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/extract-content.py');
export const screenshotScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/screenshot.py');
export const downloadScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/download.py');
export const browserLauncherScript = () => loadScriptFile(getCurrentModuleUrl(), 'scripts/browser-launcher.py');
