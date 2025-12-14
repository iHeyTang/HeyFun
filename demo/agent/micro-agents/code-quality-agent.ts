/**
 * 代码质量检测微代理
 *
 * 在工具调用前检测代码质量问题，提供改进建议
 * 适用于代码审查、重构建议等场景
 */

import type { IMicroAgent, MicroAgentContext, MicroAgentResult, MicroAgentConfig } from './types';
import { MicroAgentTrigger } from './types';
import type { ChatMessage } from '../../llm/types/chat';
import { gatewayService } from '../../llm/services/gateway';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * 代码质量检测结果
 */
export interface CodeQualityResult {
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion';
    severity: 'high' | 'medium' | 'low';
    message: string;
    location?: string;
    suggestion?: string;
  }>;
  score: number; // 代码质量分数 0-100
  summary: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

/**
 * 提取消息文本内容
 */
function extractMessageText(content: ChatMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text || '')
    .join(' ');
}

/**
 * 检查是否涉及代码相关操作
 */
function isCodeRelated(context: MicroAgentContext): boolean {
  const recentMessages = context.chatMessages.slice(-3);

  const codeKeywords = [
    '代码',
    'code',
    '函数',
    'function',
    '类',
    'class',
    '方法',
    'method',
    '变量',
    'variable',
    '重构',
    'refactor',
    '优化',
    'optimize',
    'bug',
    '错误',
    'review',
    '审查',
    '检查',
    'check',
    '质量',
    'quality',
    '改进',
    'improve',
    '实现',
    'implement',
    '编写',
    'write',
    '修改',
    'modify',
    '修复',
    'fix',
  ];

  const messageText = recentMessages
    .map((msg) => extractMessageText(msg.content))
    .join(' ')
    .toLowerCase();

  return codeKeywords.some((keyword) => messageText.includes(keyword.toLowerCase()));
}

/**
 * 构建代码质量检测提示词
 */
function buildCodeQualityPrompt(context: MicroAgentContext): string {
  const recentMessages = context.chatMessages.slice(-5);
  const conversationContext = recentMessages
    .map((msg) => {
      const text = extractMessageText(msg.content);
      if (!text) return '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
      return `${role}: ${text}`;
    })
    .filter((line) => line.length > 0)
    .join('\n');

  return `你是一个专业的代码质量检测助手。请分析以下对话上下文，判断用户是否在进行代码相关的操作，如果是，请提供代码质量检测建议。

## 对话上下文

${conversationContext || '(无上下文)'}

## 分析要求

1. 判断用户是否在进行代码相关操作（编写、审查、重构、优化代码等）
2. 如果是代码相关操作，分析可能存在的代码质量问题
3. 提供具体的改进建议和最佳实践
4. 如果不是代码相关操作，返回空结果

## 代码质量检测维度

- **可读性**: 命名规范、注释完整性、代码结构清晰度
- **可维护性**: 代码复杂度、耦合度、模块化程度
- **性能**: 算法效率、资源使用、潜在性能瓶颈
- **安全性**: 输入验证、错误处理、安全漏洞
- **最佳实践**: 设计模式使用、代码规范遵循

## 输出格式

请以 JSON 格式输出，包含以下字段：
- hasCodeOperation: boolean - 是否涉及代码操作
- issues: Array<{type: string, severity: string, message: string, suggestion?: string}> - 问题列表（如果无代码操作则为空数组）
- score: number - 代码质量分数 0-100（如果无代码操作则为 0）
- summary: string - 简要总结

示例输出（有代码操作）：
{
  "hasCodeOperation": true,
  "issues": [
    {
      "type": "warning",
      "severity": "medium",
      "message": "函数名不够描述性",
      "suggestion": "使用更具描述性的函数名，如 getUserById 而不是 get"
    },
    {
      "type": "suggestion",
      "severity": "low",
      "message": "缺少错误处理",
      "suggestion": "添加 try-catch 块处理可能的异常"
    }
  ],
  "score": 75,
  "summary": "代码整体质量良好，但存在命名和错误处理方面的改进空间"
}

示例输出（无代码操作）：
{
  "hasCodeOperation": false,
  "issues": [],
  "score": 0,
  "summary": "当前对话不涉及代码操作"
}

请直接输出 JSON，不要添加其他说明文字。`;
}

/**
 * 代码质量检测微代理
 */
export class CodeQualityMicroAgent implements IMicroAgent {
  readonly config: MicroAgentConfig;

  constructor(options?: { enabled?: boolean; priority?: number }) {
    this.config = {
      id: 'code-quality',
      name: '代码质量检测',
      description: '检测代码质量问题，提供改进建议',
      trigger: MicroAgentTrigger.PRE_TOOL_CALL,
      enabled: options?.enabled !== false,
      priority: options?.priority ?? 50,
    };
  }

