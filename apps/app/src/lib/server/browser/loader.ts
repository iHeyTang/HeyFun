/**
 * Python 脚本加载器
 * 使用 webpack 在构建时将脚本内容内联到代码中
 * 这样在 Vercel standalone 模式下也能正常工作
 */

// 直接导入 Python 脚本，webpack 会将其作为字符串内联
// next.config.ts 中已配置 .py 文件为 asset/source 类型
import checkBrowserScriptContent from './scripts/check-browser.py';
import navigateScriptContent from './scripts/navigate.py';
import clickScriptContent from './scripts/click.py';
import clickAtScriptContent from './scripts/click-at.py';
import scrollScriptContent from './scripts/scroll.py';
import typeScriptContent from './scripts/type.py';
import extractContentScriptContent from './scripts/extract-content.py';
import screenshotScriptContent from './scripts/screenshot.py';
import downloadScriptContent from './scripts/download.py';
import browserLauncherScriptContent from './scripts/browser-launcher.py';

// 导出脚本内容（webpack 会将文件内容作为字符串导入）
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
