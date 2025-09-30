import { BaseNode, NodeData, useFlowGraph } from '@/components/block/flowcanvas';
import { TiptapEditor, TiptapEditorRef } from '@/components/block/flowcanvas/components/SmartEditorNode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextNodeActionData } from './processor';
import { TextNodeTooltip, TextNodeTooltipProps } from './tooltip';

interface TextNodeProps {
  data: NodeData<TextNodeActionData>;
  id: string;
}

export { TextNodeProcessor } from './processor';

export default function TextNode({ data, id }: TextNodeProps) {
  const flowGraph = useFlowGraph();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.output?.texts?.[0] || '');
  const [isDragging, setIsDragging] = useState(false);
  const editorRef = useRef<TiptapEditorRef>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newText = data.output?.texts?.[0] || '';
    if (!isEditing) {
      setText(newText);
    }
  }, [data.output?.texts, isEditing]);

  const handleTextDoubleClick = () => {
    if (!isDragging) {
      setIsEditing(true);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    updateNodeOutput(text);
  };

  // 更新节点输出数据的函数
  const updateNodeOutput = useCallback(
    (newText: string) => {
      const newOutput = { texts: [newText] };
      // 通知画布API节点数据已更新
      flowGraph.updateNodeData(id, { output: newOutput });
      // 同时更新本地数据引用
      data.output = newOutput;
    },
    [flowGraph, id, data],
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

  // 处理拖动开始
  const handleDragStart = () => {
    setIsDragging(true);
    // 清除点击定时器
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  };

  // 处理拖动结束
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // 处理actionData变化 - 使用 useCallback 稳定函数引用
  const handleActionDataChange = useCallback<NonNullable<TextNodeTooltipProps['onValueChange']>>(
    newActionData => {
      data.actionData = { ...data.actionData, ...newActionData };
    },
    [data],
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
      className={`bg-card h-fit w-fit`}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onBlur={handleTextBlur}
      tooltip={
        <TextNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmitSuccess} />
      }
    >
      {isEditing ? (
        <TiptapEditor
          ref={editorRef}
          value={text}
          onChange={handleTextChange}
          editable={isEditing}
          placeholder="请输入文本内容..."
          className="nodrag h-fit min-h-[80px] w-fit min-w-[200px] cursor-text"
        />
      ) : (
        <div
          className={`border-border-primary text-foreground hover:border-border-secondary hover:bg-accent/50 h-fit min-h-[80px] w-fit min-w-[200px] cursor-pointer rounded border-dashed p-2 text-xs break-words whitespace-pre-wrap transition-colors duration-200`}
          onDoubleClick={handleTextDoubleClick}
        >
          <TiptapEditor
            ref={editorRef}
            value={text}
            onChange={handleTextChange}
            editable={isEditing}
            placeholder="请输入文本内容..."
            className="h-fit min-h-[80px] w-fit min-w-[200px]"
          />
        </div>
      )}
    </BaseNode>
  );
}
