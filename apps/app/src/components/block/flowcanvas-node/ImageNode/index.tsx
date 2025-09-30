import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { ImagePreview } from '@/components/block/preview/image-preview';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageNodeActionData } from './processor';
import { ImageNodeTooltip, ImageNodeTooltipProps } from './tooltip';

interface ImageNodeProps {
  data: NodeData<ImageNodeActionData>;
  id: string;
}

export { ImageNodeProcessor } from './processor';

export default function ImageNode({ id, data }: ImageNodeProps) {
  const { getSignedUrl } = useSignedUrl();

  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [imageKey, setImageKey] = useState<string | undefined>(data.output?.images?.[0]?.key);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);

  const handleUploadFIle = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newImageKey = data.output?.images?.[0]?.key;
    if (newImageKey !== imageKey) {
      setImageKey(newImageKey);
    }
  }, [data.output, data.output?.images, id, imageKey, data]);

  // 将key转换为URL进行展示
  useEffect(() => {
    if (imageKey) {
      setIsImageLoading(true); // 开始获取URL时设置为加载状态
      getSignedUrl(imageKey)
        .then(url => {
          if (url) {
            setImageUrl(url);
          }
        })
        .catch(error => {
          console.error('Failed to get signed URL:', error);
          setIsImageLoading(false); // 获取URL失败时取消加载状态
        });
    } else {
      setImageUrl(undefined);
      setIsImageLoading(false); // 清空图片时取消加载状态
    }
  }, [imageKey]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
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

          {imageUrl ? (
            <ImagePreview
              src={imageUrl}
              alt="Node image"
              className="mx-auto block max-h-[200px] min-h-[100px] max-w-[200px] min-w-[100px] rounded object-contain"
              onLoad={() => setIsImageLoading(false)}
            />
          ) : (
            <div className="bg-muted flex items-center justify-center rounded p-2 text-center transition-colors">
              {isUploading ? (
                <div className="text-chart-2 flex flex-col items-center">
                  <div className="border-border-primary border-t-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
                  <div className="cursor-pointer text-left" onClick={handleFileSelect}>
                    1. Upload local image (up to 10MB)
                  </div>
                  <div className="text-muted-foreground text-left" onClick={() => {}}>
                    2. Enter prompt to generate an image
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
