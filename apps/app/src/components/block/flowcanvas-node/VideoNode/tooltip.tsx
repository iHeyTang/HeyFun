import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { TiptapEditor, TiptapEditorRef } from '@/components/block/flowcanvas/components/SmartEditorNode';
import { MentionItem } from '@/components/block/flowcanvas/components/SmartEditorNode/MentionList';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { MentionOptions } from '@tiptap/extension-mention';
import { Editor } from '@tiptap/react';
import { WandSparkles } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RatioIcon } from '../../ratio-icon';
import { VideoNodeActionData, VideoNodeProcessor } from './processor';
import { VideoJsonSchema } from '@repo/llm/aigc';
import { useTranslations } from 'next-intl';

export interface VideoNodeTooltipProps {
  nodeId: string;
  value?: VideoNodeActionData;
  onValueChange?: (data: VideoNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new VideoNodeProcessor();

const VideoNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: VideoNodeTooltipProps) => {
  const t = useTranslations('flowcanvas.nodeTooltips');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(actionData?.aspectRatio);
  const [selectedDuration, setSelectedDuration] = useState(actionData?.duration);
  const [selectedResolution, setSelectedResolution] = useState(actionData?.resolution);
  const editorRef = useRef<TiptapEditorRef>(null);

  // 获取节点输入数据
  const nodeInputs = useMemo(() => {
    return flowGraph.getPreNodesById(nodeId);
  }, [flowGraph, nodeId]);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as VideoJsonSchema;
  }, [selectedModel]);

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
    if (actionData?.resolution !== undefined) {
      setSelectedResolution(actionData.resolution);
    }
  }, [actionData?.prompt, actionData?.selectedModel, actionData?.aspectRatio, actionData?.duration]);

  const handleSubmit = async () => {
    onValueChange?.({
      prompt: localPrompt,
      selectedModel: selectedModelName,
      aspectRatio: selectedAspectRatio,
      duration: selectedDuration,
      resolution: selectedResolution,
    });
    updateStatus(NodeStatus.PROCESSING);
    try {
      const node = flowGraph.getNodeById(nodeId)!;
      const input = flowGraph.getNodeInputsById(nodeId);

      const inputTexts = Array.from(input.entries()).map(([key, value]) => ({ nodeId: key, texts: value.texts }));
      const inputImages = Array.from(input.entries()).map(([key, value]) => ({
        nodeId: key,
        images: value.images || [],
      }));
      const inputVideos = Array.from(input.entries()).map(([key, value]) => ({
        nodeId: key,
        videos: value.videos || [],
      }));
      const inputAudios = Array.from(input.entries()).map(([key, value]) => ({
        nodeId: key,
        audios: value.audios || [],
      }));

      const result = await processor.execute({
        input: { images: inputImages, texts: inputTexts, videos: inputVideos, audios: inputAudios, musics: [] },
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
    onValueChange?.({
      prompt: newPrompt,
      selectedModel: selectedModelName,
      aspectRatio: selectedAspectRatio,
      duration: selectedDuration,
      resolution: selectedResolution,
    });
  };

  // 创建插入项配置
  const insertItems: MentionOptions<MentionItem>['suggestion']['items'] = useCallback(
    (props: { query: string; editor: Editor }) => {
      const list: MentionItem[] = [];
      nodeInputs.forEach(input => {
        if (input.data.output?.images) {
          input.data.output.images.forEach((imageKey, index) => {
            list.push({
              type: 'image' as const,
              id: `image:${imageKey}`,
              imageAlt: imageKey,
              label: `${input.data.label} ${index + 1}`,
              imageUrl: `/api/oss/${imageKey}`,
            });
          });
        }
        if (input.data.output?.texts) {
          input.data.output.texts.forEach((text, index) => {
            list.push({
              type: 'text' as const,
              id: `text:${input.id}`,
              label: `${input.data.label} ${index + 1} : ${text.slice(0, 10)}...`,
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
        placeholder={t('video.placeholder')}
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
              onValueChange?.({
                prompt: localPrompt,
                selectedModel: v,
                aspectRatio: '',
                duration: '',
                resolution: '',
              });
            }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder={tCommon('selectModel')} />
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
          {selectedModelParamsSchema?.aspectRatio?.enum?.length && (
            <Select
              value={selectedAspectRatio}
              onValueChange={(v: string) => {
                setSelectedAspectRatio(v);
                onValueChange?.({
                  prompt: localPrompt,
                  selectedModel: selectedModelName,
                  aspectRatio: v,
                  duration: selectedDuration,
                  resolution: selectedResolution,
                });
              }}
            >
              <SelectTrigger size="sm" className="text-xs" hideIcon>
                <SelectValue placeholder="Aspect" />
              </SelectTrigger>
              <SelectContent>
                {selectedModelParamsSchema.aspectRatio.enum.map(option => {
                  const optionString = option as string;
                  return (
                    <SelectItem key={optionString} value={optionString}>
                      <RatioIcon ratio={optionString} />
                      {optionString}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          {selectedModelParamsSchema?.duration?.enum?.length && (
            <Select
              value={selectedDuration?.toString()}
              onValueChange={(v: string) => {
                setSelectedDuration(v);
                onValueChange?.({
                  prompt: localPrompt,
                  selectedModel: selectedModelName,
                  aspectRatio: selectedAspectRatio,
                  duration: v,
                  resolution: selectedResolution,
                });
              }}
            >
              <SelectTrigger size="sm" className="text-xs" hideIcon>
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent>
                {selectedModelParamsSchema.duration.enum.map(option => {
                  const optionString = option as string;
                  return (
                    <SelectItem key={optionString} value={optionString}>
                      {optionString}s
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          {selectedModelParamsSchema?.resolution?.enum?.length && (
            <Select
              value={selectedResolution}
              onValueChange={(v: string) => {
                setSelectedResolution(v);
                onValueChange?.({
                  prompt: localPrompt,
                  selectedModel: selectedModelName,
                  aspectRatio: selectedAspectRatio,
                  duration: selectedDuration,
                  resolution: v,
                });
              }}
            >
              <SelectTrigger size="sm" className="text-xs" hideIcon>
                <SelectValue placeholder="Resolution" />
              </SelectTrigger>
              <SelectContent>
                {selectedModelParamsSchema.resolution.enum.map(option => {
                  const optionString = option as string;
                  return (
                    <SelectItem key={optionString} value={optionString}>
                      {optionString}
                    </SelectItem>
                  );
                })}
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
