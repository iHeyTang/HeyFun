import { getSignedUrl } from '@/actions/oss';
import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { VideoPreview } from '@/components/block/preview/video-preview';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { LipsyncNodeActionData } from './processor';
import { LipsyncNodeTooltip, LipsyncNodeTooltipProps } from './tooltip';
import { useTranslations } from 'next-intl';

interface LipsyncNodeProps {
  data: NodeData<LipsyncNodeActionData>;
  id: string;
}

export { LipsyncNodeProcessor } from './processor';

export default function LipsyncNode({ data, id }: LipsyncNodeProps) {
  const t = useTranslations('flowcanvas.nodes');

  const flowGraph = useFlowGraph();
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [videoKey, setVideoKey] = useState<string | undefined>(data.output?.videos?.[0]?.key);
  const status = useNodeStatusById(id);

  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newVideoKey = data.output?.videos?.[0]?.key;
    if (newVideoKey !== videoKey) {
      console.log(`LipsyncNode ${id} - 检测到输出数据变化:`, {
        oldKey: videoKey,
        newKey: newVideoKey,
        fullOutput: data.output,
        timestamp: new Date().toISOString(),
      });
      setVideoKey(newVideoKey);
    }
  }, [data.output, data.output?.videos, id, videoKey, data]);

  // 将key转换为URL进行展示
  useEffect(() => {
    if (videoKey) {
      setIsVideoLoading(true);
      getSignedUrl({ fileKey: videoKey })
        .then(result => {
          if (result.data) {
            setVideoUrl(result.data);
          }
        })
        .catch(error => {
          console.error('Failed to get signed URL:', error);
        })
        .finally(() => {
          setIsVideoLoading(false);
        });
    } else {
      setVideoUrl(undefined);
      setIsVideoLoading(false);
    }
  }, [videoKey]);

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<LipsyncNodeTooltipProps['onValueChange']>>(newActionData => {
    flowGraph.updateNodeData(id, { actionData: newActionData });
  }, []);

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<LipsyncNodeTooltipProps['onSubmitSuccess']>>(output => {
    flowGraph.updateNodeData(id, { output });
  }, []);

  // 获取输入的视频和音频信息用于显示
  const inputInfo = useCallback(() => {
    const inputs = flowGraph.getNodeInputsById(id);
    const videoCount = Array.from(inputs.values()).reduce((sum, node) => sum + (node.videos?.length || 0), 0);
    const audioCount = Array.from(inputs.values()).reduce((sum, node) => sum + (node.audios?.length || 0), 0);
    return { videoCount, audioCount };
  }, [flowGraph, id]);

  const { videoCount, audioCount } = inputInfo();

  return (
    <>
      <BaseNode
        data={data}
        id={id}
        tooltip={
          <LipsyncNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />
        }
      >
        <div className="relative">
          {(status.status === NodeStatus.PROCESSING || isVideoLoading) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded">
              {/* 高斯模糊蒙版 */}
              <div className="bg-accent/20 absolute inset-0 rounded backdrop-blur-lg"></div>
              {/* Loading动画 */}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
              </div>
            </div>
          )}

          {videoUrl ? (
            <VideoPreview
              src={videoUrl}
              autoPlayOnHover={true}
              className="bg-muted max-h-[200px] w-full rounded"
              loop
              onLoad={() => setIsVideoLoading(false)}
            />
          ) : (
            <div className="bg-muted flex items-center justify-center rounded p-2 text-center transition-colors">
              <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
                <div className="text-muted-foreground text-left">{t('connectInput')}</div>
                <div className="text-left text-xs">
                  {t('videoInput')} {videoCount > 0 ? t('connected', { count: videoCount }) : t('notConnected')}
                </div>
                <div className="text-left text-xs">
                  {t('audioInput')} {audioCount > 0 ? t('connected', { count: audioCount }) : t('notConnected')}
                </div>
                <div className="text-muted-foreground text-left text-xs">
                  {videoCount > 0 && audioCount > 0 ? t('startLipsync') : t('pleaseConnectInputs')}
                </div>
              </div>
            </div>
          )}
        </div>
      </BaseNode>
    </>
  );
}
