'use client';

import { useSessionAssets } from '@/hooks/use-session-assets';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Image as ImageIcon, Video, FileText, Download, Music, Code, File } from 'lucide-react';
import { ImagePreview } from '@/components/block/preview/image-preview';
import { VideoPreview } from '@/components/block/preview/video-preview';
import { PresentationPreview } from '@/components/block/preview/presentation-preview';
import { AudioPlayer } from '@/components/block/audio-player';
import { useState, useEffect } from 'react';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AssetsDialogProps {
  sessionId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getAssetIcon(type: string) {
  switch (type) {
    case 'image':
      return ImageIcon;
    case 'video':
      return Video;
    case 'audio':
      return Music;
    case 'document':
      return FileText;
    case 'code':
      return Code;
    case 'presentation':
      return FileText;
    default:
      return File;
  }
}

function getAssetTypeLabel(type: string) {
  switch (type) {
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'audio':
      return '音频';
    case 'document':
      return '文档';
    case 'code':
      return '代码';
    case 'presentation':
      return '演示文稿';
    default:
      return '其他';
  }
}

export function AssetsDialog({ sessionId, open, onOpenChange }: AssetsDialogProps) {
  const { data, isLoading, error } = useSessionAssets(sessionId, { enabled: open });
  const assets = data?.assets || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-[90%] flex-col">
        <DialogHeader>
          <DialogTitle>会话素材库</DialogTitle>
        </DialogHeader>

        <ScrollArea className="-mx-6 flex-1 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>加载素材列表失败</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <File className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>暂无素材</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 pb-4 lg:grid-cols-2">
              {assets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </ScrollArea>

        {assets.length > 0 && <div className="text-muted-foreground border-t pt-4 text-center text-xs">共 {data?.total || 0} 个素材</div>}
      </DialogContent>
    </Dialog>
  );
}

// 判断文件是否为 PDF
function isPdfFile(fileName?: string, mimeType?: string): boolean {
  if (!fileName && !mimeType) return false;
  const name = fileName || '';
  const mime = mimeType || '';
  return name.toLowerCase().endsWith('.pdf') || mime.toLowerCase().includes('application/pdf');
}

// PDF 下载卡片组件
function PdfDownloadCard({ pdfUrl, title, className }: { pdfUrl: string; title?: string; className?: string }) {
  const handleDownload = () => {
    window.open(pdfUrl, '_blank');
  };

  return (
    <div
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200/50 bg-gray-50/50 dark:border-gray-800/50 dark:bg-gray-900/50',
        className,
      )}
      onClick={handleDownload}
    >
      {/* PDF 缩略图预览 */}
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
          <FileText className="h-12 w-12" />
          <span className="text-xs font-medium">{title || 'PDF 文件'}</span>
          <span className="text-[10px] opacity-70">点击下载</span>
        </div>
      </div>

      {/* 悬停遮罩 */}
      <div
        className={cn(
          'absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/60 transition-opacity',
          'opacity-0 group-hover:opacity-100',
        )}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
          <Button variant="default" size="sm" onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-3 w-3" />
            下载 PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssetCard({ asset }: { asset: any }) {
  const typeLabel = getAssetTypeLabel(asset.type);
  const { getSignedUrl } = useSignedUrl();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const isPdf = asset.type === 'document' && isPdfFile(asset.fileName, asset.mimeType);

  // 获取文件 URL
  useEffect(() => {
    if (!fileUrl) {
      getSignedUrl(asset.fileKey)
        .then(url => setFileUrl(url || null))
        .catch(() => {
          // 忽略错误
        });
    }
  }, [asset.fileKey, fileUrl, getSignedUrl]);

  if (!fileUrl) {
    return (
      <div className="group relative overflow-hidden rounded-lg border">
        <div className="bg-muted relative flex aspect-[4/3] items-center justify-center">
          <Loader2 className="text-muted-foreground/50 h-6 w-6 animate-spin" />
        </div>
        <div className="p-3">
          <div className="mb-1 truncate text-sm font-medium">{asset.title || asset.fileName}</div>
          <div className="text-muted-foreground text-xs">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border transition-shadow hover:shadow-md">
      {/* 预览区域 */}
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        {asset.type === 'image' && (
          <ImagePreview src={fileUrl} alt={asset.title || asset.fileName} className="h-full w-full object-cover" width={300} height={200} />
        )}
        {asset.type === 'video' && <VideoPreview src={fileUrl} className="h-full w-full object-cover" autoPlayOnHover={false} />}
        {asset.type === 'presentation' && (
          <div className="relative h-full w-full overflow-hidden" style={{ pointerEvents: 'auto' }}>
            <PresentationPreview htmlUrl={fileUrl} title={asset.title || asset.fileName} className="h-full w-full border-0 bg-transparent p-0" />
          </div>
        )}
        {asset.type === 'audio' && <AudioPreviewCard src={fileUrl} fileName={asset.fileName} />}
        {isPdf && fileUrl && (
          <PdfDownloadCard pdfUrl={fileUrl} title={asset.title || asset.fileName} className="h-full w-full border-0 bg-transparent p-0" />
        )}
        {!['image', 'video', 'presentation', 'audio'].includes(asset.type) && !isPdf && (
          <div className="flex h-full items-center justify-center">
            {(() => {
              const Icon = getAssetIcon(asset.type);
              return <Icon className="text-muted-foreground/50 h-12 w-12" />;
            })()}
          </div>
        )}

        {/* 类型标签 */}
        <div className="absolute left-2 top-2 z-10">
          <span className="rounded bg-black/60 px-2 py-1 text-xs text-white">{typeLabel}</span>
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-3">
        <div className="mb-1 truncate text-sm font-medium">{asset.title || asset.fileName}</div>
        <div className="text-muted-foreground truncate text-xs">{asset.fileName}</div>
        {asset.description && <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{asset.description}</div>}
        <div className="text-muted-foreground mt-2 text-xs">{(asset.fileSize / 1024).toFixed(1)} KB</div>
      </div>
    </div>
  );
}

function AudioPreviewCard({ src, fileName }: { src: string; fileName: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-4">
      <div className="w-full max-w-md">
        <AudioPlayer src={src} className="w-full" />
      </div>
    </div>
  );
}
