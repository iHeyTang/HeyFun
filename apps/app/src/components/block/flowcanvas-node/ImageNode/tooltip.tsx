import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { MentionOptions } from '@tiptap/extension-mention';
import { Editor } from '@tiptap/react';
import { WandSparkles } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TiptapEditor, TiptapEditorRef } from '../../flowcanvas/components/SmartEditorNode';
import { MentionItem } from '../../flowcanvas/components/SmartEditorNode/MentionList';
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
  const { getSignedUrl } = useSignedUrl();
  const t = useTranslations('flowcanvas.nodeTooltips');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const editorRef = useRef<TiptapEditorRef>(null);
  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(actionData?.aspectRatio);
  const fullscreenModalRef = useRef<fullscreenModalRef | null>(null);

  // 获取节点输入数据
  const nodeInputs = useMemo(() => {
    return flowGraph.getPreNodesById(nodeId);
  }, [flowGraph, nodeId]);

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
      const inputAudios = await Promise.all(
        Array.from(input.entries()).map(async ([key, value]) => ({
          nodeId: key,
          audios: await Promise.all(
            value.audios?.map(async audio => {
              const url = await getSignedUrl(audio.key!);
              return { key: audio.key, url };
            }) || [],
          ),
        })),
      );

      const result = await processor.execute({
        input: { images: inputImages, texts: inputTexts, videos: inputVideos, audios: inputAudios, musics: [] },
        actionData: { ...node.data.actionData, prompt: editorRef.current?.getText() },
      });
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ images: [...(node.data.output?.images || []), ...(result.data?.images || [])] });
        onValueChange?.({ ...actionData, selectedKey: result.data?.images?.[0]?.key });
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

  // 创建插入项配置
  const insertItems: MentionOptions<MentionItem>['suggestion']['items'] = useCallback(
    (props: { query: string; editor: Editor }) => {
      const list: MentionItem[] = [];
      nodeInputs.forEach(input => {
        if (input.data.output?.images) {
          input.data.output.images.forEach(async (image, index) => {
            list.push({
              type: 'image' as const,
              id: `image:${image.key!}`,
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

  const handleMentionClick = useCallback(
    async (mentionId: string) => {
      const type = mentionId.split(':')[0];
      if (type === 'image') {
        const url = await getSignedUrl(mentionId.split(':')[1] || '');
        fullscreenModalRef.current?.show(url || '', 'image');
        return;
      }

      if (type === 'video') {
        const url = await getSignedUrl(mentionId.split(':')[1] || '');
        fullscreenModalRef.current?.show(url || '', 'video');
        return;
      }
    },
    [getSignedUrl],
  );

  return (
    <div className="flex min-w-[480px] flex-col gap-2 overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      <TiptapEditor
        value={localPrompt}
        onChange={handlePromptChange}
        placeholder={t('image.placeholder')}
        className="h-24 w-full resize-none border-none! outline-none!"
        mentionSuggestionItems={insertItems}
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
    prevProps.value?.selectedKey === nextProps.value?.selectedKey &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
