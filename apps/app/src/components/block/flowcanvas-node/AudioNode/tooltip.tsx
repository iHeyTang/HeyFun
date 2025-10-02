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

export interface AudioNodeTooltipProps {
  nodeId: string;
  value?: AudioNodeActionData;
  onValueChange?: (data: AudioNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new AudioNodeProcessor();

const AudioNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: AudioNodeTooltipProps) => {
  const { getSignedUrl } = useSignedUrl();

  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedVoiceId, setSelectedVoiceId] = useState(actionData?.voiceId);
  const editorRef = useRef<TiptapEditorRef>(null);

  const [voiceList, setVoiceList] = useState<Voice[]>([]);

  useEffect(() => {
    if (selectedModelName) {
      getAigcVoiceList({ modelName: selectedModelName }).then(res => {
        setVoiceList(res.data || []);
      });
    }
  }, [selectedModelName]);

  // 获取节点输入数据
  const nodeInputs = useMemo(() => {
    return flowGraph.getPreNodesById(nodeId);
  }, [flowGraph, nodeId]);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

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
      const inputImages = await Promise.all(
        Array.from(input.entries()).map(async ([key, value]) => ({
          nodeId: key,
          images: await Promise.all(
            value.images?.map(async img => {
              const url = await getSignedUrl(img.key!);
              return { key: img.key, url };
            }) || [],
          ),
        })),
      );
      const inputVideos = await Promise.all(
        Array.from(input.entries()).map(async ([key, value]) => ({
          nodeId: key,
          videos: await Promise.all(
            value.videos?.map(async img => {
              const url = await getSignedUrl(img.key!);
              return { key: img.key, url };
            }) || [],
          ),
        })),
      );

      const result = await processor.execute({
        input: { images: inputImages, texts: inputTexts, videos: inputVideos, audios: [] },
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
        placeholder="Enter text to generate audio, input @ to mention"
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
              <SelectValue placeholder="Select a model" />
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
            <Select
              value={selectedVoiceId}
              onValueChange={(v: string) => {
                setSelectedVoiceId(v);
                onValueChange?.({
                  prompt: localPrompt,
                  selectedModel: selectedModelName,
                  voiceId: v,
                });
              }}
            >
              <SelectTrigger size="sm" className="text-xs" hideIcon>
                <SelectValue placeholder="Voice" />
              </SelectTrigger>
              <SelectContent>
                {voiceList.map(option => {
                  return (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
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
