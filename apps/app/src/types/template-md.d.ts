/**
 * TypeScript 类型声明：支持导入 .template.md 文件作为字符串
 * 支持两种方式：
 * 1. 直接导入：import content from './file.template.md'
 * 2. 使用 ?raw 查询参数：import content from './file.template.md?raw'
 */
declare module '*.template.md' {
  const content: string;
  export default content;
}

declare module '*.template.md?raw' {
  const content: string;
  export default content;
}

