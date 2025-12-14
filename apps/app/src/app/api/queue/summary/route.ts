import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import CHAT from '@repo/llm/chat';
import { loadModelDefinitionsFromDatabase } from '@/actions/llm';

// 注册此 route 的 body 类型到 QueueRoutes interface
declare module '@/lib/server/queue' {
  interface QueueRoutes {
    '/api/queue/summary': {
      sessionId: string;
      userMessage: string;
      organizationId: string;
    };
  }
}

/**
 * 异步生成会话标题
 * 通过队列异步执行，不阻塞主流程
 */
async function generateSessionTitle(sessionId: string, userMessage: string, organizationId: string): Promise<void> {
  try {
    // 加载模型定义
    const allModels = await loadModelDefinitionsFromDatabase();

    // 尝试使用的内置模型ID列表（按优先级）
    const preferredModelIds = ['openai/gpt-4o-mini', 'openai/gpt-3.5-turbo', 'openai/gpt-4o'];

    // 查找可用的模型
    let modelInfo = null;
    let titleModelId = null;
    for (const modelId of preferredModelIds) {
      const found = allModels.find(m => m.id === modelId);
      if (found) {
        modelInfo = found;
        titleModelId = modelId;
        break;
      }
    }

    // 如果找不到任何可用的模型，直接使用截取标题
    if (!modelInfo || !titleModelId) {
      const fallbackTitle = userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
      await prisma.chatSessions.update({
        where: { id: sessionId, organizationId },
        data: { title: fallbackTitle },
      });
      console.log(`[Queue] Title generation skipped, using fallback: ${fallbackTitle}`);
      return;
    }

    // 设置模型列表到 CHAT 实例
    CHAT.setModels(allModels);

    // 使用快速模型生成标题
    const llmClient = CHAT.createClient(titleModelId);

    const response = await llmClient.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个标题生成助手。根据用户的消息，生成一个简洁的会话标题（5-8个字），直接返回标题文本，不要有任何其他内容。',
        },
        {
          role: 'user',
          content: `用户消息：${userMessage}\n\n请为这个会话生成一个简洁的标题（5-8个字）：`,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
      stream: false,
    });

    const messageContent = response.choices[0]?.message?.content;
    const title = (typeof messageContent === 'string' ? messageContent.trim() : '') || userMessage.substring(0, 30);

    // 更新会话标题（标题生成不扣费）
    await prisma.chatSessions.update({
      where: { id: sessionId, organizationId },
      data: { title },
    });

    console.log(`[Queue] Generated title for session ${sessionId}: ${title}`);
  } catch (error) {
    console.error('[Queue] Failed to generate title:', error);
    // 如果失败，使用简单截取
    const fallbackTitle = userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
    await prisma.chatSessions
      .update({
        where: { id: sessionId, organizationId },
        data: { title: fallbackTitle },
      })
      .catch(err => console.error('[Queue] Failed to set fallback title:', err));
  }
}

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as {
      sessionId: string;
      userMessage: string;
      organizationId: string;
    };

    const { sessionId, userMessage, organizationId } = body;

    if (!sessionId || !userMessage || !organizationId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 异步执行标题生成，不等待完成
    generateSessionTitle(sessionId, userMessage, organizationId).catch(err => {
      console.error('[Queue] Error in title generation:', err);
    });

    // 立即返回，不等待标题生成完成
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/queue/chat-title:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
