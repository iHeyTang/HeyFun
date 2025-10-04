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
import { MusicNodeActionData, MusicNodeProcessor } from './processor';
import { MusicJsonSchema } from '@repo/llm/aigc';
import { useTranslations } from 'next-intl';

export interface MusicNodeTooltipProps {
  nodeId: string;
  value?: MusicNodeActionData;
  onValueChange?: (data: MusicNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new MusicNodeProcessor();

const MusicNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: MusicNodeTooltipProps) => {
  const { getSignedUrl } = useSignedUrl();
  const t = useTranslations('flowcanvas.nodeTooltips.music');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localLyrics, setLocalLyrics] = useState(actionData?.lyrics || '');
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const lyricsEditorRef = useRef<TiptapEditorRef>(null);
  const promptEditorRef = useRef<TiptapEditorRef>(null);

  // 获取节点输入数据
  const nodeInputs = useMemo(() => {
    return flowGraph.getPreNodesById(nodeId);
  }, [flowGraph, nodeId]);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  const selectedModelParamsSchema = useMemo(() => {
    return selectedModel?.paramsSchema?.properties as MusicJsonSchema;
  }, [selectedModel]);

  // 当外部值改变时同步本地状态
  useEffect(() => {
    if (actionData?.lyrics !== undefined) {
      setLocalLyrics(actionData.lyrics);
    }
    if (actionData?.prompt !== undefined) {
      setLocalPrompt(actionData.prompt);
    }
    if (actionData?.selectedModel !== undefined) {
      setSelectedModelName(actionData.selectedModel);
    }
  }, [actionData?.lyrics, actionData?.prompt, actionData?.selectedModel]);

  const handleSubmit = async () => {
    onValueChange?.({
      lyrics: localLyrics,
      prompt: localPrompt,
      selectedModel: selectedModelName,
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
        input: { images: inputImages, texts: inputTexts, videos: inputVideos, audios: [], musics: [] },
        actionData: {
          ...node.data.actionData,
          lyrics: lyricsEditorRef.current?.getText(),
          prompt: promptEditorRef.current?.getText(),
        },
      });
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ musics: result.data?.musics });
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
      {/* 歌词输入框 */}
      {selectedModelParamsSchema?.lyrics.type === 'string' && (
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">{tCommon('lyrics')}</label>
          <TiptapEditor
            value={localLyrics}
            onChange={handleLyricsChange}
            placeholder={t('lyricsPlaceholder')}
            className="h-32 w-full resize-none border-none! outline-none!"
            mentionSuggestionItems={insertItems}
            ref={lyricsEditorRef}
          />
        </div>
      )}
      {/* 提示词输入框 */}
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">{tCommon('prompt')}</label>
        <TiptapEditor
          value={localPrompt}
          onChange={handlePromptChange}
          placeholder={t('promptPlaceholder')}
          className="h-24 w-full resize-none border-none! outline-none!"
          mentionSuggestionItems={insertItems}
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
              onValueChange?.({
                lyrics: localLyrics,
                prompt: localPrompt,
                selectedModel: v,
              });
            }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder={tCommon('selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('music'))
                .map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
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
export const MusicNodeTooltip = memo(MusicNodeTooltipComponent, (prevProps, nextProps) => {
  return (
    prevProps.value?.lyrics === nextProps.value?.lyrics &&
    prevProps.value?.prompt === nextProps.value?.prompt &&
    prevProps.value?.selectedModel === nextProps.value?.selectedModel &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
