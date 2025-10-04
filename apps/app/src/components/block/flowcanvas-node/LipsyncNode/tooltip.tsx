import { NodeOutput, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAigc } from '@/hooks/use-llm';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { WandSparkles } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { LipsyncNodeActionData, LipsyncNodeProcessor } from './processor';
import { useTranslations } from 'next-intl';

export interface LipsyncNodeTooltipProps {
  nodeId: string;
  value?: LipsyncNodeActionData;
  onValueChange?: (data: LipsyncNodeActionData) => void;
  onSubmitSuccess?: (data: NodeOutput) => void;
}

const processor = new LipsyncNodeProcessor();

const LipsyncNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: LipsyncNodeTooltipProps) => {
  const { getSignedUrl } = useSignedUrl();
  const t = useTranslations('flowcanvas.nodeTooltips.lipsync');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const flowGraph = useFlowGraph();
  const { availableModels } = useAigc();
  const { updateStatus } = useNodeStatusById(nodeId);
  const [selectedModelName, setSelectedModelName] = useState(actionData?.selectedModel);

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => model.name === selectedModelName);
  }, [availableModels, selectedModelName]);

  // 当外部值改变时同步本地状态
  useEffect(() => {
    if (actionData?.selectedModel !== undefined) {
      setSelectedModelName(actionData.selectedModel);
    }
  }, [actionData?.selectedModel]);

  // 获取输入的视频和音频
  const inputInfo = useMemo(() => {
    const inputs = flowGraph.getNodeInputsById(nodeId);
    const videos = Array.from(inputs.values())
      .map(node => node.videos || [])
      .flat();
    const audios = Array.from(inputs.values())
      .map(node => node.audios || [])
      .flat();
    return {
      hasVideo: videos.length > 0,
      hasAudio: audios.length > 0,
      videoCount: videos.length,
      audioCount: audios.length,
    };
  }, [flowGraph, nodeId]);

  const handleSubmit = async () => {
    if (!inputInfo.hasVideo || !inputInfo.hasAudio) {
      alert('请先连接视频和音频输入');
      return;
    }

    if (!selectedModelName) {
      alert('请选择模型');
      return;
    }

    onValueChange?.({
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
            value.videos?.map(async video => {
              const url = await getSignedUrl(video.key!);
              return { key: video.key, url };
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
        actionData: node.data.actionData,
      });
      if (result.success) {
        updateStatus(NodeStatus.COMPLETED);
        onSubmitSuccess?.({ videos: result.data?.videos });
      } else {
        updateStatus(NodeStatus.FAILED);
        alert(result.error || t('failed'));
      }
    } catch (error: any) {
      console.error(error);
      updateStatus(NodeStatus.FAILED, { error: error?.message || error });
      alert(error?.message || t('failed'));
    }
  };

  return (
    <div className="nodrag flex min-w-[480px] flex-col gap-4 overflow-hidden rounded-lg p-4">
      {/* 输入信息提示 */}
      <div className="border-border text-muted-foreground rounded border p-3 text-sm">
        <div className="mb-2 font-medium">{t('inputStatus')}</div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span>{t('videoInput')}</span>
            <span className={inputInfo.hasVideo ? 'text-green-500' : 'text-red-500'}>
              {inputInfo.hasVideo ? `✓ ${inputInfo.videoCount} ${t('items')}` : t('notConnected')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('audioInput')}</span>
            <span className={inputInfo.hasAudio ? 'text-green-500' : 'text-red-500'}>
              {inputInfo.hasAudio ? `✓ ${inputInfo.audioCount} ${t('items')}` : t('notConnected')}
            </span>
          </div>
        </div>
      </div>

      {/* 模型选择和提交按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center justify-start gap-2">
          {/* 模型选择 */}
          <Select
            value={selectedModelName}
            onValueChange={(v: string) => {
              setSelectedModelName(v);
              onValueChange?.({
                selectedModel: v,
              });
            }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder={t('selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {availableModels
                ?.filter(model => model.generationTypes.includes('lip-sync'))
                .map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {/* 提交按钮 */}
        <Button
          onClick={handleSubmit}
          onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
          className="cursor-pointer"
          size="icon"
          disabled={!inputInfo.hasVideo || !inputInfo.hasAudio || !selectedModelName}
        >
          <WandSparkles />
        </Button>
      </div>
    </div>
  );
};

// 使用 memo 优化组件，只有当初始值真正改变时才重新渲染
export const LipsyncNodeTooltip = memo(LipsyncNodeTooltipComponent, (prevProps, nextProps) => {
  return (
    prevProps.value?.selectedModel === nextProps.value?.selectedModel &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
