import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { FlowCanvasTextEditor, FlowCanvasTextEditorRef } from '@/components/block/flowcanvas/components/FlowCanvasTextEditor';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc, useAigcVoiceList } from '@/hooks/use-llm';
import { T2aJsonSchema, Voice } from '@repo/llm/aigc';
import { Loader2, WandSparkles } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AudioNodeActionData, AudioNodeProcessor } from './processor';
import { VoiceSelectorDialog, VoiceSelectorRef } from '@/components/features/voice-selector';
import { useTranslations } from 'next-intl';
import { AdvancedOptionsForm } from '../AdvancedOptionsForm';

export interface AudioNodeTooltipProps {
  nodeId: string;
  value?: AudioNodeActionData;
  onValueChange?: (data: AudioNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new AudioNodeProcessor();

const AudioNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: AudioNodeTooltipProps) => {
  const t = useTranslations('flowcanvas.nodeTooltips');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedVoiceId, setSelectedVoiceId] = useState(actionData?.voiceId);
  const [advancedParams, setAdvancedParams] = useState<Record<string, any>>(actionData?.advancedParams || {});
  const editorRef = useRef<FlowCanvasTextEditorRef>(null);
  const voiceSelectorRef = useRef<VoiceSelectorRef>(null);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const { voiceList, initiate: initiateVoiceList } = useAigcVoiceList(selectedModel?.provider || '', selectedModelName || '');

  const selectedVoice = useMemo(() => {
    return voiceList.find(voice => voice.id === selectedVoiceId);
  }, [voiceList, selectedVoiceId]);

  useEffect(() => {
    if (selectedModel && selectedModelName) {
      initiateVoiceList();
    }
  }, [selectedModel, selectedModelName, initiateVoiceList]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as T2aJsonSchema | undefined;
  }, [selectedModel]);

  // 当外部值改变时同步本地状态
  useEffect(() => {
    if (actionData?.prompt !== undefined) {
      setLocalPrompt(actionData.prompt);
    }
    if (actionData?.selectedModel !== undefined) {
      setSelectedModelName(actionData.selectedModel);
    }
    if (actionData?.voiceId !== undefined) {
      setSelectedVoiceId(actionData.voiceId);
    }
  }, [actionData?.prompt, actionData?.selectedModel, actionData?.voiceId]);

  const handleSubmit = async () => {
    onValueChange?.({
      prompt: localPrompt,
      selectedModel: selectedModelName,
      voiceId: selectedVoiceId,
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
        onSubmitSuccess?.({ audios: { list: result.data?.audios || [], selected: result.data?.audios?.[0] || '' } });
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
      voiceId: selectedVoiceId,
    });
  };

  return (
    <div className="nodrag flex flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      <FlowCanvasTextEditor
        value={localPrompt}
        onChange={handlePromptChange}
        placeholder={t('audio.placeholder')}
        className="h-24 w-full resize-none border-none! outline-none!"
        nodeId={nodeId}
        ref={editorRef}
      />

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
                voiceId: '',
                advancedParams: {},
              });
            }}
          >
            <SelectTrigger size="sm" className="hover:bg-muted cursor-pointer border-none p-2 text-xs shadow-none" hideIcon>
              <SelectValue placeholder={tCommon('selectModel')}>{selectedModel?.displayName || ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('text-to-speech'))
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
          {selectedModelParamsSchema?.voice_id?.type === 'string' && (
            <Button
              variant="outline"
              size="sm"
              className="hover:bg-muted text-muted-foreground cursor-pointer justify-start border-none p-2 text-xs font-normal shadow-none"
              onClick={() => voiceSelectorRef.current?.open()}
            >
              {voiceList.length > 0 ? <span>{selectedVoice?.name || tCommon('selectVoice')}</span> : <Loader2 className="h-4 w-4 animate-spin" />}
            </Button>
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
            onValueChange?.({ prompt: localPrompt, selectedModel: selectedModelName, voiceId: selectedVoiceId, advancedParams: params });
          }}
        />
      )}

      <VoiceSelectorDialog
        ref={voiceSelectorRef}
        value={selectedVoiceId}
        voices={voiceList}
        onChange={voiceId => {
          setSelectedVoiceId(voiceId);
          onValueChange?.({ prompt: localPrompt, selectedModel: selectedModelName, voiceId: voiceId });
        }}
      />
    </div>
  );
};

// 使用 memo 优化组件，只有当初始值真正改变时才重新渲染
export const AudioNodeTooltip = memo(AudioNodeTooltipComponent, (prevProps, nextProps) => {
  // 现在只需要比较初始值，因为我们不会在输入过程中触发外部更新
  return (
    prevProps.value?.prompt === nextProps.value?.prompt &&
    prevProps.value?.selectedModel === nextProps.value?.selectedModel &&
    prevProps.value?.voiceId === nextProps.value?.voiceId &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
