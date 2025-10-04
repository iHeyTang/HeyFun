import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageNodeActionData } from './processor';
import { ImageNodeTooltip, ImageNodeTooltipProps } from './tooltip';
import { ImagePreview } from './preview';
import { useTranslations } from 'next-intl';

interface ImageNodeProps {
  data: NodeData<ImageNodeActionData>;
  id: string;
}

export { ImageNodeProcessor } from './processor';

export default function ImageNode({ id, data }: ImageNodeProps) {
  const { getSignedUrl } = useSignedUrl();
  const t = useTranslations('flowcanvas.nodes');

  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [images, setImages] = useState<{ key: string; url: string }[] | undefined>();
  const [imageKey, setImageKey] = useState<string | undefined>(data.output?.images?.[0]?.key);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);

  const handleUploadFIle = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

  useEffect(() => {
    const fetchImages = async () => {
      setIsImageLoading(true); // 开始获取URL时设置为加载状态
      const images = await Promise.all(data.output?.images?.map(async image => ({ key: image.key!, url: await getSignedUrl(image.key!) })) || []);
      setImages(images);
      setIsImageLoading(false); // 获取URL成功时取消加载状态
    };
    fetchImages();
  }, [data.output?.images, getSignedUrl]);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newImageKey =
      data.actionData?.selectedKey && data.output?.images?.some(image => image.key === data.actionData?.selectedKey)
        ? data.actionData?.selectedKey
        : data.output?.images?.[0]?.key;

    // 只有当新key与当前key不同时才更新
    if (newImageKey && newImageKey !== imageKey) {
      setImageKey(newImageKey);
    }
  }, [data.output?.images, data.actionData?.selectedKey, imageKey]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('selectImageFile'));
      return;
    }

    setIsUploading(true);

    try {
      const key = await handleUploadFIle(file);
      flowGraph.updateNodeData(id, { output: { images: [{ key }] } });
    } finally {
      setIsUploading(false);
    }
  };

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<ImageNodeTooltipProps['onValueChange']>>(newActionData => {
    flowGraph.updateNodeData(id, { actionData: newActionData });
  }, []);

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<ImageNodeTooltipProps['onSubmitSuccess']>>(output => {
    flowGraph.updateNodeData(id, { output });
  }, []);

  // 处理设置封面
  const handleSetCover = useCallback(
    (key: string) => {
      setImageKey(key);
      flowGraph.updateNodeData(id, { actionData: { ...data.actionData, selectedKey: key } });
    },
    [flowGraph, id, data.actionData],
  );

  return (
    <>
      <BaseNode
        data={data}
        id={id}
        tooltip={
          <ImageNodeTooltip
            nodeId={id}
            value={data.actionData as ImageNodeActionData}
            onValueChange={handleActionDataChange}
            onSubmitSuccess={handleTooltipSubmit}
          />
        }
      >
        <div className="relative">
          {(status.status === NodeStatus.PROCESSING || isImageLoading) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded">
              {/* 高斯模糊蒙版 */}
              <div className="bg-accent/20 absolute inset-0 rounded backdrop-blur-lg"></div>
              {/* Loading动画 */}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
              </div>
            </div>
          )}

          {images?.length ? (
            <ImagePreview
              coverKey={imageKey}
              images={images}
              className="mx-auto block max-h-[200px] min-h-[100px] max-w-[200px] min-w-[100px] rounded object-contain"
              onLoad={() => setIsImageLoading(false)}
              onSetCover={handleSetCover}
            />
          ) : (
            <div className="bg-muted flex items-center justify-center rounded p-2 text-center transition-colors">
              {isUploading ? (
                <div className="text-chart-2 flex flex-col items-center">
                  <div className="border-border-primary border-t-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
                  <span>{t('uploading')}</span>
                </div>
              ) : (
                <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
                  <div className="cursor-pointer text-left" onClick={handleFileSelect}>
                    1. {t('uploadImage')}
                  </div>
                  <div className="text-muted-foreground text-left" onClick={() => {}}>
                    2. {t('generateImage')}
                  </div>
                </div>
              )}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      </BaseNode>
    </>
  );
}
