/**
 * 抖音工具 Python 脚本加载器
 * 使用 webpack 在构建时将脚本内容内联到代码中
 * 这样在 Vercel standalone 模式下也能正常工作
 */

// 直接导入 Python 脚本，webpack 会将其作为字符串内联
// next.config.ts 中已配置 .py 文件为 asset/source 类型
import parseVideoScriptContent from './scripts/parse-video.py';
import downloadVideoScriptContent from './scripts/download-video.py';

// 导出脚本内容（webpack 会将文件内容作为字符串导入）
export const parseVideoScript = parseVideoScriptContent;
export const downloadVideoScript = downloadVideoScriptContent;
