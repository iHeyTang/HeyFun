import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { WandSparkles } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlowCanvasTextEditor, FlowCanvasTextEditorRef } from '../../flowcanvas/components/FlowCanvasTextEditor';
import { RatioIcon } from '../../ratio-icon';
import { ImageNodeActionData, ImageNodeProcessor } from './processor';
import { FullscreenModal, fullscreenModalRef } from '@/components/block/preview/fullscreen';
import { ImageJsonSchema } from '@repo/llm/aigc';
import { useTranslations } from 'next-intl';

export interface ImageNodeTooltipProps {
  nodeId: string;
  value?: ImageNodeActionData;
  onValueChange?: (data: ImageNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new ImageNodeProcessor();

const ImageNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: ImageNodeTooltipProps) => {
  const t = useTranslations('flowcanvas.nodeTooltips');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const editorRef = useRef<FlowCanvasTextEditorRef>(null);
  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(actionData?.aspectRatio);
  const fullscreenModalRef = useRef<fullscreenModalRef | null>(null);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as ImageJsonSchema;
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
  }, [actionData?.prompt, actionData?.selectedModel, actionData?.aspectRatio]);

  const handleSubmit = async () => {
    onValueChange?.({ ...actionData, prompt: localPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio });
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
        onSubmitSuccess?.({ images: [...(node.data.output?.images || []), ...(result.data?.images || [])] });
        onValueChange?.({ ...actionData });
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
    onValueChange?.({ ...actionData, prompt: newPrompt, selectedModel: selectedModelName, aspectRatio: selectedAspectRatio });
  };

  const handleMentionClick = useCallback(async (mentionId: string) => {
    const type = mentionId.split(':')[0];
    if (type === 'image') {
      const key = mentionId.split(':')[1] || '';
      const url = `/api/oss/${key}`;
      fullscreenModalRef.current?.show(url, 'image');
      return;
    }

    if (type === 'video') {
      const key = mentionId.split(':')[1] || '';
      const url = `/api/oss/${key}`;
      fullscreenModalRef.current?.show(url, 'video');
      return;
    }
  }, []);

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      <FlowCanvasTextEditor
        value={localPrompt}
        onChange={handlePromptChange}
        placeholder={t('image.placeholder')}
        className="h-24 w-full resize-none border-none! outline-none!"
        nodeId={nodeId}
        ref={editorRef}
        onMentionClick={handleMentionClick}
      />

      {/* 下半部分：Footer - 模型选择和提交按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center justify-start gap-2">
          {/* 左侧：模型选择 */}
          <Select
            value={selectedModelName}
            onValueChange={(v: string) => {
              setSelectedModelName(v);
              onValueChange?.({ ...actionData, prompt: localPrompt, selectedModel: v, aspectRatio: '' });
            }}
          >
            <SelectTrigger size="sm" className="text-xs" hideIcon>
              <SelectValue placeholder={tCommon('selectModel')} />
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
          {selectedModelParamsSchema?.aspectRatio?.enum?.length && (
            <Select
              value={selectedAspectRatio}
              onValueChange={(v: string) => {
                setSelectedAspectRatio(v);
                onValueChange?.({ ...actionData, prompt: localPrompt, selectedModel: selectedModelName, aspectRatio: v });
              }}
            >
              <SelectTrigger size="sm" className="text-xs" hideIcon>
                <SelectValue placeholder={tCommon('aspect')} />
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
        </div>
        {/* 右侧：提交按钮 */}
        <Button onClick={handleSubmit} onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} className="cursor-pointer" size="icon">
          <WandSparkles />
        </Button>
      </div>
      <FullscreenModal ref={fullscreenModalRef} />
    </div>
  );
};

// 使用 memo 优化组件，只有当初始值真正改变时才重新渲染
export const ImageNodeTooltip = memo(ImageNodeTooltipComponent, (prevProps, nextProps) => {
  // 现在只需要比较初始值，因为我们不会在输入过程中触发外部更新
  return (
    prevProps.value?.prompt === nextProps.value?.prompt &&
    prevProps.value?.selectedModel === nextProps.value?.selectedModel &&
    prevProps.value?.aspectRatio === nextProps.value?.aspectRatio &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
