import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { FlowCanvasTextEditor, FlowCanvasTextEditorRef } from '@/components/block/flowcanvas/components/FlowCanvasTextEditor';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { WandSparkles } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { MusicNodeActionData, MusicNodeProcessor } from './processor';
import { MusicJsonSchema } from '@/llm/aigc';
import { useTranslations } from 'next-intl';
import { AdvancedOptionsForm } from '../AdvancedOptionsForm';

export interface MusicNodeTooltipProps {
  nodeId: string;
  value?: MusicNodeActionData;
  onValueChange?: (data: MusicNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new MusicNodeProcessor();

const MusicNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: MusicNodeTooltipProps) => {
  const t = useTranslations('flowcanvas.nodeTooltips.music');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localLyrics, setLocalLyrics] = useState(actionData?.lyrics || '');
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [advancedParams, setAdvancedParams] = useState<Record<string, any>>(actionData?.advancedParams || {});
  const lyricsEditorRef = useRef<FlowCanvasTextEditorRef>(null);
  const promptEditorRef = useRef<FlowCanvasTextEditorRef>(null);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as MusicJsonSchema;
  }, [selectedModel]);

  // 当外部值改变时同步本地状态
  useEffect(() => {
    // 使用 requestAnimationFrame 避免同步 setState
    requestAnimationFrame(() => {
      if (actionData?.lyrics !== undefined) {
        setLocalLyrics(actionData.lyrics);
      }
      if (actionData?.prompt !== undefined) {
        setLocalPrompt(actionData.prompt);
      }
      if (actionData?.selectedModel !== undefined) {
        setSelectedModelName(actionData.selectedModel);
      }
    });
  }, [actionData?.lyrics, actionData?.prompt, actionData?.selectedModel]);

  const handleSubmit = async () => {
    onValueChange?.({
      lyrics: localLyrics,
      prompt: localPrompt,
      selectedModel: selectedModelName,
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
        actionData: {
          ...node.data.actionData,
          lyrics: lyricsEditorRef.current?.getText(),
          prompt: promptEditorRef.current?.getText(),
          advancedParams,
        },
      });
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ musics: { list: result.data?.musics || [], selected: result.data?.musics?.[0] || '' } });
      } else {
        updateStatus(NodeStatus.FAILED, { error: result.error });
      }
    } catch (error: any) {
      console.error(error);
      updateStatus(NodeStatus.FAILED, { error: error?.message || error });
    }
  };

  const handleLyricsChange = (newLyrics: string) => {
    setLocalLyrics(newLyrics);
    onValueChange?.({
      lyrics: newLyrics,
      prompt: localPrompt,
      selectedModel: selectedModelName,
    });
  };

  const handlePromptChange = (newPrompt: string) => {
    setLocalPrompt(newPrompt);
    onValueChange?.({
      lyrics: localLyrics,
      prompt: newPrompt,
      selectedModel: selectedModelName,
    });
  };

  return (
    <div className="nodrag flex flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 歌词输入框 */}
      {selectedModelParamsSchema?.lyrics.type === 'string' && (
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">{tCommon('lyrics')}</label>
          <FlowCanvasTextEditor
            value={localLyrics}
            onChange={handleLyricsChange}
            placeholder={t('lyricsPlaceholder')}
            className="border-none! outline-none! h-32 w-full resize-none"
            nodeId={nodeId}
            ref={lyricsEditorRef}
          />
        </div>
      )}
      {/* 提示词输入框 */}
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">{tCommon('prompt')}</label>
        <FlowCanvasTextEditor
          value={localPrompt}
          onChange={handlePromptChange}
          placeholder={t('promptPlaceholder')}
          className="border-none! outline-none! h-24 w-full resize-none"
          nodeId={nodeId}
          ref={promptEditorRef}
        />
      </div>

      {/* Footer - 模型选择和提交按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center justify-start gap-2">
          {/* 左侧：模型选择 */}
          <Select
            value={selectedModelName}
            onValueChange={(v: string) => {
              setSelectedModelName(v);
              setAdvancedParams({});
              onValueChange?.({
                lyrics: localLyrics,
                prompt: localPrompt,
                selectedModel: v,
                advancedParams: {},
              });
            }}
          >
            <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none">
              <SelectValue placeholder={tCommon('selectModel')}>{selectedModel?.displayName || ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('music'))
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
            onValueChange?.({ lyrics: localLyrics, prompt: localPrompt, selectedModel: selectedModelName, advancedParams: params });
          }}
        />
      )}
    </div>
  );
};

// 使用 memo 优化组件，只有当初始值真正改变时才重新渲染
export const MusicNodeTooltip = memo(MusicNodeTooltipComponent, (prevProps, nextProps) => {
  return (
    prevProps.value?.lyrics === nextProps.value?.lyrics &&
    prevProps.value?.prompt === nextProps.value?.prompt &&
    prevProps.value?.selectedModel === nextProps.value?.selectedModel &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
