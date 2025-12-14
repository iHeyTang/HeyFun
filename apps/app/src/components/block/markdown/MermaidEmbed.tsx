import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, X } from 'lucide-react';

interface MermaidEmbedProps {
  chart: string;
}

// 初始化 mermaid（只执行一次）
let mermaidInitialized = false;

const MAX_HEIGHT = 500;

export function MermaidEmbed({ chart }: MermaidEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPreview, setIsPreview] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [previewDragStart, setPreviewDragStart] = useState({ x: 0, y: 0 });
  const [initialScaleCalculated, setInitialScaleCalculated] = useState(false);
  const [initialScale, setInitialScale] = useState(1);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          // 字体配置
          fontFamily: 'inherit',
          fontSize: '13px',

          // 主色调 - 柔和蓝色
          primaryColor: '#eff6ff',
          primaryTextColor: '#1e293b',
          primaryBorderColor: '#60a5fa',

          // 次要色调 - 优雅紫色
          secondaryColor: '#f5f3ff',
          secondaryTextColor: '#1e293b',
          secondaryBorderColor: '#a78bfa',

          // 第三色调 - 清新绿色
          tertiaryColor: '#f0fdf4',
          tertiaryTextColor: '#1e293b',
          tertiaryBorderColor: '#4ade80',

          // 线条颜色 - 柔和蓝
          lineColor: '#7cb5f9',

          // 文字颜色
          textColor: '#1e293b',
          mainBkg: '#ffffff',

          // 节点边框
          nodeBorder: '#93c5fd',
          clusterBkg: '#fafbfc',
          clusterBorder: '#e2e8f0',

          // 默认链接样式
          defaultLinkColor: '#7cb5f9',

          // 标题
          titleColor: '#0f172a',

          // 边缘标签背景
          edgeLabelBackground: '#ffffff',

          // Actor 颜色（序列图）
          actorBorder: '#60a5fa',
          actorBkg: '#eff6ff',
          actorTextColor: '#1e293b',
          actorLineColor: '#93c5fd',

          // 信号颜色
          signalColor: '#475569',
          signalTextColor: '#1e293b',

          // 注释
          noteBorderColor: '#fbbf24',
          noteBkgColor: '#fef3c7',
          noteTextColor: '#78350f',

          // 激活
          activationBorderColor: '#60a5fa',
          activationBkgColor: '#dbeafe',

          // 序列号
          sequenceNumberColor: '#ffffff',

          // 类图
          classText: '#1e293b',

          // 状态图
          labelColor: '#1e293b',

          // ER 图
          attributeBackgroundColorOdd: '#f8fafc',
          attributeBackgroundColorEven: '#ffffff',

          // 错误/关键
          errorBkgColor: '#fee2e2',
          errorTextColor: '#991b1b',

          // Git 图颜色
          git0: '#60a5fa',
          git1: '#a78bfa',
          git2: '#4ade80',
          git3: '#fb923c',
          git4: '#f472b6',
          git5: '#facc15',
          git6: '#2dd4bf',
          git7: '#94a3b8',

          // 饼图颜色
          pie1: '#60a5fa',
          pie2: '#a78bfa',
          pie3: '#4ade80',
          pie4: '#fb923c',
          pie5: '#f472b6',
          pie6: '#facc15',
          pie7: '#2dd4bf',
          pie8: '#f87171',
          pie9: '#94a3b8',
          pie10: '#38bdf8',
          pie11: '#c084fc',
          pie12: '#86efac',
        },
        securityLevel: 'loose',
        fontFamily: 'inherit',

        // 流程图配置
        flowchart: {
          curve: 'basis',
          padding: 28,
          nodeSpacing: 70,
          rankSpacing: 90,
          diagramPadding: 20,
          htmlLabels: true,
          useMaxWidth: true,
        },

        // 序列图配置
        sequence: {
          diagramMarginX: 28,
          diagramMarginY: 28,
          actorMargin: 65,
          boxMargin: 14,
          boxTextMargin: 10,
          noteMargin: 14,
          messageMargin: 45,
          mirrorActors: false,
          useMaxWidth: true,
        },

        // 甘特图配置
        gantt: {
          titleTopMargin: 28,
          barHeight: 28,
          barGap: 10,
          topPadding: 65,
          leftPadding: 130,
          gridLineStartPadding: 45,
          fontSize: 12,
          sectionFontSize: 13,
          numberSectionStyles: 3,
          useMaxWidth: true,
        },

        // 类图配置
        class: {
          useMaxWidth: true,
        },

        // 状态图配置
        state: {
          dividerMargin: 14,
          sizeUnit: 8,
          padding: 16,
          textHeight: 14,
          titleShift: -18,
          noteMargin: 14,
          forkWidth: 85,
          forkHeight: 14,
          miniPadding: 6,
          fontSizeFactor: 1,
          fontSize: 13,
          labelHeight: 20,
          edgeLengthFactor: '22',
          compositTitleSize: 42,
          radius: 10,
          useMaxWidth: true,
        },

        // ER 图配置
        er: {
          diagramPadding: 28,
          layoutDirection: 'TB',
          minEntityWidth: 130,
          minEntityHeight: 85,
          entityPadding: 18,
          stroke: '#93c5fd',
          fill: '#f8fafc',
          fontSize: 13,
          useMaxWidth: true,
        },

        // 饼图配置
        pie: {
          useMaxWidth: true,
        },

        // 旅程图配置
        journey: {
          diagramMarginX: 60,
          diagramMarginY: 60,
          width: 180,
          height: 60,
          boxMargin: 12,
          boxTextMargin: 8,
          useMaxWidth: true,
        },

        // Git 图配置
        gitGraph: {
          diagramPadding: 12,
          nodeLabel: {
            width: 80,
            height: 120,
            x: -25,
            y: 0,
          },
          mainBranchName: 'main',
          mainBranchOrder: 0,
          showCommitLabel: true,
          showBranches: true,
          rotateCommitLabel: true,
        },
      });
      mermaidInitialized = true;
    }
  }, []);

  useEffect(() => {
    const renderChart = async () => {
      if (!chart || !containerRef.current) return;

      try {
        setError(null);
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);

        // 注入自定义样式到 SVG
        const styledSvg = renderedSvg.replace(
          '<svg',
          `<style>
            /* ========== 全局样式 ========== */
            svg {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            }
            
            /* ========== 节点样式 ========== */
            .node rect, .node circle, .node ellipse, .node polygon, .node path {
              filter: drop-shadow(0 1px 3px rgba(96, 165, 250, 0.15)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.06));
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
              stroke-width: 1.5px;
            }
            
            .node:hover rect, .node:hover circle, .node:hover ellipse, .node:hover polygon {
              filter: drop-shadow(0 4px 8px rgba(96, 165, 250, 0.2)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
              transform: translateY(-1px);
            }
            
            /* 节点圆角优化 */
            .node rect {
              rx: 10px;
              ry: 10px;
            }
            
            /* 节点内边距优化 */
            .nodeLabel {
              padding: 12px 20px;
            }
            
            /* ========== 连接线样式 ========== */
            .edgePath path {
              stroke-width: 2px;
              filter: drop-shadow(0 1px 2px rgba(124, 181, 249, 0.15));
              transition: all 0.2s ease;
            }
            
            .edgePath:hover path {
              stroke-width: 2.5px;
              filter: drop-shadow(0 2px 4px rgba(124, 181, 249, 0.25));
            }
            
            /* ========== 边缘标签样式 ========== */
            .edgeLabel {
              background: rgba(255, 255, 255, 0.95) !important;
              backdrop-filter: blur(12px) saturate(180%);
              padding: 6px 12px !important;
              border-radius: 8px !important;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04) !important;
              border: 1px solid rgba(226, 232, 240, 0.8) !important;
            }
            
            .edgeLabel rect {
              fill: rgba(255, 255, 255, 0.95) !important;
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.06));
            }
            
            .edgeLabel span {
              padding: 4px 8px;
            } 
            
            /* ========== 文字排版优化 ========== */
            text {
              letter-spacing: 0.015em;
              font-weight: 400;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            .labelText, .nodeLabel {
              fill: #1e293b !important;
              font-size: 13px;
            }
            
            .titleText {
              font-weight: 500;
              letter-spacing: 0.01em;
              fill: #0f172a !important;
            }
            
            /* ========== Cluster/分组样式 ========== */
            .cluster rect {
              rx: 12px;
              ry: 12px;
              fill: #f8fafc;
              stroke: #e2e8f0;
              stroke-width: 1.5px;
              filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.04));
            }
            
            .cluster text, .cluster .nodeLabel {
              font-weight: 500;
              fill: #475569 !important;
              font-size: 13px;
            }
            
            /* ========== 箭头标记 ========== */
            marker {
              fill: #7cb5f9;
            }
            
            marker path {
              filter: drop-shadow(0 1px 1px rgba(124, 181, 249, 0.2));
            }
            
            /* ========== 序列图样式 ========== */
            .actor {
              filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.12));
            }
            
            .actor rect {
              rx: 10px;
              ry: 10px;
            }
            
            .activation0, .activation1, .activation2 {
              filter: drop-shadow(0 2px 4px rgba(96, 165, 250, 0.1));
              rx: 4px;
              ry: 4px;
            }
            
            .messageLine0, .messageLine1 {
              stroke-width: 2px;
            }
            
            /* 注释样式 */
            .note {
              filter: drop-shadow(0 2px 6px rgba(251, 191, 36, 0.15));
            }
            
            .note rect {
              rx: 10px;
              ry: 10px;
            }
            
            .noteText {
              fill: #78350f !important;
            }
            
            /* ========== 流程图特殊形状 ========== */
            .flowchart-link {
              stroke-width: 2px;
              filter: drop-shadow(0 1px 2px rgba(124, 181, 249, 0.15));
            }
            
            /* 决策节点（菱形）*/
            .node polygon {
              filter: drop-shadow(0 2px 6px rgba(167, 139, 250, 0.15));
            }
            
            /* ========== 状态图样式 ========== */
            .statediagram-state rect {
              rx: 10px;
              ry: 10px;
              filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.12));
            }
            
            .statediagram-state circle {
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
            }
            
            .statediagram-state .divider {
              stroke: #e2e8f0;
              stroke-width: 1.5px;
            }
            
            /* ========== ER图样式 ========== */
            .er.entityBox {
              filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.1));
            }
            
            .er.entityBox rect {
              rx: 10px;
              ry: 10px;
            }
            
            .er .relationshipLine {
              stroke-width: 2px;
            }
            
            /* ========== 甘特图样式 ========== */
            .task {
              rx: 8px;
              ry: 8px;
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.06));
            }
            
            .taskText {
              fill: #1e293b !important;
              font-size: 12px;
            }
            
            .taskTextOutside {
              fill: #475569 !important;
            }
            
            /* 今天标记线 */
            .today {
              stroke: #f59e0b;
              stroke-width: 2px;
            }
            
            /* ========== Git图样式 ========== */
            .commit-id, .commit-msg, .branch-label {
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
            }
            
            .commit-id {
              rx: 6px;
              ry: 6px;
            }
            
            /* ========== 类图样式 ========== */
            .classGroup rect {
              rx: 10px;
              ry: 10px;
              filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.12));
            }
            
            .classGroup line {
              stroke: #e2e8f0;
              stroke-width: 1.5px;
            }
            
            .classLabel .box {
              rx: 6px;
              ry: 6px;
            }
            
            /* ========== 饼图样式 ========== */
            .pieCircle {
              filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08));
            }
            
            .pieTitleText {
              font-size: 14px;
              font-weight: 500;
            }
            
            /* ========== 旅程图样式 ========== */
            .journey-section rect {
              rx: 8px;
              ry: 8px;
            }
            
            /* ========== 通用优化 ========== */
            .label {
              background: rgba(255, 255, 255, 0.95);
            }
            
            /* 网格线 */
            .grid line {
              stroke: #f1f5f9;
              stroke-width: 1px;
            }
            
            /* 标题 */
            #mermaid-title {
              font-size: 14px;
              font-weight: 500;
              fill: #0f172a !important;
            }
          </style><svg`,
        );

        setSvg(styledSvg);
        setInitialScaleCalculated(false); // 重置标志，以便重新计算
        setPosition({ x: 0, y: 0 }); // 重置位置，确保新图表从中心开始
      } catch (err) {
        console.error('Mermaid 渲染失败:', err);
        setError(err instanceof Error ? err.message : '渲染失败');
      }
    };

    renderChart();
  }, [chart]);

  // 计算自适应缩放
  useEffect(() => {
    if (!svg || !contentRef.current || !containerRef.current || initialScaleCalculated) {
      return;
    }

    const svgElement = contentRef.current.querySelector('svg');
    if (!svgElement) return;

    // 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = MAX_HEIGHT; // 对应 maxHeight

      // 获取 SVG 的实际尺寸
      const svgRect = svgElement.getBoundingClientRect();
      const svgWidth = svgRect.width || svgElement.viewBox?.baseVal?.width || svgElement.width?.baseVal?.value || 800;
      const svgHeight = svgRect.height || svgElement.viewBox?.baseVal?.height || svgElement.height?.baseVal?.value || 600;

      // 计算缩放比例，留出一些边距（padding 是 24px，即 p-6）
      const padding = 48; // 左右各 24px
      const availableWidth = containerWidth - padding;
      const availableHeight = containerHeight - padding;

      const scaleX = availableWidth / svgWidth;
      const scaleY = availableHeight / svgHeight;

      // 选择较小的缩放比例，确保完全适应容器，但不超过 1
      const autoScale = Math.min(scaleX, scaleY, 1);

      setInitialScale(autoScale);
      setScale(autoScale);
      setPosition({ x: 0, y: 0 }); // 重置位置确保内容居中
      setInitialScaleCalculated(true);
    });
  }, [svg, initialScaleCalculated]);

  // 缩放控制
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.1));
  };

  const handleResetZoom = () => {
    setScale(initialScale);
    setPosition({ x: 0, y: 0 });
  };

  // 鼠标滚轮缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // 支持直接滚轮缩放
      e.preventDefault();
      const delta = -e.deltaY * 0.005; // 降低灵敏度
      setScale(prev => {
        const newScale = Math.min(Math.max(prev + delta, 0.1), 5);
        return newScale;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // 拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止文本选择
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // 预览控制
  const handleOpenPreview = () => {
    setIsPreview(true);
    setPreviewPosition({ x: 0, y: 0 });

    // 计算预览模式的自适应缩放
    requestAnimationFrame(() => {
      const svgElement = contentRef.current?.querySelector('svg');
      if (svgElement) {
        // 获取 SVG 原始尺寸（未经主视图缩放影响）
        const svgRect = svgElement.getBoundingClientRect();
        const currentScale = scale;
        const svgWidth = svgRect.width / currentScale;
        const svgHeight = svgRect.height / currentScale;

        // 预览窗口是 80vw x 80vh
        const previewWidth = window.innerWidth * 0.8;
        const previewHeight = window.innerHeight * 0.8;

        // 留出一些边距
        const padding = 80;
        const availableWidth = previewWidth - padding;
        const availableHeight = previewHeight - padding;

        const scaleX = availableWidth / svgWidth;
        const scaleY = availableHeight / svgHeight;

        // 选择较小的缩放比例，确保完全适应，但不超过 2
        const autoScale = Math.min(scaleX, scaleY, 2);
        setPreviewScale(autoScale);
      } else {
        setPreviewScale(1);
      }

      setIsPreviewVisible(true);
    });
  };

  const handleClosePreview = useCallback(() => {
    setIsPreviewVisible(false);
    setTimeout(() => {
      setIsPreview(false);
    }, 200);
  }, []);

  // 监听 ESC 键关闭预览
  useEffect(() => {
    if (!isPreview) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClosePreview();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPreview, handleClosePreview]);

  // 预览模式缩放
  const handlePreviewZoomIn = () => setPreviewScale(prev => Math.min(prev + 0.25, 5));
  const handlePreviewZoomOut = () => setPreviewScale(prev => Math.max(prev - 0.25, 0.1));
  const handlePreviewResetZoom = () => {
    // 重置到初始自适应缩放
    const svgElement = contentRef.current?.querySelector('svg');
    if (svgElement) {
      const svgRect = svgElement.getBoundingClientRect();
      const currentScale = scale;
      const svgWidth = svgRect.width / currentScale;
      const svgHeight = svgRect.height / currentScale;

      const previewWidth = window.innerWidth * 0.8;
      const previewHeight = window.innerHeight * 0.8;
      const padding = 80;
      const availableWidth = previewWidth - padding;
      const availableHeight = previewHeight - padding;

      const scaleX = availableWidth / svgWidth;
      const scaleY = availableHeight / svgHeight;
      const autoScale = Math.min(scaleX, scaleY, 2);

      setPreviewScale(autoScale);
    } else {
      setPreviewScale(1);
    }
    setPreviewPosition({ x: 0, y: 0 });
  };

  // 预览模式鼠标拖动
  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止文本选择
    setIsPreviewDragging(true);
    setPreviewDragStart({
      x: e.clientX - previewPosition.x,
      y: e.clientY - previewPosition.y,
    });
  };

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (isPreviewDragging) {
      setPreviewPosition({
        x: e.clientX - previewDragStart.x,
        y: e.clientY - previewDragStart.y,
      });
    }
  };

  const handlePreviewMouseUp = () => {
    setIsPreviewDragging(false);
  };

  // 预览模式滚轮缩放
  const handlePreviewWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.005; // 降低灵敏度
    setPreviewScale(prev => Math.min(Math.max(prev + delta, 0.1), 5));
  };

  if (error) {
    return (
      <div className="border-border bg-card my-4 rounded-lg border p-4">
        <p className="text-foreground text-sm font-medium">图表渲染失败</p>
        <p className="text-muted-foreground mt-1 text-xs">{error}</p>
        <pre className="bg-muted border-border mt-3 max-h-40 overflow-auto rounded border p-3 text-xs">
          <code className="text-muted-foreground">{chart}</code>
        </pre>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="border-border bg-card relative my-4 w-fit rounded-lg border"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* 工具栏 */}
        <div className={`absolute right-3 top-3 z-10 transition-opacity ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-background/95 border-border flex items-center gap-1 rounded-lg border p-1 shadow-sm backdrop-blur-sm">
            <button
              onClick={handleZoomIn}
              className="hover:bg-accent hover:text-accent-foreground rounded p-1.5 transition-colors"
              title="放大 (滚轮向上)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="hover:bg-accent hover:text-accent-foreground rounded p-1.5 transition-colors"
              title="缩小 (滚轮向下)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="hover:bg-accent hover:text-accent-foreground rounded p-1.5 transition-colors"
              title="重置缩放"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <div className="bg-border mx-1 h-4 w-px" />
            <button onClick={handleOpenPreview} className="hover:bg-accent hover:text-accent-foreground rounded p-1.5 transition-colors" title="预览">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 缩放比例指示器 */}
        {Math.abs(scale - initialScale) > 0.01 && (
          <div className="bg-background/95 border-border text-muted-foreground absolute left-3 top-3 z-10 rounded-md border px-2 py-1 text-xs shadow-sm backdrop-blur-sm">
            {Math.round(scale * 100)}%
          </div>
        )}

        {/* 图表容器 */}
        <div
          className="relative flex select-none items-center justify-center overflow-hidden p-6"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            maxHeight: `${MAX_HEIGHT}px`,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div
            ref={contentRef}
            className="transition-transform duration-200 ease-out [&_svg]:h-auto [&_svg]:max-w-full"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>

      {/* 预览模态框 */}
      {isPreview && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-200 ${
            isPreviewVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={handleClosePreview}
        >
          {/* 工具栏 */}
          <div
            className={`absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 transition-all duration-200 ${
              isPreviewVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
          >
            <button
              onClick={handleClosePreview}
              className="rounded-lg bg-black/50 p-2 text-white transition-colors hover:bg-white/10"
              title="关闭 (ESC)"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 rounded-lg bg-black/50 p-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  handlePreviewZoomOut();
                }}
                className="rounded p-2 text-white transition-colors hover:bg-white/10"
                title="缩小"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[60px] px-2 text-center text-sm text-white">{Math.round(previewScale * 100)}%</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handlePreviewZoomIn();
                }}
                className="rounded p-2 text-white transition-colors hover:bg-white/10"
                title="放大"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <div className="mx-1 h-4 w-px bg-white/20" />
              <button
                onClick={e => {
                  e.stopPropagation();
                  handlePreviewResetZoom();
                }}
                className="rounded p-2 text-white transition-colors hover:bg-white/10"
                title="重置"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 图表内容 */}
          <div
            className={`flex h-[80vh] w-[80vw] items-center justify-center transition-all duration-200 ${
              isPreviewVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
            onClick={e => e.stopPropagation()}
            onWheel={handlePreviewWheel}
          >
            <div
              className="bg-background/95 border-border/50 flex h-full w-full select-none items-center justify-center overflow-hidden rounded-lg border backdrop-blur-sm"
              style={{ cursor: isPreviewDragging ? 'grabbing' : 'grab' }}
              onMouseDown={handlePreviewMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseUp={handlePreviewMouseUp}
              onMouseLeave={handlePreviewMouseUp}
            >
              <div
                className="transition-transform duration-100 [&_svg]:h-auto [&_svg]:max-w-full"
                style={{
                  transform: `translate(${previewPosition.x}px, ${previewPosition.y}px) scale(${previewScale})`,
                  transformOrigin: 'center center',
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          </div>

          {/* 提示文字 */}
          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 transition-all duration-200 ${
              isPreviewVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            点击背景或按 ESC 键关闭
          </div>
        </div>
      )}
    </div>
  );
}
