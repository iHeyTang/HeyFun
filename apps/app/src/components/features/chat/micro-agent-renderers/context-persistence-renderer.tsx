/**
 * 上下文持久化微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { Database, CheckCircle2 } from 'lucide-react';

interface ContextPersistenceResult {
  snapshotId?: string;
  snapshotVersion?: number;
  persisted?: boolean;
  originalMessageCount?: number;
  compressedMessageCount?: number;
  tokensSaved?: number;
}

interface ContextPersistenceRendererProps {
  data: ContextPersistenceResult;
}

export const ContextPersistenceRenderer = memo(function ContextPersistenceRenderer({
  data,
}: ContextPersistenceRendererProps) {
  const persisted = data.persisted ?? false;
  const snapshotId = data.snapshotId;
  const snapshotVersion = data.snapshotVersion ?? 1;
  const originalCount = data.originalMessageCount ?? 0;
  const compressedCount = data.compressedMessageCount ?? 0;
  const tokensSaved = data.tokensSaved ?? 0;

  if (!persisted) {
    return (
      <div className="text-[10px] text-gray-500">未进行持久化</div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Database className="h-3 w-3 text-indigo-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-gray-700 flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
            已持久化
          </div>
          {snapshotId && (
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
              v{snapshotVersion} · {snapshotId.substring(0, 8)}...
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-gray-500">消息数</div>
          <div className="text-[10px] font-medium text-gray-700">
            {originalCount} → {compressedCount}
          </div>
        </div>
        {tokensSaved > 0 && (
          <div>
            <div className="text-[10px] text-gray-500">Token 节省</div>
            <div className="text-[10px] font-medium text-green-600">
              {tokensSaved.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

