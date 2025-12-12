import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageNodeActionData } from './processor';
import { ImageNodeTooltip, ImageNodeTooltipProps } from './tooltip';
import { ImagePreview } from './preview';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ImageNodeProps {
  data: NodeData<ImageNodeActionData>;
  id: string;
}

export { ImageNodeProcessor } from './processor';

export default function ImageNode({ id, data }: ImageNodeProps) {
  const t = useTranslations('flowcanvas.nodes');

  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);

  // 获取节点尺寸，使用 useMemo 确保尺寸变化时重新计算
  const node = flowGraph.getNodeById(id);
  const hasFixedSize = useMemo(() => {
    // 检查节点是否有明确的尺寸设置（包括通过 resize 设置的）
    const nodeWidth = node?.width ?? node?.style?.width;
    const nodeHeight = node?.height ?? node?.style?.height;
    // 只有当 width 和 height 都存在且都是数字时，才认为有固定尺寸
    // 这样可以确保 tooltip 基于正确的尺寸定位
    return typeof nodeWidth === 'number' && typeof nodeHeight === 'number' && nodeWidth > 0 && nodeHeight > 0;
  }, [node?.width, node?.height, node?.style?.width, node?.style?.height]);

  const handleUploadFIle = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

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
      flowGraph.updateNodeData(id, { output: { images: { list: [key, ...(data.output?.images?.list || [])], selected: key } } });
    } finally {
      setIsUploading(false);
    }
  };

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<ImageNodeTooltipProps['onValueChange']>>(newActionData => {
    flowGraph.updateNodeData(id, { actionData: newActionData });
  }, [flowGraph, id]);

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<ImageNodeTooltipProps['onSubmitSuccess']>>(output => {
    flowGraph.updateNodeData(id, { output });
  }, [flowGraph, id]);

  // 处理设置封面
  const handleSetCover = useCallback(
    (key: string) => {
      flowGraph.updateNodeData(id, { output: { ...data.output, images: { ...data.output?.images, selected: key } } });
    },
    [flowGraph, id, data.output],
  );

  // 处理图片加载，根据图片尺寸更新节点尺寸
  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      if (naturalWidth > 0 && naturalHeight > 0) {
        const ratio = naturalWidth / naturalHeight;
        setAspectRatio(ratio);

        // 如果节点还没有固定尺寸，根据图片尺寸设置节点尺寸
        if (!hasFixedSize) {
          const defaultWidth = 400;
          const defaultHeight = defaultWidth / ratio;

          flowGraph.reactFlowInstance.setNodes(nodes =>
            nodes.map(n => {
              if (n.id === id) {
                return {
                  ...n,
                  width: defaultWidth,
                  height: defaultHeight,
                  style: {
                    ...n.style,
                    width: defaultWidth,
                    height: defaultHeight,
                  },
                };
              }
              return n;
            }),
          );
        }
      }
    },
    [flowGraph, id, hasFixedSize],
  );

  // 当内容变化时，重置宽高比
  useEffect(() => {
    if (!data.output?.images?.list?.length) {
      setAspectRatio(undefined);
    }
  }, [data.output?.images?.list?.length, data.output?.images?.selected]);

  return (
    <BaseNode
      data={data}
      id={id}
      resizeConfig={{
        enabled: true,
        mode: 'aspectRatio',
        minWidth: 200,
        minHeight: 200,
        maxWidth: 1200,
        maxHeight: 1200,
        aspectRatio: aspectRatio,
      }}
      tooltip={
        <ImageNodeTooltip
          nodeId={id}
          value={data.actionData as ImageNodeActionData}
          onValueChange={handleActionDataChange}
          onSubmitSuccess={handleTooltipSubmit}
        />
      }
    >
      {status.status === NodeStatus.PROCESSING && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded">
          {/* 高斯模糊蒙版 */}
          <div className="bg-accent/20 absolute inset-0 rounded backdrop-blur-lg"></div>
          {/* Loading动画 */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        </div>
      )}

      {data.output?.images?.list?.length ? (
        <div
          className={cn('relative overflow-hidden', hasFixedSize ? 'h-full w-full' : 'h-fit w-fit')}
          style={hasFixedSize ? { width: '100%', height: '100%', minWidth: 0, minHeight: 0 } : undefined}
        >
          <ImagePreview
            images={data.output.images}
            className={cn('block rounded', hasFixedSize ? 'h-full w-full object-contain' : 'h-fit w-fit')}
            onSetCover={handleSetCover}
            onLoad={handleImageLoad}
          />
        </div>
      ) : (
        <div
          className={cn(
            'bg-muted flex items-center justify-center rounded p-2 text-center transition-colors',
            hasFixedSize ? 'h-full w-full' : 'h-fit w-fit',
          )}
          style={hasFixedSize ? { width: '100%', height: '100%' } : undefined}
        >
          {isUploading ? (
            <div className="text-chart-2 flex flex-col items-center">
              <div className="border-border-primary border-t-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
              <span>{t('uploading')}</span>
            </div>
          ) : (
            <div className="flex flex-col justify-center gap-1 space-y-1 p-4 text-sm">
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
    </BaseNode>
  );
}
