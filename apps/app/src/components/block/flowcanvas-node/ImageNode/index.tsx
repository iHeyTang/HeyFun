import { Camera, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageNodeActionData } from './processor';
import { ImageNodeTooltip, ImageNodeTooltipProps } from './tooltip';
import { useFlowGraph } from '@/components/block/flowcanvas';
import { useNodeStatusById } from '@/components/block/flowcanvas';
import { BaseNode } from '@/components/block/flowcanvas';
import { NodeData, NodeStatus } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';
import { ImagePreview } from '@/components/block/preview/image-preview';

interface ImageNodeProps {
  data: NodeData<ImageNodeActionData>;
  id: string;
}

export { ImageNodeProcessor } from './processor';

export default function ImageNode({ id, data }: ImageNodeProps) {
  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
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
          {imageUrl ? (
            <ImagePreview src={imageUrl} alt="Node image" className="mx-auto block max-h-[200px] min-h-[100px] max-w-full rounded object-contain" />
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
    </>
  );
}
