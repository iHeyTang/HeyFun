import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAigc } from '@/hooks/use-llm';
import { ArrowUp } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { VideoNodeActionData, VideoNodeProcessor } from './processor';
import { RatioIcon } from '../../ratio-icon';

export interface VideoNodeTooltipProps {
  nodeId: string;
  value?: VideoNodeActionData;
  onValueChange?: (data: VideoNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new VideoNodeProcessor();

const VideoNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: VideoNodeTooltipProps) => {
  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [isComposing, setIsComposing] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(actionData?.aspectRatio);
  const [selectedDuration, setSelectedDuration] = useState(actionData?.duration);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

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
    if (actionData?.duration !== undefined) {
      setSelectedDuration(actionData.duration);
    }
  }, [actionData?.prompt, actionData?.selectedModel, actionData?.aspectRatio, actionData?.duration]);

  const handleSubmit = async () => {
    onValueChange?.({ prompt: localPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio, duration: selectedDuration });
    updateStatus(NodeStatus.PROCESSING);
    try {
      const node = flowGraph.getNodeById(nodeId)!;
      const input = flowGraph.getNodeInputsById(nodeId);
      const params = { ...node, data: { ...node.data, input } };
      const result = await processor.execute(params);
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ videos: result.data?.videos });
      } else {
        updateStatus(NodeStatus.FAILED);
      }
    } catch (error: any) {
      console.error(error);
      updateStatus(NodeStatus.FAILED, { error: error?.message || error });
    }
  };

  const handlePromptChange = (newPrompt: string) => {
    // 始终更新本地状态以显示用户输入
    setLocalPrompt(newPrompt);

    // 只有在非组词状态下才更新外部状态
    if (!isComposing) {
      onValueChange?.({ prompt: newPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio, duration: selectedDuration });
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
    onValueChange?.({ prompt: newPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio, duration: selectedDuration });
  };

  return (
    <div className="nodrag flex min-w-[480px] flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      <Textarea
        value={localPrompt}
        onChange={e => handlePromptChange(e.target.value)}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
        onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
        placeholder="根据 prompt 生成视频"
        className="h-24 w-full resize-none border-none! outline-none!"
      />

      {/* 下半部分：Footer - 模型选择和提交按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-start gap-2">
          {/* 左侧：模型选择 */}
          <Select
            value={selectedModelName}
            onValueChange={(v: string) => {
              setSelectedModelName(v);
              onValueChange?.({ prompt: localPrompt, selectedModel: v, aspectRatio: '', duration: undefined });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('text-to-video') || model.generationTypes.includes('image-to-video'))
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
                onValueChange?.({ prompt: localPrompt, selectedModel: selectedModelName, aspectRatio: v, duration: selectedDuration });
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
        <Button
          onClick={handleSubmit}
          onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
          className="cursor-pointer"
          size="icon"
          variant="ghost"
        >
          <ArrowUp />
        </Button>
      </div>
    </div>
  );
};

// 使用 memo 优化组件，只有当初始值真正改变时才重新渲染
export const VideoNodeTooltip = memo(VideoNodeTooltipComponent, (prevProps, nextProps) => {
  // 现在只需要比较初始值，因为我们不会在输入过程中触发外部更新
  return (
    prevProps.value?.prompt === nextProps.value?.prompt &&
    prevProps.value?.selectedModel === nextProps.value?.selectedModel &&
    prevProps.value?.aspectRatio === nextProps.value?.aspectRatio &&
    prevProps.value?.duration === nextProps.value?.duration &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
