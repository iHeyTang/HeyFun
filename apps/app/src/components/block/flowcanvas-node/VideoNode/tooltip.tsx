import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { FlowCanvasTextEditor, FlowCanvasTextEditorRef } from '@/components/block/flowcanvas/components/FlowCanvasTextEditor';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { WandSparkles } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { RatioIcon } from '../../ratio-icon';
import { VideoNodeActionData, VideoNodeProcessor } from './processor';
import { VideoJsonSchema } from '@repo/llm/aigc';
import { useTranslations } from 'next-intl';
import { AdvancedOptionsForm } from '../AdvancedOptionsForm';

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
  const [advancedParams, setAdvancedParams] = useState<Record<string, any>>(actionData?.advancedParams || {});
  const editorRef = useRef<FlowCanvasTextEditorRef>(null);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as VideoJsonSchema;
  }, [selectedModel]);

  // 当外部值改变时同步本地状态
  useEffect(() => {
    // 使用 requestAnimationFrame 避免同步 setState
    requestAnimationFrame(() => {
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
    });
  }, [actionData?.prompt, actionData?.selectedModel, actionData?.aspectRatio, actionData?.duration, actionData?.resolution]);

  const handleSubmit = async () => {
    onValueChange?.({
      prompt: localPrompt,
      selectedModel: selectedModelName,
      aspectRatio: selectedAspectRatio,
      duration: selectedDuration,
      resolution: selectedResolution,
      advancedParams,
    });
    updateStatus(NodeStatus.PROCESSING);
    try {
      const node = flowGraph.getNodeById(nodeId)!;
      const inputs = flowGraph.getNodeInputsById(nodeId);

      const inputImages = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, images: value.images }));
      const inputTexts = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, texts: value.texts }));
      const inputVideos = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, videos: value.videos }));
      const inputAudios = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, audios: value.audios }));
      const inputMusics = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, musics: value.musics }));

      const result = await processor.execute({
        input: { images: inputImages, texts: inputTexts, videos: inputVideos, audios: inputAudios, musics: inputMusics },
        actionData: { ...node.data.actionData, prompt: editorRef.current?.getText(), advancedParams },
      });
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ videos: { list: result.data?.videos || [], selected: result.data?.videos?.[0] || '' } });
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
      advancedParams,
    });
  };

  return (
    <div className="nodrag flex flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      {selectedModelParamsSchema?.prompt?.type === 'string' && (
        <FlowCanvasTextEditor
          value={localPrompt}
          onChange={handlePromptChange}
          placeholder={t('video.placeholder')}
          className="border-none! outline-none! h-24 w-full resize-none"
          nodeId={nodeId}
          ref={editorRef}
        />
      )}

      {/* 下半部分：Footer - 模型选择和提交按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center justify-start">
          {/* 左侧：模型选择 */}
          <Select
            value={selectedModelName}
            onValueChange={(v: string) => {
              setSelectedModelName(v);
              setAdvancedParams({});
              onValueChange?.({
                prompt: localPrompt,
                selectedModel: v,
                aspectRatio: '',
                duration: '',
                resolution: '',
                advancedParams: {},
              });
            }}
          >
            <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none" hideIcon>
              <SelectValue placeholder={tCommon('selectModel')}>{selectedModel?.displayName || ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(
                  model =>
                    model.generationTypes.includes('text-to-video') ||
                    model.generationTypes.includes('image-to-video') ||
                    model.generationTypes.includes('keyframe-to-video') ||
                    model.generationTypes.includes('video-to-video') ||
                    model.generationTypes.includes('lip-sync'),
                )
                .map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    <div className="flex flex-col items-start justify-between gap-2">
                      <div>{model.displayName}</div>
                      <div className="text-muted-foreground text-xs">{model.description}</div>
                    </div>
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
              <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none" hideIcon>
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
              <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none" hideIcon>
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
              <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none" hideIcon>
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
        <Button onClick={handleSubmit} onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} className="ml-8 cursor-pointer" size="icon">
          <WandSparkles />
        </Button>
      </div>

      {/* 高级选项 */}
      {selectedModelParamsSchema?.advanced && (
        <AdvancedOptionsForm
          schema={selectedModelParamsSchema.advanced}
          values={advancedParams}
          title={tCommon('advanced')}
          onChange={params => {
            setAdvancedParams(params);
            onValueChange?.({
              prompt: localPrompt,
              selectedModel: selectedModelName,
              aspectRatio: selectedAspectRatio,
              duration: selectedDuration,
              resolution: selectedResolution,
              advancedParams: params,
            });
          }}
        />
      )}
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
