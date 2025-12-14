/**
 * Agent Service
 * 统一的 Agent 服务层 - 单 Agent ReAct 模式
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { llmService } from '../../llm/services/llm';
import type { ChatMessage } from '../../llm/types/chat';
import { mcpService } from '../../mcp/service';
import { AgentConfig, StreamChunk } from '../types';
import { ReActAgent } from './react-agent';

export class AgentService {
  /**
   * 直接执行消息（流式）- 不需要 Session，所有数据从外部传入
   * 这是正确的设计：数据从 Chat Session 获取，Agent Session 只是临时执行上下文
   */
  async *executeMessage(agentConfig: AgentConfig, messages: ChatMessage[]): AsyncGenerator<StreamChunk, void, unknown> {
    // 发送初始化开始事件
    yield {
      agentId: agentConfig.id,
      conversationId: '',
      content: '正在初始化 Agent...',
      timestamp: Date.now(),
      type: 'initializing_start',
      metadata: {
        agentName: agentConfig.name,
      },
    };

    // 获取 MCP 工具（如果 Agent 配置了 mcpTools）
    const tools: DynamicStructuredTool[] = mcpService.getTools(agentConfig.mcpTools || []);
    console.log(`[AgentService] Agent ${agentConfig.id} 使用 ${tools.length} 个 MCP 工具`);

    // 发送初始化结束事件
    yield {
      agentId: agentConfig.id,
      conversationId: '',
      content: 'Agent 初始化完成',
      timestamp: Date.now(),
      type: 'initializing_end',
      metadata: {
        agentName: agentConfig.name,
        toolsCount: tools.length,
      },
    };

    // 如果有 MCP 工具，使用真正的 ReAct Agent
    if (tools.length > 0) {
      console.log(`[AgentService] 使用 ReAct 模式，工具数量: ${tools.length}`);

      const reactAgent = new ReActAgent(agentConfig, tools);

      // 执行 ReAct 循环（Think-Action-Observation）
      for await (const reactChunk of reactAgent.stream(messages)) {
        // 转换 ReAct 流式块为会话流式块
        const streamChunk: StreamChunk = {
          agentId: agentConfig.id,
          conversationId: '', // 不需要 conversationId
          content: reactChunk.content,
          timestamp: Date.now(),
          type: this.mapReActChunkType(reactChunk.type),
          metadata: {
            agentName: agentConfig.name,
            toolName: reactChunk.toolName,
            toolArgs: reactChunk.toolArgs,
            toolResult: reactChunk.toolResult, // 传递完整的工具结果
            isError: reactChunk.isError,
            ...(reactChunk.tokenUsage && { tokenUsage: reactChunk.tokenUsage }),
          },
        };

        yield streamChunk;
      }
    } else {
      // 没有工具，使用普通 LLM 调用
      console.log(`[AgentService] 使用普通 LLM 模式（无工具）`);

      // 流式调用 LLM
      for await (const chunk of llmService.chatStream(messages, agentConfig.modelId, {
        temperature: agentConfig.temperature,
        maxTokens: agentConfig.maxTokens,
      })) {
        if (chunk) {
          yield {
            agentId: agentConfig.id,
            conversationId: '',
            content: chunk,
            timestamp: Date.now(),
            type: 'text' as const,
            metadata: {
              agentName: agentConfig.name,
            },
          };
        }
      }
    }
  }

  /**
   * 映射 ReAct 块类型到 StreamChunk 类型
   */
  private mapReActChunkType(type: 'thought' | 'action' | 'observation' | 'final_answer'): StreamChunk['type'] {
    switch (type) {
      case 'thought':
        return 'thinking';
      case 'action':
        return 'tool_call';
      case 'observation':
        return 'tool_result';
      case 'final_answer':
        return 'text';
      default:
        return 'text';
    }
  }
}

// 导出单例（使用默认配置）
export const agentService = new AgentService();