  async shouldExecute(context: MicroAgentContext): Promise<boolean> {
    // 只在涉及代码相关操作时执行
    return isCodeRelated(context);
  }

  async execute(context: MicroAgentContext): Promise<MicroAgentResult> {
    try {
      // 构建代码质量检测提示词
      const prompt = buildCodeQualityPrompt(context);

      // 创建 LLM 实例
      const llm = gatewayService.createLLM(context.agentConfig.modelId, {
        temperature: 0.2,
        maxTokens: 500,
      });

      // 调用 LLM 进行代码质量分析
      const response = await llm.invoke([
        new SystemMessage('你是一个专业的代码质量检测助手，擅长识别代码问题并提供改进建议。'),
        new HumanMessage(prompt),
      ]);

      const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // 提取 token 使用信息
      const extractTokenUsage = (response: any) => {
        const metadata = response?.response_metadata;
        if (!metadata) return undefined;

        if (metadata.usage) {
          return {
            promptTokens: metadata.usage.prompt_tokens ?? metadata.usage.input_tokens ?? 0,
            completionTokens: metadata.usage.completion_tokens ?? metadata.usage.output_tokens ?? 0,
            totalTokens: metadata.usage.total_tokens ?? 0,
            cost: metadata.usage.cost ?? 0,
          };
        }

        if (metadata.tokenUsage) {
          return {
            promptTokens: metadata.tokenUsage.promptTokens ?? 0,
            completionTokens: metadata.tokenUsage.completionTokens ?? 0,
            totalTokens: metadata.tokenUsage.totalTokens ?? 0,
            cost: metadata.usage?.cost ?? 0,
          };
        }

        return undefined;
      };

      const tokenUsage = extractTokenUsage(response);

      // 解析 JSON 响应
      let parsedResponse: {
        hasCodeOperation: boolean;
        issues: Array<{
          type: 'error' | 'warning' | 'suggestion' | string;
          severity: 'high' | 'medium' | 'low' | string;
          message: string;
          suggestion?: string;
        }>;
        score: number;
        summary: string;
      };

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('未找到 JSON 格式');
        }
      } catch (parseError) {
        console.warn('[CodeQualityMicroAgent] ⚠️ 解析 LLM 响应失败:', parseError);
        return {
          success: true,
          data: {
            hasCodeOperation: false,
            issues: [],
            score: 0,
            summary: '代码质量检测解析失败',
            tokenUsage,
          } as CodeQualityResult,
          tokenUsage,
        };
      }

      // 如果无代码操作，直接返回
      if (!parsedResponse.hasCodeOperation) {
        return {
          success: true,
          data: {
            hasCodeOperation: false,
            issues: [],
            score: 0,
            summary: parsedResponse.summary || '当前对话不涉及代码操作',
            tokenUsage,
          } as CodeQualityResult,
          tokenUsage,
        };
      }

      // 验证并转换 issues 类型
      const validatedIssues = (parsedResponse.issues || []).map((issue) => ({
        type: (['error', 'warning', 'suggestion'].includes(issue.type) ? issue.type : 'suggestion') as 'error' | 'warning' | 'suggestion',
        severity: (['high', 'medium', 'low'].includes(issue.severity) ? issue.severity : 'medium') as 'high' | 'medium' | 'low',
        message: issue.message,
        suggestion: issue.suggestion,
      }));

      const result: CodeQualityResult = {
        issues: validatedIssues,
        score: parsedResponse.score || 0,
        summary: parsedResponse.summary || '代码质量检测完成',
        tokenUsage,
      };

      if (tokenUsage) {
        console.log('[CodeQualityMicroAgent] 📊 代码质量检测 Token 使用:', tokenUsage);
      }

      // 如果有问题，记录日志
      if (result.issues.length > 0) {
        console.log(`[CodeQualityMicroAgent] ⚠️ 检测到 ${result.issues.length} 个代码质量问题`);
        result.issues.forEach((issue, idx) => {
          console.log(`  ${idx + 1}. [${issue.severity}] ${issue.message}`);
        });
      }

      return {
        success: true,
        data: result,
        tokenUsage,
        metadata: {
          codeQuality: result,
        },
      };
    } catch (error) {
      console.error('[CodeQualityMicroAgent] ❌ 代码质量检测失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: {
          hasCodeOperation: false,
          issues: [],
          score: 0,
          summary: `检测失败: ${error instanceof Error ? error.message : String(error)}`,
        } as CodeQualityResult,
      };
    }
  }
}
