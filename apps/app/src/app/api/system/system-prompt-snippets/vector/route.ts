/**
 * 向量索引管理 API
 * 用于同步提示词片段到 Upstash Vector 索引
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySystemApiKey } from '@/lib/server/model-definitions';
import {
  upsertSnippetToVector,
  deleteSnippetFromVector,
  syncAllSnippetsToVector,
} from '@/lib/server/vector-prompt-snippets';
import { vectorManager } from '@/lib/server/vector';

/**
 * POST /api/system/system-prompt-snippets/vector/sync
 * 同步单个片段到向量索引
 * 请求体: { snippetId: string }
 */
export async function POST(request: NextRequest) {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { snippetId, action, providerName } = body;

    if (!snippetId) {
      return NextResponse.json({ error: 'Missing required field: snippetId' }, { status: 400 });
    }

    if (action === 'delete') {
      await deleteSnippetFromVector(snippetId, providerName);
      return NextResponse.json({ success: true, message: `Snippet ${snippetId} deleted from vector index${providerName ? ` (${providerName})` : ''}` });
    } else {
      await upsertSnippetToVector(snippetId, providerName);
      return NextResponse.json({ success: true, message: `Snippet ${snippetId} synced to vector index${providerName ? ` (${providerName})` : ''}` });
    }
  } catch (error: any) {
    console.error('Failed to sync snippet to vector index:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync snippet to vector index' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/system/system-prompt-snippets/vector/sync-all
 * 批量同步所有启用的片段到向量索引
 */
export async function PUT(request: NextRequest) {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { providerName } = body;
    const result = await syncAllSnippetsToVector(providerName);
    return NextResponse.json({
      success: true,
      message: `Synced ${result.success} snippets, ${result.failed} failed`,
      synced: result.success,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('Failed to sync all snippets to vector index:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync all snippets to vector index' },
      { status: 500 },
    );
  }
}

