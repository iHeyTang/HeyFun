import { ToolContext } from '../../context';
import { retrieveContextParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import type { UnifiedChat } from '@/llm/chat';

/**
 * 提取消息文本内容
 */
function extractMessageText(content: UnifiedChat.Message['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || '')
      .join(' ');
  }

  return String(content);
}

export const retrieveContextExecutor = definitionToolExecutor(retrieveContextParamsSchema, async (params, context: ToolContext) => {
  const { maxSnapshots = 3 } = params;

  const sessionId = context.sessionId;
  if (!sessionId) {
    return {
      success: true,
      retrieved: false,
      snapshotCount: 0,
      integratedMessages: 0,
      keyPoints: [],
    };
  }

  // 获取上下文管理状态
  const managementState = await prisma.contextManagementStates.findUnique({
    where: { sessionId },
  });

  if (!managementState || !managementState.lastSnapshotId) {
    return {
      success: true,
      retrieved: false,
      snapshotCount: 0,
      integratedMessages: 0,
      keyPoints: [],
    };
  }

  // 检索最近的快照
  const snapshots = await prisma.contextSnapshots.findMany({
    where: { sessionId },
    orderBy: { version: 'desc' },
    take: maxSnapshots,
  });

  if (snapshots.length === 0) {
    return {
      success: true,
      retrieved: false,
      snapshotCount: 0,
      integratedMessages: 0,
      keyPoints: [],
    };
  }

  // 整合快照信息
  const allKeyPoints: string[] = [];
  const allPreservedContexts: string[] = [];
  const allImportantDecisions: string[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.keyPoints && Array.isArray(snapshot.keyPoints)) {
      allKeyPoints.push(...(snapshot.keyPoints as string[]));
    }
    if (snapshot.preservedContext) {
      allPreservedContexts.push(snapshot.preservedContext);
    }
    if (snapshot.importantDecisions && Array.isArray(snapshot.importantDecisions)) {
      allImportantDecisions.push(...(snapshot.importantDecisions as string[]));
    }
  }

  // 去重
  const uniqueKeyPoints = Array.from(new Set(allKeyPoints));
  const uniquePreservedContext = allPreservedContexts.join('\n\n');

  // 构建整合后的上下文消息
  const integratedMessages: UnifiedChat.Message[] = [...(context.messages || [])];

  // 如果有保留的上下文，添加到系统消息中
  if (uniquePreservedContext || uniqueKeyPoints.length > 0 || allImportantDecisions.length > 0) {
    const contextContent = [
      uniquePreservedContext ? `## 保留的上下文\n${uniquePreservedContext}` : '',
      uniqueKeyPoints.length > 0 ? `## 关键信息点\n${uniqueKeyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : '',
      allImportantDecisions.length > 0 ? `## 重要决策\n${allImportantDecisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // 查找系统消息，如果没有则添加
    const systemMsgIndex = integratedMessages.findIndex(msg => msg.role === 'system');
    if (systemMsgIndex >= 0) {
      // 更新现有系统消息
      const existingSystemMsg = integratedMessages[systemMsgIndex]!;
      const existingContent = extractMessageText(existingSystemMsg.content);
      integratedMessages[systemMsgIndex] = {
        ...existingSystemMsg,
        content: `${existingContent}\n\n[长期记忆 - 从历史对话中恢复]\n\n${contextContent}`,
      };
    } else {
      // 添加新的系统消息
      integratedMessages.unshift({
        role: 'system',
        content: `[长期记忆 - 从历史对话中恢复]\n\n${contextContent}`,
      });
    }
  }

  // 注意：工具执行在浏览器端完成，无法直接更新消息历史
  // 工具返回修改后的消息，由调用方处理
  return {
    success: true,
    retrieved: true,
    snapshotCount: snapshots.length,
    integratedMessages: integratedMessages.length - (context.messages?.length || 0),
    keyPoints: uniqueKeyPoints,
    preservedContext: uniquePreservedContext || undefined,
  };
});
