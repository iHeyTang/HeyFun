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
import { AdvancedOptionsForm } from '../AdvancedOptionsForm';

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

  // 获取默认模型（第一个支持图像生成的模型）
  const defaultModel = useMemo(() => {
    const specificModel = availableModels?.find(m => m.name === 'doubao-seedream-4-0-250828');
    if (specificModel) {
      return specificModel;
    }
    const model = availableModels?.find(m => m.generationTypes.includes('text-to-image') || m.generationTypes.includes('image-to-image'));
    return model;
  }, [availableModels]);

  // 获取默认值
  const defaultModelSchema = useMemo(() => {
    return defaultModel?.paramsSchema?.properties as ImageJsonSchema;
  }, [defaultModel]);

  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState<string | undefined>(actionData?.selectedModel || defaultModel?.name);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | undefined>(
    actionData?.aspectRatio || (defaultModelSchema?.aspectRatio?.enum?.[0] as string),
  );
  const [selectedN, setSelectedN] = useState<string | undefined>(actionData?.n || (defaultModelSchema?.n?.enum?.[0] as string));
  const [advancedParams, setAdvancedParams] = useState<Record<string, any>>(actionData?.advancedParams || {});
  const fullscreenModalRef = useRef<fullscreenModalRef | null>(null);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as ImageJsonSchema;
  }, [selectedModel]);

  // 当默认模型加载完成且没有选中模型时，自动设置默认值
  useEffect(() => {
    if (defaultModel && !selectedModelName && !actionData?.selectedModel) {
      const schema = defaultModelSchema;
      setSelectedModelName(defaultModel.name);
      setSelectedAspectRatio((schema?.aspectRatio?.enum?.[0] as string) || '');
      setSelectedN((schema?.n?.enum?.[0] as string) || '');
      onValueChange?.({
        ...actionData,
        prompt: localPrompt,
        selectedModel: defaultModel.name,
        aspectRatio: (schema?.aspectRatio?.enum?.[0] as string) || '',
        n: (schema?.n?.enum?.[0] as string) || '',
        advancedParams: {},
      });
    }
  }, [defaultModel, defaultModelSchema, selectedModelName, actionData?.selectedModel]);

  const handleSelectModel = (v: string) => {
    setSelectedModelName(v);
    setAdvancedParams({});
    const schema = (availableModels?.find(model => model.name === v)?.paramsSchema?.properties as ImageJsonSchema) || {};
    onValueChange?.({
      ...actionData,
      prompt: localPrompt,
      selectedModel: v,
      aspectRatio: (schema.aspectRatio?.enum?.[0] as string) || '',
      n: (schema.n?.enum?.[0] as string) || '',
      advancedParams: {},
    });
  };

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
    if (actionData?.n !== undefined) {
      setSelectedN(actionData.n);
    }
  }, [actionData?.prompt, actionData?.selectedModel, actionData?.aspectRatio, actionData?.n]);

  const handleSubmit = async () => {
    onValueChange?.({
      ...actionData,
      prompt: localPrompt,
      selectedModel: selectedModelName,
      aspectRatio: selectedAspectRatio,
      n: selectedN,
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
        onSubmitSuccess?.({
          images: {
            list: [...(node.data.output?.images?.list || []), ...(result.data?.images || [])],
            selected: result.data?.images?.[0] || node.data.output?.images?.list?.[0] || '',
          },
        });
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
    onValueChange?.({
      ...actionData,
      prompt: newPrompt,
      selectedModel: selectedModelName,
      aspectRatio: selectedAspectRatio,
      n: selectedN,
      advancedParams,
    });
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
          <Select value={selectedModelName} onValueChange={handleSelectModel}>
            <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none" hideIcon>
              <SelectValue placeholder={tCommon('selectModel')}>{selectedModel?.displayName || ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('text-to-image') || model.generationTypes.includes('image-to-image'))
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
                  ...actionData,
                  prompt: localPrompt,
                  selectedModel: selectedModelName,
                  aspectRatio: v,
                  n: selectedN,
                  advancedParams,
                });
              }}
            >
              <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none" hideIcon>
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
        <div className="flex items-center justify-start gap-2">
          {selectedModelParamsSchema?.n?.enum?.length && (
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-muted cursor-pointer border-none p-2 font-mono text-xs"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                const enumValues = selectedModelParamsSchema.n.enum as string[];
                const currentIndex = selectedN ? enumValues.indexOf(selectedN) : -1;
                const nextIndex = (currentIndex + 1) % enumValues.length;
                const nextValue = enumValues[nextIndex];
                setSelectedN(nextValue);
                onValueChange?.({
                  ...actionData,
                  prompt: localPrompt,
                  selectedModel: selectedModelName,
                  aspectRatio: selectedAspectRatio,
                  n: nextValue,
                  advancedParams,
                });
              }}
            >
              {selectedN || selectedModelParamsSchema.n.enum[0]}x
            </Button>
          )}
          <Button onClick={handleSubmit} onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} className="cursor-pointer" size="icon">
            <WandSparkles />
          </Button>
        </div>
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
              ...actionData,
              prompt: localPrompt,
              selectedModel: selectedModelName,
              aspectRatio: selectedAspectRatio,
              n: selectedN,
              advancedParams: params,
            });
          }}
        />
      )}

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
    prevProps.value?.n === nextProps.value?.n &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
