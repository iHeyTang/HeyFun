/**
 * Python 脚本加载器
 * 使用 webpack 的 ?raw 查询参数在构建时内联脚本内容
 * 这样不依赖运行时的文件系统，适用于所有部署环境
 */

// 使用 import ... ?raw 在构建时内联脚本内容
import checkBrowserScriptContent from './scripts/check-browser.py?raw';
import navigateScriptContent from './scripts/navigate.py?raw';
import clickScriptContent from './scripts/click.py?raw';
import clickAtScriptContent from './scripts/click-at.py?raw';
import scrollScriptContent from './scripts/scroll.py?raw';
import typeScriptContent from './scripts/type.py?raw';
import extractContentScriptContent from './scripts/extract-content.py?raw';
import screenshotScriptContent from './scripts/screenshot.py?raw';
import downloadScriptContent from './scripts/download.py?raw';
import browserLauncherScriptContent from './scripts/browser-launcher.py?raw';

// 导出脚本内容（在构建时已经内联到代码中）
export const checkBrowserScript = checkBrowserScriptContent;
export const navigateScript = navigateScriptContent;
export const clickScript = clickScriptContent;
export const clickAtScript = clickAtScriptContent;
export const scrollScript = scrollScriptContent;
export const typeScript = typeScriptContent;
export const extractContentScript = extractContentScriptContent;
export const screenshotScript = screenshotScriptContent;
export const downloadScript = downloadScriptContent;
export const browserLauncherScript = browserLauncherScriptContent;
