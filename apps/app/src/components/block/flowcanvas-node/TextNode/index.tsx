import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { FlowCanvasTextEditor, FlowCanvasTextEditorRef } from '@/components/block/flowcanvas/components/FlowCanvasTextEditor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextNodeActionData } from './processor';
import { TextNodeTooltip, TextNodeTooltipProps } from './tooltip';
import { Loader2 } from 'lucide-react';

interface TextNodeProps {
  data: NodeData<TextNodeActionData>;
  id: string;
}

export { TextNodeProcessor } from './processor';

export default function TextNode({ data, id }: TextNodeProps) {
  const flowGraph = useFlowGraph();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.output?.texts?.[0] || '');
  const editorRef = useRef<FlowCanvasTextEditorRef>(null);
  const status = useNodeStatusById(id);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newText = data.output?.texts?.[0] || '';
    if (!isEditing) {
      setText(newText);
    }
  }, [data.output?.texts, isEditing]);

  const handleTextDoubleClick = () => {
    setIsEditing(true);
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
      onBlur={handleTextBlur}
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
        <FlowCanvasTextEditor
          ref={editorRef}
          value={text}
          onChange={handleTextChange}
          editable={isEditing}
          placeholder="Enter text directly, or chat with AI below"
          className="nodrag h-fit min-h-[80px] w-fit min-w-[200px] cursor-text"
          autoFocus={true}
          nodeId={id}
        />
      ) : (
        <div
          className={`border-border-primary text-foreground hover:border-border-secondary hover:bg-accent/50 h-fit min-h-[80px] w-fit min-w-[200px] cursor-pointer rounded border-dashed p-2 text-xs break-words whitespace-pre-wrap transition-colors duration-200`}
          onDoubleClick={handleTextDoubleClick}
        >
          <FlowCanvasTextEditor
            ref={editorRef}
            value={text}
            onChange={handleTextChange}
            editable={isEditing}
            placeholder="Double click to edit"
            className="h-fit min-h-[80px] w-fit min-w-[200px]"
            autoFocus={true}
            nodeId={id}
          />
        </div>
      )}
    </BaseNode>
  );
}
