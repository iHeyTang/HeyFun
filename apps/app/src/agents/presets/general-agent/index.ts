/**
 * General Agent - 通用智能助手
 * 基于 ReAct 框架的通用对话助手，可用于各种日常任务
 *
 * 这是一个 Preset 层实现，继承自 ReactAgent 框架，
 * 配置了通用的提示词，不包含特定领域的工具。
 *
 * 提示词结构（分层+模板+插槽）：
 * - 框架层（ReactAgent）：ReAct 工作方式
 * - Preset 层（本文件）：身份定位、工作流程、约束条件
 * - 动态层（initialize_agent）：检索到的提示词片段
 */

import { AgentConfig } from '@/agents/core/frameworks/base';
import { ReactAgent } from '@/agents/core/frameworks/react';
import { getPromptBlocks } from './system-prompt';
import getTools from './tools';

/**
 * 通用 Agent 实现 - 基于 ReactAgent 框架
 */
export class GeneralAgent extends ReactAgent {
  protected get config(): AgentConfig {
    const observationPrompt = `工具执行完成。请继续：
1. 分析当前任务状态，判断是否完成
2. 如果未完成，立即调用下一个工具
3. 分析工具结果，为下一步做准备

不要等待用户确认，自主判断任务完成状态并继续执行！`;

    return {
      id: 'general',
      name: 'General Assistant',
      description: '通用智能助手，基于 ReAct 框架，可用于各种日常对话和任务',
      promptBlocks: getPromptBlocks(),
      tools: getTools(),
      observationPrompt,
    };
  }
}
