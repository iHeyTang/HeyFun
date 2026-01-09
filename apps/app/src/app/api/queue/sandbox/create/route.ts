import { NextResponse } from 'next/server';
import { getSandboxHandleFromState, saveSandboxHandleToState } from '@/agents/tools/sandbox/utils';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';

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

    // 检查是否已有 sandbox
    const existingHandle = await getSandboxHandleFromState(sessionId);
    if (existingHandle && existingHandle.status !== 'expired') {
      // 已存在，无需创建
      console.log(`[SandboxUtils] Sandbox already exists for session ${sessionId}`);
      return;
    }

    // 创建新的 sandbox（不等待完成）
    const startTime = Date.now();
    console.log(`[SandboxUtils] Starting sandbox creation for session ${sessionId}`);

    const srm = getSandboxRuntimeManager();
    const handle = await srm.create({ ports: [], idleTimeout: 300 }, true);

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[SandboxUtils] Sandbox creation completed for session ${sessionId}, duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);

    // 保存到 state
    await saveSandboxHandleToState(sessionId, handle);
    console.log(`[SandboxUtils] Initiated sandbox creation for session ${sessionId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/queue/sandbox/create:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
