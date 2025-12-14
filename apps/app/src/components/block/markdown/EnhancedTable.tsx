import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import './EnhancedTable.css';

interface EnhancedTableProps {
  children: React.ReactNode;
}

const EnhancedTableComponent = ({ children }: EnhancedTableProps) => {
  const [isFullWidth, setIsFullWidth] = useState(false); // 默认全宽模式
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // 切换模式时重置列宽
  const toggleWidth = () => {
    setIsFullWidth(!isFullWidth);
    setColumnWidths({}); // 清空自定义列宽
  };

  const handleMouseDown = useCallback(
    (index: number, e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const table = tableRef.current || containerRef.current?.querySelector('table');
      if (!table) return;

      const headers = table.querySelectorAll('thead th');
      const th = headers[index] as HTMLElement;
      if (!th) return;

      setResizingColumn(index);
      startXRef.current = e.clientX;
      startWidthRef.current = th.offsetWidth;

      // 在滚动模式下，开始调整时记录所有列的当前宽度
      if (!isFullWidth) {
        const currentWidths: Record<number, number> = { ...columnWidths };
        headers.forEach((header, i) => {
          if (!currentWidths[i]) {
            currentWidths[i] = (header as HTMLElement).offsetWidth;
          }
        });
        setColumnWidths(currentWidths);
      }
    },
    [isFullWidth, columnWidths],
  );

  useEffect(() => {
    if (resizingColumn === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn === null) return;

      const table = tableRef.current || containerRef.current?.querySelector('table');
      if (!table) return;

      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(80, startWidthRef.current + diff);

      if (isFullWidth) {
        // 全宽模式：联动调整相邻列宽度以保持总宽度不变
        const headers = table.querySelectorAll('thead th');
        const nextColumnIndex = resizingColumn + 1;

        if (nextColumnIndex < headers.length) {
          const nextTh = headers[nextColumnIndex] as HTMLElement;
          const currentWidth = columnWidths[resizingColumn] || startWidthRef.current;
          const nextWidth = columnWidths[nextColumnIndex] || nextTh.offsetWidth;

          const totalWidth = currentWidth + nextWidth;
          const widthChange = newWidth - currentWidth;
          const newNextWidth = Math.max(80, nextWidth - widthChange);

          // 检查是否可以调整（保证两列都不小于最小宽度）
          if (newWidth >= 80 && newNextWidth >= 80 && Math.abs(newWidth + newNextWidth - totalWidth) < 5) {
            setColumnWidths(prev => ({
              ...prev,
              [resizingColumn]: newWidth,
              [nextColumnIndex]: newNextWidth,
            }));
          }
        }
      } else {
        // 实际宽度模式：只调整当前列，不影响其他列
        setColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth,
        }));
      }
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, isFullWidth, columnWidths]);

  // 应用列宽和表格宽度
  useEffect(() => {
    const table = tableRef.current || containerRef.current?.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead th');
    const rows = table.querySelectorAll('tbody tr');

    if (isFullWidth) {
      // 全宽自适应模式：表格占满容器，使用固定表格布局
      table.style.setProperty('width', '100%');
      table.style.setProperty('table-layout', 'fixed');

      // 如果有自定义列宽，应用它
      if (Object.keys(columnWidths).length > 0) {
        headers.forEach((header, index) => {
          const th = header as HTMLElement;
          if (columnWidths[index]) {
            th.style.width = `${columnWidths[index]}px`;
          } else {
            th.style.width = '';
          }
        });

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          cells.forEach((cell, index) => {
            const td = cell as HTMLElement;
            if (columnWidths[index]) {
              td.style.width = `${columnWidths[index]}px`;
            } else {
              td.style.width = '';
            }
          });
        });
      } else {
        // 没有自定义列宽时，清除样式让其自动平均分配
        headers.forEach(header => {
          const th = header as HTMLElement;
          th.style.width = '';
        });
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          cells.forEach(cell => {
            const td = cell as HTMLElement;
            td.style.width = '';
          });
        });
      }
    } else {
      // 实际宽度模式：表格根据内容自适应
      const hasCustomWidths = Object.keys(columnWidths).length > 0;

      if (hasCustomWidths) {
        // 有自定义列宽时，使用固定布局并计算总宽度
        table.style.setProperty('table-layout', 'fixed');
        const totalWidth = Object.values(columnWidths).reduce((sum, w) => sum + w, 0);
        table.style.setProperty('width', `${totalWidth}px`);

        headers.forEach((header, index) => {
          const th = header as HTMLElement;
          if (columnWidths[index]) {
            th.style.width = `${columnWidths[index]}px`;
          }
        });

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          cells.forEach((cell, index) => {
            const td = cell as HTMLElement;
            if (columnWidths[index]) {
              td.style.width = `${columnWidths[index]}px`;
            }
          });
        });
      } else {
        // 没有自定义列宽时，使用自动布局
        table.style.setProperty('table-layout', 'auto');
        table.style.setProperty('width', 'max-content');

        headers.forEach(header => {
          const th = header as HTMLElement;
          th.style.width = '';
        });

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          cells.forEach(cell => {
            const td = cell as HTMLElement;
            td.style.width = '';
          });
        });
      }
    }
  }, [columnWidths, isFullWidth]);

  // 设置表头样式和事件监听
  useEffect(() => {
    const table = tableRef.current || containerRef.current?.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead th');

    const mouseDownHandlers: Array<(e: MouseEvent) => void> = [];

    headers.forEach((header, index) => {
      const th = header as HTMLElement;

      // 添加调整手柄
      // 全宽模式：除最后一列外都添加（因为联动调整）
      // 实际宽度模式：所有列都添加
      const shouldAddHandle = isFullWidth ? index < headers.length - 1 : true;

      if (shouldAddHandle) {
        th.classList.add('resizable-column');

        const handler = (e: MouseEvent) => {
          // 检查是否点击在右侧边界附近（8px范围内）
          const rect = th.getBoundingClientRect();
          if (e.clientX >= rect.right - 8) {
            handleMouseDown(index, e as any);
          }
        };

        mouseDownHandlers.push(handler);
        th.addEventListener('mousedown', handler);
      } else {
        th.classList.remove('resizable-column');
      }
    });

    return () => {
      headers.forEach((header, index) => {
        const th = header as HTMLElement;
        th.classList.remove('resizable-column');
        if (mouseDownHandlers[index]) {
          th.removeEventListener('mousedown', mouseDownHandlers[index]);
        }
      });
    };
  }, [children, handleMouseDown, isFullWidth]);

  return (
    <div ref={wrapperRef} className="group" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {/* 表格控制栏 - 在表格外，悬停时显示 */}
      <div className="mb-0.5 flex h-6 items-center justify-start gap-1 px-1">
        <div
          className={`flex items-center gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: isHovered ? 'auto' : 'none' }}
        >
          {/* 全宽自适应 / 实际宽度 切换 */}
          <button
            onClick={toggleWidth}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors"
            title={isFullWidth ? '切换为实际宽度（可横向滚动）' : '切换为全宽自适应'}
          >
            {isFullWidth ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            <span>{isFullWidth ? '全宽' : '滚动'}</span>
          </button>

          {/* 预留更多扩展按钮位置 */}
          {/* 可以在这里添加更多操作按钮，如：导出、复制、排序等 */}
        </div>
      </div>

      {/* 表格容器 */}
      {isFullWidth ? (
        <div
          ref={containerRef}
          className="border-border bg-background enhanced-table-container rounded-lg border"
          style={{
            width: '100%',
            overflow: 'hidden',
            userSelect: resizingColumn !== null ? 'none' : 'auto',
            cursor: resizingColumn !== null ? 'col-resize' : 'auto',
          }}
        >
          {children}
        </div>
      ) : (
        <div
          className="max-w-full pb-3"
          style={{
            overflow: 'auto',
          }}
        >
          <div
            ref={containerRef}
            className="border-border bg-background enhanced-table-container rounded-lg border"
            style={{
              width: 'fit-content',
              userSelect: resizingColumn !== null ? 'none' : 'auto',
              cursor: resizingColumn !== null ? 'col-resize' : 'auto',
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

// 使用memo包裹组件，避免不必要的重新渲染
export const EnhancedTable = memo(EnhancedTableComponent);
