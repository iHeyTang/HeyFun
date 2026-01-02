/**
 * 系统提示词模板系统
 *
 * 分层结构：
 * 1. 框架层（Framework Layer）- 定义基础的工作方式（如 ReAct 循环）
 * 2. Preset 层（Preset Layer）- 定义角色、工作流程、约束条件等
 * 3. 动态层（Dynamic Layer）- 运行时检索的提示词片段
 *
 * 每层都可以定义多个 Block，最终按顺序组装成完整的系统提示词
 */

/**
 * 系统提示词 Block
 * 每个 Block 是一个独立的提示词片段，包含标题和内容
 */
export interface SystemPromptBlock {
  /** Block 唯一标识 */
  id: string;
  /** Block 标题（可选，会作为 Markdown 标题输出） */
  title?: string;
  /** Block 内容 */
  content: string;
  /** Block 优先级（数字越小越靠前，默认 100） */
  priority?: number;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

/**
 * 系统提示词层级
 */
export enum SystemPromptLayer {
  /** 框架层 - 定义基础工作方式 */
  FRAMEWORK = 'framework',
  /** Preset 层 - 定义角色、工作流程、约束条件 */
  PRESET = 'preset',
  /** 动态层 - 运行时检索的提示词片段 */
  DYNAMIC = 'dynamic',
}

/**
 * 系统提示词模板
 * 包含多个层级的 Block 集合
 */
export interface SystemPromptTemplate {
  /** 框架层 Blocks */
  framework?: SystemPromptBlock[];
  /** Preset 层 Blocks */
  preset?: SystemPromptBlock[];
  /** 动态层 Blocks（运行时填充） */
  dynamic?: SystemPromptBlock[];
}

/**
 * Preset 提示词配置
 * Preset 层需要实现这个接口来定义自己的提示词 Blocks
 */
export interface PresetPromptConfig {
  /** 角色定位 Block */
  identity?: SystemPromptBlock;
  /** 工作流程 Block */
  workflow?: SystemPromptBlock;
  /** 约束条件 Block */
  constraints?: SystemPromptBlock;
  /** 其他自定义 Blocks */
  customBlocks?: SystemPromptBlock[];
}

