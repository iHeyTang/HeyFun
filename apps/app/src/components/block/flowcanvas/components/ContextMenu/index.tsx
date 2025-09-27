import React, { useState, useRef, useEffect } from 'react';
import { Panel } from '@xyflow/react';

// 节点类型定义
interface NodeType {
  type: string;
  label: string;
  description: string;
  defaultData?: Record<string, any>;
}

// 可用的节点类型
const AVAILABLE_NODE_TYPES: NodeType[] = [
  {
    type: 'text',
    label: 'Text Node',
    description: '用于显示和处理文本内容',
    defaultData: {
      label: 'Text Node',
      description: '双击编辑文本内容',
      text: '点击编辑文本',
    },
  },
  {
    type: 'image',
    label: 'Image Node',
    description: '用于上传和显示图片',
    defaultData: {
      label: 'Image Node',
      description: '点击上传图片',
      width: 200,
      height: 150,
    },
  },
  {
    type: 'video',
    label: 'Video Node',
    description: '用于上传和播放视频',
    defaultData: {
      label: 'Video Node',
      description: '点击上传视频',
      controls: true,
      autoPlay: false,
    },
  },
];

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number }; // 现在是画布坐标
  onClose: () => void;
  onAddNode: (nodeType: NodeType, canvasPosition: { x: number; y: number }) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, onClose, onAddNode, canvasRef }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  // 过滤节点类型
  const filteredNodeTypes = AVAILABLE_NODE_TYPES.filter(
    nodeType =>
      nodeType.label.toLowerCase().includes(searchTerm.toLowerCase()) || nodeType.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 动态调整菜单位置
  useEffect(() => {
    if (!isOpen || !canvasRef.current) {
      setAdjustedPosition(position);
      return;
    }

    // 调试信息
    console.log('ContextMenu位置调整:', {
      position,
      canvasBounds: canvasRef.current.getBoundingClientRect(),
      adjustedPosition,
    });

    // 使用 requestAnimationFrame 确保菜单已经渲染
    const adjustPosition = () => {
      if (!canvasRef.current) {
        return;
      }
      if (!menuRef.current) {
        // 如果菜单还没渲染，使用预估尺寸
        const estimatedWidth = 288; // w-72 = 18rem = 288px
        const estimatedHeight = 400; // 预估高度

        let adjustedX = position.x;
        let adjustedY = position.y;

        // 水平位置调整
        if (position.x + estimatedWidth > canvasRef.current.getBoundingClientRect().width) {
          adjustedX = Math.max(10, canvasRef.current.getBoundingClientRect().width - estimatedWidth - 50);
        }

        // 垂直位置调整
        if (position.y + estimatedHeight > canvasRef.current.getBoundingClientRect().height) {
          adjustedY = Math.max(50, canvasRef.current.getBoundingClientRect().height - estimatedHeight - 50);
        }

        setAdjustedPosition({ x: adjustedX, y: adjustedY });
        return;
      }

      const menuElement = menuRef.current;
      const menuRect = menuElement.getBoundingClientRect();

      // 使用实际渲染尺寸
      const menuWidth = menuRect.width;
      const menuHeight = menuRect.height;

      let adjustedX = position.x;
      let adjustedY = position.y;

      // 水平位置调整
      if (position.x + menuWidth > canvasRef.current.getBoundingClientRect().width) {
        // 如果右侧超出边界，向左调整
        adjustedX = Math.max(10, canvasRef.current.getBoundingClientRect().width - menuWidth - 50);
      }

      // 垂直位置调整
      if (position.y + menuHeight > canvasRef.current.getBoundingClientRect().height) {
        // 如果下方超出边界，向上调整
        adjustedY = Math.max(50, canvasRef.current.getBoundingClientRect().height - menuHeight - 50);
      }

      setAdjustedPosition({ x: adjustedX, y: adjustedY });
    };

    // 延迟执行以确保菜单已渲染
    const timeoutId = setTimeout(adjustPosition, 0);
    return () => clearTimeout(timeoutId);
  }, [isOpen, position, canvasRef]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleNodeSelect = (nodeType: NodeType) => {
    onAddNode(nodeType, position);
    onClose();
  };

  return (
    <Panel
      position="top-left"
      className="bg-theme-popover/95 shadow-theme-luxury border-theme-border-secondary w-72 rounded-xl border p-3 backdrop-blur-sm"
      style={{
        position: 'absolute',
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        zIndex: 1000,
      }}
    >
      <div ref={menuRef} className="node-menu">
        {/* 搜索框 */}
        <div className="mb-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-theme-input focus:ring-theme-ring focus:bg-theme-input placeholder:text-theme-muted-foreground text-theme-foreground w-full rounded-lg border-0 px-3 py-2.5 text-sm transition-all duration-200 focus:ring-2 focus:outline-none"
              autoFocus
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-theme-muted-foreground"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* 节点列表 */}
        <div className="scrollbar-thin scrollbar-thumb-theme-border-secondary scrollbar-track-transparent max-h-64 space-y-1 overflow-y-auto">
          {filteredNodeTypes.length > 0 ? (
            filteredNodeTypes.map((nodeType, index) => (
              <button
                key={nodeType.type}
                onClick={() => handleNodeSelect(nodeType)}
                className="group hover:bg-theme-accent flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-all duration-150"
              >
                {/* 节点信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-theme-foreground text-sm font-medium transition-colors">{nodeType.label}</div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="text-theme-muted-foreground py-8 text-center">
              <div className="mb-2 text-xl">🔍</div>
              <p className="text-sm">No matching nodes found</p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};
