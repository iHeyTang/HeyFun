/**
 * 提示词片段配置
 *
 * 用于动态组装 Agent 的系统提示词
 * 可以是特殊语法说明、行为指导、规则约束、示例展示等任何类型的提示词内容
 */

export interface PromptFragmentConfig {
  id: string; // 片段唯一标识符，如 'map-syntax', 'safety-rules' 等
  name: string; // 片段显示名称
  description: string; // 片段描述
  enabled: boolean; // 是否启用（是否包含在系统提示词中）
  content: string; // 提示词内容
  version?: string; // 片段版本
  author?: string; // 片段作者
  category?:
    | 'syntax' // 特殊语法说明（如地图、图表语法）
    | 'guideline' // 行为指导（如回答风格、组织方式）
    | 'rule' // 规则约束（如安全规则、隐私规则）
    | 'example' // 示例展示（如最佳实践示例）
    | 'knowledge' // 领域知识（如特定领域的背景知识）
    | 'format' // 格式规范（如代码风格、文档格式）
    | 'other'; // 其他
  priority?: number; // 优先级（用于排序，数字越大越靠前）
  section?: string; // 所属章节（可选，用于在提示词中分组显示）
}
