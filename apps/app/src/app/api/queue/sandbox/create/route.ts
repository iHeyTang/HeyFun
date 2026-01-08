import { NextResponse } from 'next/server';
import { createSandbox } from '@/agents/tools/sandbox/utils';

// 注册此 route 的 body 类型到 QueueRoutes interface
declare module '@/lib/server/queue' {
  interface QueueRoutes {
    '/api/queue/sandbox/create': {
      sessionId: string;
    };
  }
}

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as { sessionId: string };

    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    // 仅发起创建请求，不等待完成
    await createSandbox(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/queue/sandbox/create:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
