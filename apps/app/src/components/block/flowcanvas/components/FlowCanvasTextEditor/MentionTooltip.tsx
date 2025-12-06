import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MentionItem } from './MentionList';
import { ResourcePreview } from './ResourcePreview';

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  item: MentionItem | null;
}

interface MentionTooltipProps {
  tooltip: TooltipState;
}

export const MentionTooltip: React.FC<MentionTooltipProps> = ({ tooltip }) => {
  const [mounted, setMounted] = useState(false);

  // 确保 DOM 节点先挂载，然后再触发动画
  useEffect(() => {
    if (tooltip.item && tooltip.visible) {
      // 延迟一帧让浏览器先完成 DOM 挂载
      requestAnimationFrame(() => {
        setMounted(true);
      });
    } else {
      // 使用 requestAnimationFrame 避免同步 setState
      requestAnimationFrame(() => {
        setMounted(false);
      });
    }
  }, [tooltip.item, tooltip.visible]);

  if (!tooltip.item || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] transition-opacity duration-150"
      style={{
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
        transform: 'translate(-50%, calc(-100% - 8px))',
        opacity: mounted && tooltip.visible ? 1 : 0,
      }}
    >
      <ResourcePreview item={tooltip.item} />
    </div>,
    document.body,
  );
};
