import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { TiptapEditor, TiptapEditorRef } from '@/components/block/flowcanvas/components/SmartEditorNode';
import { MentionItem } from '@/components/block/flowcanvas/components/SmartEditorNode/MentionList';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { MentionOptions } from '@tiptap/extension-mention';
import { Editor } from '@tiptap/react';
import { WandSparkles } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RatioIcon } from '../../ratio-icon';
import { VideoNodeActionData, VideoNodeProcessor } from './processor';

export interface VideoNodeTooltipProps {
  nodeId: string;
  value?: VideoNodeActionData;
  onValueChange?: (data: VideoNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new VideoNodeProcessor();

const VideoNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: VideoNodeTooltipProps) => {
  const { getSignedUrl } = useSignedUrl();

  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(actionData?.aspectRatio);
  const [selectedDuration, setSelectedDuration] = useState(actionData?.duration);
  const editorRef = useRef<TiptapEditorRef>(null);

  // 获取节点输入数据
  const nodeInputs = useMemo(() => {
    return flowGraph.getPreNodesById(nodeId);
  }, [flowGraph, nodeId]);

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
      const inputImages = Array.from(input.entries()).map(([key, value]) => ({ nodeId: key, images: value.images }));
      const inputTexts = Array.from(input.entries()).map(([key, value]) => ({ nodeId: key, texts: value.texts }));
      const inputVideos = Array.from(input.entries()).map(([key, value]) => ({ nodeId: key, videos: value.videos }));
      const result = await processor.execute({
        input: { images: inputImages, texts: inputTexts, videos: inputVideos },
        actionData: { ...node.data.actionData, prompt: editorRef.current?.getText() },
      });
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
    onValueChange?.({ prompt: newPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio, duration: selectedDuration });
  };

  // 创建插入项配置
  const insertItems: MentionOptions<MentionItem>['suggestion']['items'] = useCallback(
    (props: { query: string; editor: Editor }) => {
      const list: MentionItem[] = [];
      nodeInputs.forEach(input => {
        if (input.data.output?.images) {
          input.data.output.images.forEach(async (image, index) => {
            list.push({
              id: `image:${image.key!}`,
              type: 'image' as const,
              imageAlt: image.key || '',
              label: `${input.data.label} ${index + 1}`,
              imageUrl: image.url ? image.url : await getSignedUrl(image.key!),
            });
          });
        }
        if (input.data.output?.texts) {
          input.data.output.texts.forEach((text, index) => {
            list.push({
              type: 'text' as const,
              id: `text:${nodeId}`,
              textPreview: `${input.data.label} ${index + 1} : ${text.slice(0, 10)}...`,
              textLength: text.length,
            });
          });
        }
      });
      return list;
    },
    [nodeInputs],
  );

  return (
    <div className="nodrag flex min-w-[480px] flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      <TiptapEditor
        value={localPrompt}
        onChange={handlePromptChange}
        placeholder="Enter prompt to generate a video. First image will be used as the first frame"
        className="h-24 w-full resize-none border-none! outline-none!"
        mentionSuggestionItems={insertItems}
        ref={editorRef}
      />

      {/* 下半部分：Footer - 模型选择和提交按钮 */}
      <div className="flex items-center justify-between gap-2">
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
          {selectedModel?.paramsSchema?.properties?.duration?.enum?.length && (
            <Select
              value={selectedDuration?.toString()}
              onValueChange={(v: string) => {
                setSelectedDuration(v);
                onValueChange?.({ prompt: localPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio, duration: v });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent>
                {selectedModel.paramsSchema.properties.duration.enum.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}s
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
