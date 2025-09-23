import { BaseNode, NodeData, useFlowGraph } from '@/components/block/flowcanvas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextNodeActionData } from './processor';
import { TextNodeTooltip, TextNodeTooltipProps } from './tooltip';
import { Textarea } from '@/components/ui/textarea';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleTextClick = () => {
    // 清除之前的定时器
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    // 设置定时器，如果300ms内没有双击，则认为是单击
    clickTimeoutRef.current = setTimeout(() => {
      if (!isDragging) {
        // 这里可以添加单击逻辑，比如选中节点
        console.log('Text node clicked');
      }
    }, 300);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setText(newText);
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    updateNodeOutput(text);
  };

  // 更新节点输出数据的函数
  const updateNodeOutput = (newText: string) => {
    const newOutput = { texts: [newText] };
    // 通知画布API节点数据已更新
    flowGraph.updateNodeData(id, { output: newOutput });
    // 同时更新本地数据引用
    data.output = newOutput;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 阻止所有键盘事件冒泡到ReactFlow，避免意外删除节点
    event.stopPropagation();

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      setIsEditing(false);
      updateNodeOutput(text);
    }
    if (event.key === 'Escape') {
      setIsEditing(false);
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

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

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
      console.log('TextNode AI生成文本:', generatedText);
    },
    [updateNodeOutput],
  );

  return (
    <BaseNode
      data={data}
      id={id}
      className={`bg-theme-card max-w-[400px] min-w-[200px]`}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      tooltip={
        <TextNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmitSuccess} />
      }
    >
      <div className="h-32 w-64 rounded p-2">
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onKeyDown={handleKeyDown}
            rows={3}
            onMouseDown={e => e.stopPropagation()}
            placeholder="请输入文本内容..."
          />
        ) : (
          <div
            className={`border-theme-border-primary text-theme-foreground hover:border-theme-border-secondary hover:bg-theme-accent/50 cursor-pointer rounded border-dashed p-2 text-xs break-words whitespace-pre-wrap transition-colors duration-200`}
            onClick={handleTextClick}
            onDoubleClick={handleTextDoubleClick}
          >
            {text || '双击输入文本内容...'}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
