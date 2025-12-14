/**
 * 安全检测微代理
 *
 * 在最终答案生成前检测敏感信息泄露、安全漏洞等
 * 适用于所有场景，确保输出内容的安全性
 */

import type { IMicroAgent, MicroAgentContext, MicroAgentResult, MicroAgentConfig } from './types';
import { MicroAgentTrigger } from './types';
import type { ChatMessage } from '../../llm/types/chat';
import { gatewayService } from '../../llm/services/gateway';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * 安全检测结果
 */
export interface SecurityCheckResult {
  hasIssues: boolean; // 是否有安全问题
  issues: Array<{
    type: 'sensitive_info' | 'security_vulnerability' | 'privacy_leak' | 'insecure_code';
    severity: 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
    location?: string; // 问题位置（如代码行号）
  }>;
  sanitized: boolean; // 是否已自动处理
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
 * 构建安全检测提示词
 */
function buildSecurityCheckPrompt(context: MicroAgentContext): string {
  const recentMessages = context.chatMessages.slice(-3);
  const lastAssistantMessage = recentMessages.filter((msg) => msg.role === 'assistant').pop();

  if (!lastAssistantMessage) {
    return '';
  }

  const assistantContent = extractMessageText(lastAssistantMessage.content);

  return `你是一个专业的安全检测助手。请检查以下内容是否存在安全问题。

## 待检查内容

${assistantContent}

## 检测维度

### 1. 敏感信息泄露
- API 密钥、访问令牌、密码等凭证信息
- 个人隐私信息（身份证号、手机号、邮箱等）
- 内部系统信息（IP地址、数据库连接字符串等）
- 商业机密信息

### 2. 安全漏洞
- SQL 注入风险
- XSS 跨站脚本攻击风险
- 命令注入风险
- 不安全的加密算法
- 硬编码的敏感信息

### 3. 隐私泄露
- 用户个人信息泄露
- 未授权的数据访问
- 违反隐私保护规范

### 4. 不安全代码
- 缺少输入验证
- 缺少错误处理
- 不安全的文件操作
- 权限控制不当

## 输出格式

请以 JSON 格式输出，包含以下字段：
- hasIssues: boolean - 是否存在安全问题
- issues: Array<{type: string, severity: string, message: string, suggestion: string}> - 问题列表（如果无问题则为空数组）
- autoFixable: boolean - 是否可以自动修复

问题类型（type）：
- "sensitive_info": 敏感信息泄露
- "security_vulnerability": 安全漏洞
- "privacy_leak": 隐私泄露
- "insecure_code": 不安全代码

严重程度（severity）：
- "high": 高风险，必须修复
- "medium": 中等风险，建议修复
- "low": 低风险，可选修复

示例输出（有问题）：
{
  "hasIssues": true,
  "issues": [
    {
      "type": "sensitive_info",
      "severity": "high",
      "message": "检测到 API 密钥泄露：sk-1234567890abcdef",
      "suggestion": "移除 API 密钥，使用环境变量或配置管理工具"
    },
    {
      "type": "security_vulnerability",
      "severity": "medium",
      "message": "SQL 查询存在注入风险",
      "suggestion": "使用参数化查询或 ORM 框架"
    }
  ],
  "autoFixable": true
}

示例输出（无问题）：
{
  "hasIssues": false,
  "issues": [],
  "autoFixable": false
}

请直接输出 JSON，不要添加其他说明文字。`;
}

/**
 * 安全检测微代理
 */
export class SecurityMicroAgent implements IMicroAgent {
  readonly config: MicroAgentConfig;

  constructor(options?: { enabled?: boolean; priority?: number }) {
    this.config = {
      id: 'security-check',
      name: '安全检测',
      description: '检测敏感信息泄露和安全漏洞',
      trigger: MicroAgentTrigger.PRE_FINAL_ANSWER,
      enabled: options?.enabled !== false,
      priority: options?.priority ?? 5, // 高优先级，在最终答案前执行
    };
  }

  async shouldExecute(context: MicroAgentContext): Promise<boolean> {
    // 检查是否有助手消息需要检测
    const hasAssistantMessage = context.chatMessages.some((msg) => msg.role === 'assistant');
    return hasAssistantMessage;
  }

  async execute(context: MicroAgentContext): Promise<MicroAgentResult> {
    try {
      // 构建安全检测提示词
      const prompt = buildSecurityCheckPrompt(context);

      if (!prompt) {
        // 如果没有助手消息，直接返回无问题
        return {
          success: true,
          data: {
            hasIssues: false,
            issues: [],
            sanitized: false,
          } as SecurityCheckResult,
        };
      }

      // 创建 LLM 实例
      const llm = gatewayService.createLLM(context.agentConfig.modelId, {
        temperature: 0.1, // 低温度，确保检测准确性
        maxTokens: 500,
      });

      // 调用 LLM 进行安全检测
      const response = await llm.invoke([
        new SystemMessage('你是一个专业的安全检测助手，擅长识别安全问题和隐私泄露风险。'),
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
        hasIssues: boolean;
        issues: Array<{
          type: string;
          severity: string;
          message: string;
          suggestion: string;
        }>;
        autoFixable: boolean;
      };

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('未找到 JSON 格式');
        }
      } catch (parseError) {
        console.warn('[SecurityMicroAgent] ⚠️ 解析 LLM 响应失败:', parseError);
        return {
          success: true,
          data: {
            hasIssues: false,
            issues: [],
            sanitized: false,
            tokenUsage,
          } as SecurityCheckResult,
          tokenUsage,
        };
      }

      // 验证并转换 issues 类型
      const validatedIssues = (parsedResponse.issues || []).map((issue) => ({
        type: (['sensitive_info', 'security_vulnerability', 'privacy_leak', 'insecure_code'].includes(issue.type) ? issue.type : 'insecure_code') as
          | 'sensitive_info'
          | 'security_vulnerability'
          | 'privacy_leak'
          | 'insecure_code',
        severity: (['high', 'medium', 'low'].includes(issue.severity) ? issue.severity : 'medium') as 'high' | 'medium' | 'low',
        message: issue.message,
        suggestion: issue.suggestion,
      }));

      const result: SecurityCheckResult = {
        hasIssues: parsedResponse.hasIssues || false,
        issues: validatedIssues,
        sanitized: parsedResponse.autoFixable || false,
        tokenUsage,
      };

      if (tokenUsage) {
        console.log('[SecurityMicroAgent] 📊 安全检测 Token 使用:', tokenUsage);
      }

      // 如果有安全问题，记录警告
      if (result.hasIssues && result.issues.length > 0) {
        console.warn(`[SecurityMicroAgent] ⚠️ 检测到 ${result.issues.length} 个安全问题`);
        result.issues.forEach((issue, idx) => {
          console.warn(`  ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
        });
      } else {
        console.log('[SecurityMicroAgent] ✅ 安全检测通过，未发现安全问题');
      }

      return {
        success: true,
        data: result,
        tokenUsage,
        metadata: {
          security: result,
          // 如果检测到安全问题，可以在这里标记需要处理
          shouldWarn: result.hasIssues,
        },
      };
    } catch (error) {
      console.error('[SecurityMicroAgent] ❌ 安全检测失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: {
          hasIssues: false,
          issues: [],
          sanitized: false,
        } as SecurityCheckResult,
      };
    }
  }
}
