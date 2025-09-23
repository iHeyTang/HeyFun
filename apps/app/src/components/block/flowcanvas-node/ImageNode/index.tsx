import { Camera, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageNodeActionData } from './processor';
import { ImageNodeTooltip, ImageNodeTooltipProps } from './tooltip';
import { useFlowGraph } from '@/components/block/flowcanvas';
import { useNodeStatusById } from '@/components/block/flowcanvas';
import { BaseNode } from '@/components/block/flowcanvas';
import { NodeData, NodeStatus } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';

interface ImageNodeProps {
  data: NodeData<ImageNodeActionData>;
  id: string;
}

export { ImageNodeProcessor } from './processor';

export default function ImageNode({ data, id }: ImageNodeProps) {
  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>(data.output?.images?.[0]?.url);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);

  const handleUploadFIle = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newImageUrl = data.output?.images?.[0]?.url;
    if (newImageUrl !== imageUrl) {
      console.log(`ImageNode ${id} - 检测到输出数据变化:`, {
        oldUrl: imageUrl,
        newUrl: newImageUrl,
        fullOutput: data.output,
        timestamp: new Date().toISOString(),
      });
      setImageUrl(newImageUrl);
      // 当图片URL变化时，设置为加载状态
      if (newImageUrl) {
        setIsImageLoading(true);
      }
    }
  }, [data.output, data.output?.images, id, imageUrl, data]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 处理图片加载完成
  const handleImageLoad = () => {
    setIsImageLoading(false);
  };

  // 处理图片加载错误
  const handleImageError = () => {
    setIsImageLoading(false);
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
      const url = await handleUploadFIle(file);
      flowGraph.updateNodeData(id, { output: { images: [{ url }] } });
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

  // 处理双击事件 - 全屏显示图像
  const handleDoubleClick = useCallback(() => {
    if (imageUrl) {
      setIsFullscreen(true);
    }
  }, [imageUrl]);

  // 关闭全屏
  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
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
          {(isImageLoading || status.status === NodeStatus.PROCESSING) && (
            <div className="bg-theme-background/50 absolute inset-0 z-10 flex items-center justify-center rounded backdrop-blur-sm">
              <div className="flex flex-col items-center">
                <Loader2 className="text-theme-chart-2 animate-spin" />
              </div>
            </div>
          )}
          {imageUrl ? (
            <img
              src={imageUrl}
              className="mx-auto block max-h-[200px] min-h-[100px] max-w-full cursor-pointer rounded object-contain"
              onLoad={handleImageLoad}
              onError={handleImageError}
              onDoubleClick={handleDoubleClick}
            />
          ) : (
            <div className="bg-theme-muted flex items-center justify-center rounded p-2 text-center transition-colors">
              {isUploading ? (
                <div className="text-theme-chart-2 flex flex-col items-center">
                  <div className="border-theme-border-primary border-t-theme-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
                  <div className="cursor-pointer text-left" onClick={handleFileSelect}>
                    1. Upload local image (up to 10MB)
                  </div>
                  <div className="text-theme-muted-foreground text-left" onClick={() => {}}>
                    2. Enter prompt to generate an image
                  </div>
                </div>
              )}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      </BaseNode>

      {/* 全屏模态窗口 */}
      {isFullscreen && imageUrl && <FullscreenModal imageUrl={imageUrl} onClose={handleCloseFullscreen} />}
    </>
  );
}

// 全屏模态窗口组件
function FullscreenModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return createPortal(
    <div className="bg-theme-background/90 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-full w-full items-center justify-center">
        <img
          src={imageUrl}
          className="h-auto max-h-full w-auto max-w-full rounded object-contain shadow-2xl"
          alt="Fullscreen image"
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        />
        <button
          className="bg-theme-muted/50 text-theme-foreground hover:bg-theme-muted/70 absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-colors"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
