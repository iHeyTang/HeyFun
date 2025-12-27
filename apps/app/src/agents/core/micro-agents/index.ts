/**
 * 微代理模块导出
 *
 * 注意：所有微代理功能已转换为 Tool，由 LLM 按需调用
 * 微代理系统已不再使用，但保留类型定义和管理器以供未来扩展
 */

export * from './types';
export * from './manager';

// 导出单例管理器
export { microAgentManager } from './manager';
