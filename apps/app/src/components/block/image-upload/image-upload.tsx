'use client';

import { uploadVariants } from '@/components/ui/upload';
import { uploadFile, validateFile } from '@/lib/browser/file';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Upload, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

export interface ImageUploadProps {
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

export const ImageUpload = React.forwardRef<HTMLDivElement, ImageUploadProps>(
  (
    {
      value,
      onChange,
      accept = 'image/*',
      maxSize = 10 * 1024 * 1024, // 10MB
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

    const handleFileUpload = async (file: File) => {
      const error = validateFile(file, accept, maxSize);
      if (error) {
        toast.error(error);
        return;
      }

      setUploading(true);
      try {
        const key = await uploadFile(file, uploadPath);
        onChange?.(key);
        toast.success('文件上传成功');
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('文件上传失败');
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
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    };

    const handleClick = () => {
      if (!disabled) {
        fileInputRef.current?.click();
      }
    };

    const handleRemove = () => {
      onChange?.('');
    };

    const uploadState = uploading ? 'uploading' : dragOver ? 'dragOver' : 'default';

    return (
      <div ref={ref} className={cn('h-full w-full', className)}>
        {value ? (
          // 显示已上传文件的预览
          <div className="group relative flex h-full w-full cursor-pointer items-center justify-center" onClick={handleClick}>
            {value && (
              <div className="relative h-full w-full">
                <img src={`/api/oss/${value}`} alt="Uploaded file" className="h-full w-full rounded object-cover" />
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive absolute -top-2 -right-2 rounded-full p-1.5 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                  disabled={uploading}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {uploading && (
              <div className="bg-muted absolute right-2 bottom-2 left-2 h-1 overflow-hidden rounded-full">
                <div className="bg-primary h-1 animate-pulse rounded-full" />
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
              <motion.div
                className="relative z-10 flex items-center justify-center"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Upload className="text-primary h-6 w-6" />
              </motion.div>
            ) : (
              placeholder || (
                <div className="flex items-center justify-center">
                  <Upload className="text-muted-foreground group-hover:text-foreground h-6 w-6 transition-colors duration-200" />
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  },
);

ImageUpload.displayName = 'ImageUpload';
