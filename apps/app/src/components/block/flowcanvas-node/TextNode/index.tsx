import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { FlowCanvasTextEditor, FlowCanvasTextEditorRef } from '@/components/block/flowcanvas/components/FlowCanvasTextEditor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextNodeActionData } from './processor';
import { TextNodeTooltip, TextNodeTooltipProps } from './tooltip';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextNodeProps {
  data: NodeData<TextNodeActionData>;
  id: string;
}

export { TextNodeProcessor } from './processor';

export default function TextNode({ data, id }: TextNodeProps) {
  const flowGraph = useFlowGraph();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.output?.texts?.list?.[0] || '');
  const editorRef = useRef<FlowCanvasTextEditorRef>(null);
  const status = useNodeStatusById(id);

  // 获取节点尺寸，使用 useMemo 确保尺寸变化时重新计算
  const node = flowGraph.getNodeById(id);
  const hasFixedSize = useMemo(() => {
    const nodeWidth = node?.width || node?.style?.width;
    const nodeHeight = node?.height || node?.style?.height;
    return typeof nodeWidth === 'number' && typeof nodeHeight === 'number';
  }, [node?.width, node?.height, node?.style?.width, node?.style?.height]);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newText = data.output?.texts?.list?.[0] || '';
    if (!isEditing) {
      // 使用 requestAnimationFrame 避免在 effect 中直接调用 setState
      requestAnimationFrame(() => {
        setText(newText);
      });
    }
  }, [data.output?.texts, isEditing]);

  const handleTextDoubleClick = () => {
    setIsEditing(true);
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  const handleTextBlur = (event: React.FocusEvent) => {
    // 检查 blur 事件的相关目标（relatedTarget）是否在 MentionList 中
    const relatedTarget = event.relatedTarget as HTMLElement | null;

    // 如果相关目标是 mention list 或其子元素，则不触发 blur
    if (relatedTarget) {
      const isMentionList = relatedTarget.closest('[data-mention-list]') !== null;
      if (isMentionList) {
        // 延迟重新聚焦编辑器，确保 mention 选择完成
        setTimeout(() => {
          editorRef.current?.focus();
        }, 0);
        return;
      }
    }

    // 使用 setTimeout 延迟处理，确保 mention 选择完成后再处理 blur
    setTimeout(() => {
      // 检查当前焦点是否在编辑器内（通过检查 activeElement 是否包含在编辑器容器中）
      const activeElement = document.activeElement as HTMLElement | null;
      const isEditorFocused = activeElement?.closest('.ProseMirror') !== null;

      // 如果编辑器仍然失去焦点，且不在 mention list 中，则处理 blur
      if (!isEditorFocused && activeElement?.closest('[data-mention-list]') === null) {
        setIsEditing(false);
        updateNodeOutput(text);
      }
    }, 150);
  };

  // 更新节点输出数据的函数
  const updateNodeOutput = useCallback(
    (newText: string) => {
      const newOutput = { texts: { list: [newText], selected: newText } };
      // 通知画布API节点数据已更新
      flowGraph.updateNodeData(id, { output: newOutput });
      // 不要直接修改 props，只通过 flowGraph.updateNodeData 更新
    },
    [flowGraph, id],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // 阻止所有键盘事件冒泡到ReactFlow，避免意外删除节点
    event.stopPropagation();

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      setIsEditing(false);
      updateNodeOutput(text);
      editorRef.current?.blur();
    }
    if (event.key === 'Escape') {
      setIsEditing(false);
      editorRef.current?.blur();
    }
  };

  // 处理actionData变化 - 使用 useCallback 稳定函数引用
  const handleActionDataChange = useCallback<NonNullable<TextNodeTooltipProps['onValueChange']>>(
    newActionData => {
      // 通过 flowGraph 更新数据，而不是直接修改 props
      flowGraph.updateNodeData(id, { actionData: { ...data.actionData, ...newActionData } });
    },
    [flowGraph, id, data.actionData],
  );

  // 处理tooltip提交 - 使用 useCallback 稳定函数引用
  const handleTooltipSubmitSuccess = useCallback<NonNullable<TextNodeTooltipProps['onSubmitSuccess']>>(
    generatedText => {
      // AI生成的文本设置到主内容区
      setText(generatedText);
      updateNodeOutput(generatedText);
    },
    [updateNodeOutput],
  );

  return (
    <BaseNode
      data={data}
      id={id}
      className={`bg-card`}
      onBlur={handleTextBlur}
      resizeConfig={{ enabled: true, minWidth: 200, minHeight: 80, maxWidth: 800, maxHeight: 600 }}
      tooltip={
        <TextNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmitSuccess} />
      }
    >
      {status.status === NodeStatus.PROCESSING && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded">
          {/* 高斯模糊蒙版 */}
          <div className="bg-accent/20 absolute inset-0 rounded backdrop-blur-lg"></div>
          {/* Loading动画 */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        </div>
      )}
      {isEditing ? (
        <div
          className={cn('nodrag cursor-text', hasFixedSize ? 'h-full w-full' : 'h-fit min-h-[80px] w-fit min-w-[200px]')}
          style={hasFixedSize ? { width: '100%', height: '100%' } : undefined}
        >
          <FlowCanvasTextEditor
            ref={editorRef}
            value={text}
            onChange={handleTextChange}
            editable={isEditing}
            placeholder="Enter text directly, or chat with AI below"
            className={hasFixedSize ? 'h-full w-full' : 'h-fit min-h-[80px] w-fit min-w-[200px]'}
            autoFocus={true}
            nodeId={id}
          />
        </div>
      ) : (
        <div
          className={cn(
            'border-border-primary text-foreground hover:border-border-secondary hover:bg-accent/50 cursor-pointer whitespace-pre-wrap break-words rounded border-dashed p-2 text-xs transition-colors duration-200',
            hasFixedSize ? 'flex h-full w-full flex-col' : 'h-fit min-h-[80px] w-fit min-w-[200px]',
          )}
          style={hasFixedSize ? { width: '100%', height: '100%' } : undefined}
          onDoubleClick={handleTextDoubleClick}
        >
          <FlowCanvasTextEditor
            ref={editorRef}
            value={text}
            onChange={handleTextChange}
            editable={isEditing}
            placeholder="Double click to edit"
            className={cn(hasFixedSize ? 'h-full w-full flex-1' : 'h-fit min-h-[80px] w-fit min-w-[200px]')}
            autoFocus={true}
            nodeId={id}
          />
        </div>
      )}
    </BaseNode>
  );
}
