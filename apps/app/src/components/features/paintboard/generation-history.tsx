'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GenerationHistoryProps {
  className?: string;
}

export function GenerationHistory({ className }: GenerationHistoryProps) {
  return (
    <div className="text-muted-foreground flex h-64 items-center justify-center">
      <div className="space-y-2 text-center">
        <div className="text-2xl">📝</div>
        <p>暂无生成记录</p>
        <p className="text-sm">生成任务完成后会显示在这里</p>
      </div>
    </div>
  );
}
