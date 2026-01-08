/**
 * 抖音工具 Python 脚本加载器
 * 使用 webpack 的 ?raw 查询参数在构建时内联脚本内容
 * 这样不依赖运行时的文件系统，适用于所有部署环境
 */

// 使用 import ... ?raw 在构建时内联脚本内容
import parseVideoScriptContent from './scripts/parse-video.py?raw';
import downloadVideoScriptContent from './scripts/download-video.py?raw';

// 导出脚本内容（在构建时已经内联到代码中）
export const parseVideoScript = parseVideoScriptContent;
export const downloadVideoScript = downloadVideoScriptContent;
