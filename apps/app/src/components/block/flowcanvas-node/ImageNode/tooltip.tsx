import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WandSparkles } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { ImageNodeActionData, ImageNodeProcessor } from './processor';
import { useAigc } from '@/hooks/use-llm';
import { Textarea } from '@/components/ui/textarea';
import { RatioIcon } from '../../ratio-icon';

export interface ImageNodeTooltipProps {
  nodeId: string;
  value?: ImageNodeActionData;
  onValueChange?: (data: ImageNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new ImageNodeProcessor();

const ImageNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: ImageNodeTooltipProps) => {
  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [isComposing, setIsComposing] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(actionData?.aspectRatio);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  console.log(selectedModel);

  // 当外部值改变时同步本地状态
  useEffect(() => {
    if (actionData?.prompt !== undefined) {
      setLocalPrompt(actionData.prompt);
    }
    if (actionData?.selectedModel !== undefined) {
      setSelectedModelName(actionData.selectedModel);
    }
    if (actionData?.aspectRatio !== undefined) {
      setSelectedAspectRatio(actionData.aspectRatio);
    }
  }, [actionData?.prompt, actionData?.selectedModel, actionData?.aspectRatio]);

  const handleSubmit = async () => {
    onValueChange?.({ prompt: localPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio });
    updateStatus(NodeStatus.PROCESSING);
    try {
      const node = flowGraph.getNodeById(nodeId)!;
      const input = flowGraph.getNodeInputsById(nodeId);
      const params = { ...node, data: { ...node.data, input } };
      const result = await processor.execute(params);
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ images: result.data?.images });
      } else {
        updateStatus(NodeStatus.FAILED);
      }
    } catch (error) {
      updateStatus(NodeStatus.FAILED);
    }
  };

  const handlePromptChange = (newPrompt: string) => {
    // 始终更新本地状态以显示用户输入
    setLocalPrompt(newPrompt);

    // 只有在非组词状态下才更新外部状态
    if (!isComposing) {
      onValueChange?.({ prompt: newPrompt, selectedModel: selectedModelName });
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    // 组词结束后更新外部状态
    const newPrompt = (e.target as HTMLTextAreaElement).value;
    setLocalPrompt(newPrompt);
    onValueChange?.({ prompt: newPrompt, selectedModel: selectedModelName });
  };

  return (
    <div className="flex min-w-[480px] flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      <Textarea
        value={localPrompt}
        onChange={e => handlePromptChange(e.target.value)}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
        onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
        placeholder="根据 prompt 生图"
        className="h-24 w-full resize-none border-none! outline-none!"
      />

      {/* 下半部分：Footer - 模型选择和提交按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center justify-start gap-2">
          {/* 左侧：模型选择 */}
          <Select
            value={selectedModelName}
            onValueChange={(v: string) => {
              setSelectedModelName(v);
              onValueChange?.({ prompt: localPrompt, selectedModel: v, aspectRatio: '' });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('text-to-image') || model.generationTypes.includes('image-to-image'))
                .map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {selectedModel?.paramsSchema?.properties?.aspectRatio?.enum?.length && (
            <Select
              value={selectedAspectRatio}
              onValueChange={(v: string) => {
                setSelectedAspectRatio(v);
                onValueChange?.({ prompt: localPrompt, selectedModel: selectedModelName, aspectRatio: v });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Aspect Ratio" />
              </SelectTrigger>
              <SelectContent>
                {selectedModel.paramsSchema.properties.aspectRatio.enum.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    <RatioIcon ratio={option} />
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {/* 右侧：提交按钮 */}
        <Button onClick={handleSubmit} onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} className="cursor-pointer" size="icon">
          <WandSparkles />
        </Button>
      </div>
    </div>
  );
};

// 使用 memo 优化组件，只有当初始值真正改变时才重新渲染
export const ImageNodeTooltip = memo(ImageNodeTooltipComponent, (prevProps, nextProps) => {
  // 现在只需要比较初始值，因为我们不会在输入过程中触发外部更新
  return (
    prevProps.value?.prompt === nextProps.value?.prompt &&
    prevProps.value?.selectedModel === nextProps.value?.selectedModel &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
