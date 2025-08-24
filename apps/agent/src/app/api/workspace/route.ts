import { NextResponse } from 'next/server';
import path from 'path';

/**
 * 获取工作空间信息
 */
export function GET() {
  const workspacePath = process.env.HEYFUN_AGENT_WORKSPACE || path.join(process.cwd(), 'workspace');
  return new NextResponse(JSON.stringify({ workspacePath }), { status: 200 });
}
