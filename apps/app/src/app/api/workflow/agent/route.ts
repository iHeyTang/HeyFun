/**
 * Agent Workflow
 * 使用 Upstash Workflow 自动执行多轮次对话和工具调用
 */

import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { getAgent } from '@/agents';
import { ToolResult } from '@/agents/core/tools/tool-definition';
import { aigcToolbox } from '@/agents/toolboxes/aigc-toolbox';
import { generalToolbox } from '@/agents/toolboxes/general-toolbox';
import { webSearchToolbox } from '@/agents/toolboxes/web-search-toolbox';
import { calculateLLMCost, checkCreditsBalance, deductCredits } from '@/lib/server/credit';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import storage from '@/lib/server/storage';
import CHAT, { UnifiedChat } from '@repo/llm/chat';
import { WorkflowContext } from '@upstash/workflow';
import { serve } from '@upstash/workflow/nextjs';

/**
 * 将图片URL转换为base64数据
 * 某些LLM提供商（如Vercel AI SDK）不支持文件URL，只支持base64数据
 */
async function convertImageUrlToBase64(imageUrl: string, organizationId: string): Promise<string> {
  // 如果已经是base64数据URL，直接返回
  if (imageUrl.startsWith('data:image')) {
    return imageUrl;
  }

  // 如果是OSS key格式（oss://fileKey），直接从存储中读取
  if (imageUrl.startsWith('oss://')) {
    const fileKey = imageUrl.replace('oss://', '');

    // 验证文件权限：确保是组织文件或系统文件
    const isSystemFile = fileKey.startsWith('system/');
    const isOrgFile = fileKey.startsWith(`${organizationId}/`);

    if (!isSystemFile && !isOrgFile) {
      throw new Error(`Access denied: Cannot access file ${fileKey}`);
    }

    // 从OSS直接读取文件
    const fileData = await storage.getBytes(fileKey);
    if (!fileData) {
      throw new Error(`File not found: ${fileKey}`);
    }

    // 识别文件类型
    const buffer = Buffer.from(fileData);
    const { identifyFileTypeFromBuffer } = await import('@/lib/shared/file-type');
    const mimeType = identifyFileTypeFromBuffer(buffer) || 'image/png';

    // 转换为base64
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  // 兼容旧格式：如果是OSS路径（/api/oss/xxx），也从存储中读取
  if (imageUrl.startsWith('/api/oss/')) {
    const fileKey = imageUrl.replace('/api/oss/', '');

    // 验证文件权限：确保是组织文件或系统文件
    const isSystemFile = fileKey.startsWith('system/');
    const isOrgFile = fileKey.startsWith(`${organizationId}/`);

    if (!isSystemFile && !isOrgFile) {
      throw new Error(`Access denied: Cannot access file ${fileKey}`);
    }

    // 从OSS直接读取文件
    const fileData = await storage.getBytes(fileKey);
    if (!fileData) {
      throw new Error(`File not found: ${fileKey}`);
    }

    // 识别文件类型
    const buffer = Buffer.from(fileData);
    const { identifyFileTypeFromBuffer } = await import('@/lib/shared/file-type');
    const mimeType = identifyFileTypeFromBuffer(buffer) || 'image/png';

    // 转换为base64
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  // 对于其他URL，通过HTTP请求下载
  // 构建完整的URL（如果是相对路径，需要添加origin）
  let fullUrl = imageUrl;
  if (imageUrl.startsWith('/')) {
    // 相对路径，需要添加origin（在服务器端，我们需要从环境变量或配置中获取）
    let origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin) {
      // 如果没有设置NEXT_PUBLIC_APP_URL，尝试使用VERCEL_URL
      if (process.env.VERCEL_URL) {
        origin = `https://${process.env.VERCEL_URL}`;
      } else {
        // 开发环境默认使用localhost
        origin = 'http://localhost:3000';
      }
    }
    fullUrl = `${origin}${imageUrl}`;
  }

  // 下载图片
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  // 检查Content-Type
  const contentType = response.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Invalid image content type: ${contentType}`);
  }

  // 转换为base64
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString('base64');
  return `data:${contentType};base64,${base64}`;
}

interface AgentWorkflowConfig {
  organizationId: string;
  sessionId: string;
  userMessageId: string;
  modelId: string;
  agentId?: string | null;
}

// 客户端工具列表（需要前端上下文，无法在后端执行）
const CLIENT_TOOLS = new Set([
  'edit_flow_canvas',
  'get_canvas_state',
  'get_canvas_capabilities',
  'get_node_type_info',
  'auto_layout_canvas',
  'run_canvas_workflow',
]);

/**
 * 执行工具调用（后端版本）
 * 使用 generalToolbox、webSearchToolbox 和 aigcToolbox 来执行服务端工具
 */
async function executeTools(
  toolCalls: any[],
  context: { organizationId: string; sessionId: string; workflow: WorkflowContext },
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name;

    if (!toolName) {
      results.push({
        success: false,
        error: 'Tool name is missing',
      });
      continue;
    }

    // 检查是否是客户端工具
    if (CLIENT_TOOLS.has(toolName)) {
      results.push({
        success: false,
        error: `Tool "${toolName}" requires client-side context and cannot be executed on the server. Please use the web interface to interact with canvas tools.`,
        message: `工具 "${toolName}" 需要在客户端执行，无法在后端执行。请使用 Web 界面与画布工具交互。`,
      });
      continue;
    }

    // 尝试使用各个toolbox执行工具
    let result: ToolResult | null = null;
    if (generalToolbox.has(toolName)) {
      result = await generalToolbox.execute(toolCall, {
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        workflow: context.workflow,
      });
    } else if (webSearchToolbox.has(toolName)) {
      result = await webSearchToolbox.execute(toolCall, {
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        workflow: context.workflow,
      });
    } else if (aigcToolbox.has(toolName)) {
      result = await aigcToolbox.execute(toolCall, {
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        workflow: context.workflow,
        toolCallId: toolCall.id,
      });
    } else {
      // 工具未找到
      result = {
        success: false,
        error: `Tool "${toolName}" is not registered. Available tools: ${[
          ...generalToolbox.getAllToolNames(),
          ...webSearchToolbox.getAllToolNames(),
          ...aigcToolbox.getAllToolNames(),
        ].join(', ')}`,
      };
    }

    if (result) {
      results.push(result);
    }
  }

  return results;
}

export const { POST } = serve<AgentWorkflowConfig>(async context => {
  const { organizationId, sessionId, userMessageId, modelId, agentId } = context.requestPayload;
  // Upstash Workflow 的 runId 可能通过 context.id 或其他方式获取
  // 暂时使用 sessionId 和 messageId 来构造唯一标识
  const workflowRunId = (context as any).id || (context as any).runId || `${sessionId}-${userMessageId}`;

  // 更新状态：pending -> processing（开始执行），并保存 workflow run ID
  await context.run('start-processing', async () => {
    // 将 workflow run ID 存储到 session 的某个地方（可以通过 metadata 或其他方式）
    // 这里我们暂时通过日志记录，实际可以通过 Redis 或其他方式存储
    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: { status: 'processing' },
    });
  });

  // 检查并触发标题生成（如果需要）
  await context.run('check-and-trigger-title-generation', async () => {
    // 获取用户消息内容
    const userMessage = await prisma.chatMessages.findUnique({
      where: { id: userMessageId },
    });

    if (!userMessage) {
      return;
    }

    // 检查是否需要生成标题
    const session = await prisma.chatSessions.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: { role: 'user' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    // 如果是第一条用户消息，且标题为空或者是默认标题，则需要生成标题
    const shouldGenerateTitle =
      session && session.messages.length === 1 && session.messages[0]?.id === userMessageId && (!session.title || session.title === 'New Chat');

    // 如果需要生成标题，立即触发异步标题生成任务（不阻塞主流程）
    if (shouldGenerateTitle) {
      await queue.publish({
        url: '/api/queue/summary',
        body: {
          sessionId,
          userMessage: userMessage.content,
          organizationId,
        },
      });
      console.log(`[Workflow] Triggered title generation for session ${sessionId} at start`);
    }
  });

  // 最大轮次限制，避免无限循环
  const MAX_ROUNDS = 10;
  let roundCount = 0;
  let hasError = false;
  let errorMessage: string | null = null;

  // 主循环：处理多轮次对话
  while (roundCount < MAX_ROUNDS) {
    roundCount++;

    // 步骤1：获取会话和消息历史
    const session = await context.run(`round-${roundCount}-load-session`, async () => {
      return await prisma.chatSessions.findUnique({
        where: {
          id: sessionId,
          organizationId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    if (!session) {
      hasError = true;
      errorMessage = 'Session not found';
      throw new Error('Session not found');
    }

    // 步骤2：加载 Agent 配置和模型
    const [agentConfig, allModels] = await Promise.all([
      context.run(`round-${roundCount}-load-agent`, async () => {
        return getAgent(agentId || undefined);
      }),
      context.run(`round-${roundCount}-load-models`, async () => {
        return await loadModelDefinitionsFromDatabase();
      }),
    ]);

    const modelInfo = allModels.find(m => m.id === modelId);
    if (!modelInfo) {
      hasError = true;
      errorMessage = `Model ${modelId} not found`;
      throw new Error(`Model ${modelId} not found`);
    }

    // 步骤3：构建消息历史
    // 过滤消息：确保工具调用和工具结果正确配对
    // 关键：只包含已完成的消息，但 assistant 消息如果有 toolCalls 即使 isComplete=false 也要包含
    const filteredMessages = session.messages.filter(msg => {
      // 排除当前正在处理的 AI 消息（isComplete=false 且没有 toolCalls）
      if (msg.role === 'assistant' && !msg.isComplete && !msg.toolCalls) {
        return false;
      }

      // 如果是 assistant 消息且有 toolCalls，即使 isComplete=false 也要保留
      // 但需要确保对应的 tool 消息都已创建
      if (msg.role === 'assistant' && msg.toolCalls) {
        // 检查是否有对应的 tool 消息
        const toolCallIds = (msg.toolCalls as any[]).map((tc: any) => tc.id);
        const toolMessages = session.messages.filter(m => m.role === 'tool' && m.toolCallId && toolCallIds.includes(m.toolCallId));
        // 只有当所有工具调用都有对应的工具结果消息时，才包含这个 assistant 消息
        // 或者如果 assistant 消息 isComplete=false，说明工具还在执行中，不应该包含
        if (!msg.isComplete) {
          // 如果 assistant 消息未完成，检查是否所有工具结果都已创建
          return toolMessages.length === toolCallIds.length;
        }
        return true;
      }

      // 如果是 tool 消息，检查是否完成
      if (msg.role === 'tool') {
        return msg.isComplete;
      }

      // 其他消息只保留完成的
      return msg.isComplete && !msg.isStreaming;
    });

    // 构建消息列表，确保工具调用和工具结果配对
    // 需要确保每个 assistant 消息的 tool_calls 都有对应的 tool 消息
    const messages: UnifiedChat.Message[] = [{ role: 'system' as const, content: agentConfig.systemPrompt }];

    // 按顺序处理消息，确保工具调用和工具结果配对
    for (const msg of filteredMessages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        // 对于有 toolCalls 的 assistant 消息，需要确保所有工具结果都存在
        const toolCallIds = (msg.toolCalls as any[]).map((tc: any) => tc.id);
        const toolMessages = filteredMessages.filter(m => m.role === 'tool' && m.toolCallId && toolCallIds.includes(m.toolCallId));

        // 只有当工具结果数量等于工具调用数量时，才添加这条消息
        if (toolMessages.length === toolCallIds.length) {
          const baseMsg: any = {
            role: 'assistant' as const,
            content: msg.content,
            tool_calls: msg.toolCalls,
          };
          messages.push(baseMsg);

          // 添加对应的 tool 消息
          for (const toolCallId of toolCallIds) {
            const toolMsg = toolMessages.find(m => m.toolCallId === toolCallId);
            if (toolMsg) {
              messages.push({
                role: 'tool' as const,
                content: toolMsg.content,
                tool_call_id: toolMsg.toolCallId!,
              });
            }
          }
        }
      } else if (msg.role === 'tool') {
        // tool 消息已经在上面处理了，跳过
        continue;
      } else {
        // 普通消息，需要解析多模态内容
        let messageContent: UnifiedChat.MessageContent = msg.content;

        // 尝试解析JSON格式的多模态内容（支持文本、图片和附件）
        if (msg.role === 'user' && msg.content.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(msg.content);
            if (Array.isArray(parsed)) {
              // 在 workflow 步骤中处理附件（转换图片URL为base64，处理其他附件）
              const processedContent = await context.run(`round-${roundCount}-process-attachments-${msg.id}`, async () => {
                const ossKeys: string[] = [];

                // 先收集所有OSS key
                for (const item of parsed) {
                  if (item.type === 'image_url' && item.image_url?.url && item.image_url.url.startsWith('oss://')) {
                    ossKeys.push(item.image_url.url);
                  }
                }

                // 处理所有内容项
                const processedItems = await Promise.all(
                  parsed.map(async (item: any) => {
                    // 处理图片
                    if (item.type === 'image_url' && item.image_url?.url) {
                      // 如果已经是base64，直接返回
                      if (item.image_url.url.startsWith('data:image')) {
                        return item;
                      }
                      // 转换URL为base64，如果失败则抛出错误
                      const base64Url = await convertImageUrlToBase64(item.image_url.url, organizationId);
                      return {
                        type: 'image_url' as const,
                        image_url: { url: base64Url },
                      };
                    }
                    // 处理其他附件类型
                    if (item.type === 'attachment' && item.attachment) {
                      // 对于文本类型的附件（如 MD、TXT 等），读取文件内容并转换为文本
                      const attachmentType = item.attachment.type || 'file';
                      const mimeType = item.attachment.mimeType || '';

                      // 判断是否是文本文件
                      const isTextFile =
                        attachmentType === 'document' ||
                        mimeType.startsWith('text/') ||
                        mimeType.includes('markdown') ||
                        mimeType.includes('json') ||
                        item.attachment.fileKey.endsWith('.md') ||
                        item.attachment.fileKey.endsWith('.txt') ||
                        item.attachment.fileKey.endsWith('.json') ||
                        item.attachment.fileKey.endsWith('.csv');

                      if (isTextFile) {
                        try {
                          // 从 OSS 读取文件内容
                          const fileData = await storage.getBytes(item.attachment.fileKey);
                          if (fileData) {
                            const textContent = Buffer.from(fileData).toString('utf-8');
                            // 将文件内容作为文本添加到消息中
                            return {
                              type: 'text' as const,
                              text: `[附件: ${item.attachment.name || item.attachment.fileKey}]\n${textContent}`,
                            };
                          }
                        } catch (error) {
                          console.error(`[Workflow] Failed to read attachment file: ${item.attachment.fileKey}`, error);
                          // 如果读取失败，在文本中提及附件
                          return {
                            type: 'text' as const,
                            text: `[附件: ${item.attachment.name || item.attachment.fileKey} - 无法读取文件内容]`,
                          };
                        }
                      } else {
                        // 非文本附件，在消息文本中提及，但不包含在 content 数组中
                        // 这些附件可以通过工具访问
                        return {
                          type: 'text' as const,
                          text: `[附件: ${item.attachment.name || item.attachment.fileKey} (${attachmentType})]`,
                        };
                      }
                    }
                    // 文本内容直接返回
                    if (item.type === 'text') {
                      return item;
                    }
                    return item;
                  }),
                );

                // 如果有OSS格式的图片，在消息末尾添加OSS key信息，方便工具调用时使用
                if (ossKeys.length > 0) {
                  const existingTextIndex = processedItems.findIndex(r => r.type === 'text');
                  const ossKeyText = `\n[用户上传的图片OSS key（可在工具调用中使用）: ${ossKeys.join(', ')}]`;
                  if (existingTextIndex >= 0) {
                    // 如果有文本项，追加到现有文本
                    processedItems[existingTextIndex] = {
                      ...processedItems[existingTextIndex],
                      text: (processedItems[existingTextIndex] as any).text + ossKeyText,
                    };
                  } else {
                    // 如果没有文本项，创建一个新的文本项
                    processedItems.push({
                      type: 'text' as const,
                      text: ossKeyText.trim(),
                    });
                  }
                }

                return processedItems;
              });
              messageContent = processedContent;
            }
          } catch (e) {
            // 解析失败，使用原始字符串
            messageContent = msg.content;
          }
        }

        const baseMsg: any = {
          role: msg.role as UnifiedChat.Message['role'],
          content: messageContent,
        };
        messages.push(baseMsg);
      }
    }

    // 步骤4：检查余额
    const estimatedOutputTokens = 1000;
    const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
    const hasBalance = await context.run(`round-${roundCount}-check-balance`, async () => {
      return await checkCreditsBalance(organizationId, estimatedCost);
    });

    if (!hasBalance) {
      await context.run(`round-${roundCount}-insufficient-balance`, async () => {
        await prisma.chatMessages.create({
          data: {
            sessionId,
            organizationId,
            role: 'assistant',
            content: '余额不足，无法继续对话。请充值后重试。',
            isComplete: true,
            isStreaming: false,
            modelId: modelId,
          },
        });
      });
      break;
    }

    // 步骤5：创建 AI 消息占位
    const aiMessage = await context.run(`round-${roundCount}-create-ai-message`, async () => {
      return await prisma.chatMessages.create({
        data: {
          sessionId,
          organizationId,
          role: 'assistant',
          content: '',
          isStreaming: false,
          isComplete: false,
          modelId: modelId,
        },
      });
    });

    // 步骤6：调用 LLM（在步骤内部处理错误，避免步骤名称冲突）
    const llmResult = await context.run(`round-${roundCount}-call-llm`, async () => {
      try {
        // 在 context.run 内部设置模型和创建客户端，避免重复创建
        CHAT.setModels(allModels);
        const llmClient = CHAT.createClient(modelId);

        const chatParams: UnifiedChat.ChatCompletionParams = {
          messages,
          ...(agentConfig.tools.length > 0 && {
            tools: agentConfig.tools,
            tool_choice: 'auto' as const,
          }),
        };

        let inputTokens = 0;
        let outputTokens = 0;
        let fullContent = '';
        const toolCalls: any[] = [];
        let finishReason: string | null = null;

        const stream = llmClient.chatStream(chatParams);

        for await (const chunk of stream) {
          if (chunk.usage) {
            inputTokens += chunk.usage.prompt_tokens || 0;
            outputTokens += chunk.usage.completion_tokens || 0;
          }

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          if (choice.delta?.content) {
            fullContent += choice.delta.content;
          }

          if (choice.delta?.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {
              const index = (toolCall as any).index ?? 0;
              if (!toolCalls[index]) {
                toolCalls[index] = {
                  id: (toolCall as any).id || `tool_${index}`,
                  type: (toolCall as any).type || 'function',
                  function: {
                    name: (toolCall as any).function?.name || '',
                    arguments: (toolCall as any).function?.arguments || '',
                  },
                };
              } else {
                if ((toolCall as any).function?.name) {
                  toolCalls[index].function.name = (toolCall as any).function.name;
                }
                if ((toolCall as any).function?.arguments) {
                  toolCalls[index].function.arguments += (toolCall as any).function.arguments;
                }
              }
            }
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
            break;
          }
        }

        return {
          success: true,
          data: {
            content: fullContent,
            toolCalls: finishReason === 'tool_calls' ? toolCalls.filter(tc => tc) : [],
            finishReason,
          },
          inputTokens,
          outputTokens,
        };
      } catch (error) {
        // 在步骤内部捕获错误，返回错误信息而不是抛出异常
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Workflow] LLM call error in round ${roundCount}:`, error);
        return {
          success: false,
          error: errorMessage,
          data: null,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
    });

    // 如果LLM调用失败，处理错误
    if (!llmResult.success || !llmResult.data) {
      const llmErrorMessage = llmResult.error || 'Unknown error';
      await context.run(`round-${roundCount}-update-ai-message`, async () => {
        await prisma.chatMessages.update({
          where: { id: aiMessage.id },
          data: {
            content: `错误: ${llmErrorMessage}`,
            isComplete: true,
            isStreaming: false,
          },
        });
      });

      hasError = true;
      errorMessage = `LLM调用失败: ${llmErrorMessage}`;
      break;
    }

    const llmResponse = llmResult.data;
    const inputTokens = llmResult.inputTokens;
    const outputTokens = llmResult.outputTokens;

    // 步骤7：更新 AI 消息
    await context.run(`round-${roundCount}-update-ai-message`, async () => {
      await prisma.chatMessages.update({
        where: { id: aiMessage.id },
        data: {
          content: llmResponse.content,
          isComplete: llmResponse.finishReason !== 'tool_calls',
          toolCalls: llmResponse.toolCalls.length > 0 ? llmResponse.toolCalls : null,
          finishReason: llmResponse.finishReason,
        },
      });
    });

    // 步骤8：扣除费用
    const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
    if (cost > 0) {
      await context.run(`round-${roundCount}-deduct-credits`, async () => {
        await deductCredits(organizationId, cost);
      });
    }

    // 步骤9：如果有工具调用，执行工具
    if (llmResponse.toolCalls.length > 0) {
      // 分离客户端工具和服务端工具
      const clientTools: any[] = [];
      const serverTools: any[] = [];

      for (const toolCall of llmResponse.toolCalls) {
        const toolName = toolCall.function?.name;
        if (toolName && CLIENT_TOOLS.has(toolName)) {
          clientTools.push(toolCall);
        } else {
          serverTools.push(toolCall);
        }
      }

      // 执行服务端工具
      let serverToolResults: ToolResult[] = [];
      if (serverTools.length > 0) {
        serverToolResults = await executeTools(serverTools, {
          organizationId,
          sessionId,
          workflow: context,
        });

        // 保存服务端工具结果消息
        await context.run(`round-${roundCount}-save-server-tool-results`, async () => {
          for (let i = 0; i < serverTools.length; i++) {
            const toolCall = serverTools[i];
            const result = serverToolResults[i];

            if (toolCall && result) {
              await prisma.chatMessages.create({
                data: {
                  sessionId,
                  organizationId,
                  role: 'tool',
                  content: JSON.stringify(result),
                  toolCallId: toolCall.id,
                  isComplete: true,
                },
              });
            }
          }
        });
      }

      // 如果有客户端工具，等待前端执行完成
      if (clientTools.length > 0) {
        // 等待客户端工具完成事件
        const eventName = `tool-result:${sessionId}:${aiMessage.id}`;
        await context.run(`round-${roundCount}-wait-for-client-tools`, async () => {
          // 标记消息状态，表示正在等待客户端工具执行
          // 同时将 workflow run ID 和 event name 存储到消息的 metadata 中（可以通过其他字段存储）
          await prisma.chatMessages.update({
            where: { id: aiMessage.id },
            data: {
              isComplete: false, // 等待工具执行
              // 可以将 workflowRunId 和 eventName 存储到 finishReason 字段（临时使用）
              finishReason: JSON.stringify({ workflowRunId, eventName }),
            },
          });
        });

        // 等待事件（Upstash Workflow 的 waitForEvent）
        await context.waitForEvent(`round-${roundCount}-wait-for-client-tools`, eventName, {
          timeout: '5m', // 5分钟超时
        });

        // 事件触发后，继续执行（工具结果已经由 tool-result API 保存）
      }

      // 继续下一轮对话（工具执行后需要继续）
      continue;
    }

    // 如果没有工具调用，对话完成
    await context.run(`round-${roundCount}-complete`, async () => {
      await prisma.chatMessages.update({
        where: { id: aiMessage.id },
        data: {
          isComplete: true,
        },
      });

      await prisma.chatSessions.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    });

    // 对话完成，退出循环
    break;
  }

  // 如果达到最大轮次，标记为完成
  if (roundCount >= MAX_ROUNDS) {
    await context.run('max-rounds-reached', async () => {
      await prisma.chatMessages.create({
        data: {
          sessionId,
          organizationId,
          role: 'assistant',
          content: `已达到最大轮次限制（${MAX_ROUNDS} 轮），对话已结束。`,
          isComplete: true,
          isStreaming: false,
        },
      });
    });
  }

  // 更新状态：processing -> idle（执行完成或失败都设为idle，避免阻塞新消息）
  await context.run('finish-processing', async () => {
    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: {
        status: 'idle', // 无论成功还是失败，都设为idle，避免阻塞新消息
        updatedAt: new Date(),
      },
    });
  });
});
