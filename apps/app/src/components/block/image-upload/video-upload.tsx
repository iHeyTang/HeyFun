'use client';

import { uploadVariants } from '@/components/ui/upload';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { uploadFile, validateFile } from '@/lib/browser/file';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Upload, X, Play } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

export interface VideoUploadProps {
  value?: string; // 上传后的文件URL
  onChange?: (url: string) => void; // 当URL变化时回调
  accept?: string;
  maxSize?: number; // in bytes
  uploadPath?: string; // 上传路径，默认为 'paintboard'
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'primary' | 'destructive';
  showPreview?: boolean;
  placeholder?: React.ReactNode;
}

export const VideoUpload = React.forwardRef<HTMLDivElement, VideoUploadProps>(
  (
    {
      value,
      onChange,
      accept = 'video/*',
      maxSize = 100 * 1024 * 1024, // 100MB
      uploadPath = 'paintboard',
      disabled = false,
      className,
      size = 'default',
      variant = 'default',
      showPreview = true,
      placeholder,
    },
    ref,
  ) => {
    const [dragOver, setDragOver] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const { getSignedUrl } = useSignedUrl();

    const handleFileUpload = async (file: File) => {
      const error = validateFile(file, accept, maxSize);
      if (error) {
        toast.error(error);
        return;
      }

      setUploading(true);
      try {
        const key = await uploadFile(file, uploadPath);
        const url = await getSignedUrl(key);
        onChange?.(url);
        toast.success('Video uploaded successfully');
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('Video upload failed');
      } finally {
        setUploading(false);
      }
    };

    const handleFiles = async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      if (fileArray.length > 0 && fileArray[0]) {
        await handleFileUpload(fileArray[0]); // 只处理第一个文件
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setDragOver(true);
      }
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!disabled && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    };

    const handleClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    };

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.('');
    };

    const uploadState = uploading ? 'uploading' : dragOver ? 'dragOver' : disabled ? null : 'default';

    return (
      <div ref={ref} className={cn('relative w-full', className)}>
        {value ? (
          // 显示视频预览
          <div className="relative w-full">
            <video
              src={value}
              controls
              className="h-auto max-h-[300px] w-full rounded border object-contain"
              onError={() => {
                toast.error('Video loading failed');
              }}
            >
              Your browser does not support video playback
            </video>
            {!disabled && (
              <div
                className="bg-background/80 hover:bg-background absolute top-2 right-2 cursor-pointer rounded-full p-1 backdrop-blur-sm transition-colors"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </div>
            )}
          </div>
        ) : (
          // 显示上传占位符
          <div
            className={cn(
              'group focus-visible:ring-ring relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed transition-all duration-300 ease-in-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
              uploadVariants({ variant, state: uploadState })
                .split(' ')
                .filter(cls => !cls.includes('min-h') && !cls.includes('p-'))
                .join(' '),
              'min-h-[120px]',
            )}
            onClick={uploading ? undefined : handleClick}
            onDragOver={uploading ? undefined : handleDragOver}
            onDragLeave={uploading ? undefined : handleDragLeave}
            onDrop={uploading ? undefined : handleDrop}
            role="button"
            tabIndex={disabled || uploading ? -1 : 0}
            aria-disabled={disabled || uploading}
          >
            <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileInputChange} className="hidden" disabled={disabled} />

            {/* 简洁的进度指示器 */}
            {uploading && (
              <motion.div
                className="via-primary/5 absolute inset-0 bg-gradient-to-r from-transparent to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* 内容层 */}
            {uploading ? (
              <motion.div className="z-10 flex flex-col items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
                <p className="text-muted-foreground text-sm">Uploading...</p>
              </motion.div>
            ) : (
              <div className="z-10 flex flex-col items-center gap-2 px-4 py-6">
                {placeholder || (
                  <>
                    <Play className="text-muted-foreground h-8 w-8" />
                    <div className="text-center">
                      <p className="text-sm">Drop video file or click to upload</p>
                      <p className="text-muted-foreground mt-1 text-xs">Max 100MB supported</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

VideoUpload.displayName = 'VideoUpload';
