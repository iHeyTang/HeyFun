/**
 * 默认微代理渲染组件（用于未匹配的微代理）
 */

'use client';

import { memo } from 'react';

interface DefaultMicroAgentRendererProps {
  data: any;
}

export const DefaultMicroAgentRenderer = memo(function DefaultMicroAgentRenderer({ data }: DefaultMicroAgentRendererProps) {
  // 如果是简单值，直接显示
  if (typeof data !== 'object' || data === null) {
    return <div className="text-[10px] text-gray-600">{String(data)}</div>;
  }

  // 如果是对象，显示关键字段
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return <div className="text-[10px] text-gray-500">无数据</div>;
  }

  return (
    <div className="space-y-1">
      {keys.slice(0, 5).map(key => {
        const value = data[key];
        if (value === null || value === undefined) return null;

        return (
          <div key={key} className="text-[10px]">
            <span className="font-medium text-gray-700">{key}:</span>{' '}
            <span className="text-gray-600">{typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : String(value)}</span>
          </div>
        );
      })}
      {keys.length > 5 && <div className="text-[10px] text-gray-400">+{keys.length - 5} 更多字段</div>}
    </div>
  );
});
