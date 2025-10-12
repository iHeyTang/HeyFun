import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { TiptapEditor, TiptapEditorRef } from '@/components/block/flowcanvas/components/SmartEditorNode';
import { MentionItem } from '@/components/block/flowcanvas/components/SmartEditorNode/MentionList';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { T2aJsonSchema, Voice } from '@repo/llm/aigc';
import { MentionOptions } from '@tiptap/extension-mention';
import { Editor } from '@tiptap/react';
import { WandSparkles } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioNodeActionData, AudioNodeProcessor } from './processor';
import { getAigcVoiceList } from '@/actions/llm';
import { VoiceSelectorDialog, VoiceSelectorRef } from '@/components/features/voice-selector';
import { useTranslations } from 'next-intl';

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
  const editorRef = useRef<TiptapEditorRef>(null);
  const voiceSelectorRef = useRef<VoiceSelectorRef>(null);

  const [voiceList, setVoiceList] = useState<Voice[]>([]);

  // 获取节点输入数据
  const nodeInputs = useMemo(() => {
    return flowGraph.getPreNodesById(nodeId);
  }, [flowGraph, nodeId]);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const selectedVoice = useMemo(() => {
    return voiceList.find(voice => voice.id === selectedVoiceId);
  }, [voiceList, selectedVoiceId]);

  useEffect(() => {
    if (selectedModel && selectedModelName) {
      getAigcVoiceList({ provider: selectedModel.provider, modelName: selectedModelName }).then(res => {
        setVoiceList(res.data || []);
      });
    }
  }, [selectedModel, selectedModelName]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as T2aJsonSchema;
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

      const result = await processor.execute({
        input: { images: inputImages, texts: inputTexts, videos: inputVideos, audios: [], musics: [] },
        actionData: { ...node.data.actionData, prompt: editorRef.current?.getText() },
      });
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ audios: result.data?.audios });
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

  // 创建插入项配置
  const insertItems: MentionOptions<MentionItem>['suggestion']['items'] = useCallback(
    (props: { query: string; editor: Editor }) => {
      const list: MentionItem[] = [];
      nodeInputs.forEach(input => {
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
        placeholder={t('audio.placeholder')}
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
                voiceId: '',
              });
            }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder={tCommon('selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('text-to-speech'))
                .map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {voiceList.length > 0 && (
            <Button variant="outline" size="sm" className="justify-start p-4 text-xs font-normal" onClick={() => voiceSelectorRef.current?.open()}>
              <span>{selectedVoice?.name || tCommon('selectVoice')}</span>
            </Button>
          )}
        </div>
        {/* 右侧：提交按钮 */}
        <Button onClick={handleSubmit} onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} className="cursor-pointer" size="icon">
          <WandSparkles />
        </Button>
      </div>
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
