'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Plus, Upload, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { uploadFile, validateFile } from './utils';

export interface MultiImageUploadProps {
  value?: string[]; // 上传后的文件URL数组
  onChange?: (urls: string[]) => void; // 当URL数组变化时回调
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number; // 最大文件数量
  uploadPath?: string; // 上传路径，默认为 'paintboard'
  disabled?: boolean;
  className?: string;
  placeholder?: React.ReactNode;
  gridCols?: number; // 网格列数
  itemSize?: 'sm' | 'default' | 'lg'; // 单个图片项的大小
  itemClassName?: string; // 单个图片项的类名
}

export const MultiImageUpload = React.forwardRef<HTMLDivElement, MultiImageUploadProps>(
  (
    {
      value = [],
      onChange,
      accept = 'image/*',
      maxSize = 10 * 1024 * 1024, // 10MB
      maxFiles = 10,
      uploadPath = 'paintboard',
      disabled = false,
      className,
      placeholder,
      gridCols = 4,
      itemSize = 'default',
      itemClassName,
    },
    ref,
  ) => {
    const [dragOver, setDragOver] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [uploadingFiles, setUploadingFiles] = React.useState<Set<string>>(new Set());
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileUpload = async (file: File): Promise<string> => {
      const error = validateFile(file, accept, maxSize);
      if (error) {
        throw new Error(error);
      }

      const fileId = `${file.name}-${Date.now()}`;
      setUploadingFiles(prev => new Set(prev).add(fileId));

      try {
        const url = await uploadFile(file, uploadPath);
        return url;
      } finally {
        setUploadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(fileId);
          return newSet;
        });
      }
    };

    const handleFiles = async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);

      if (fileArray.length === 0) return;

      // 检查文件数量限制
      if (value.length + fileArray.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} images`);
        return;
      }

      setUploading(true);
      const newUrls: string[] = [];
      const errors: string[] = [];

      // 并发上传所有文件
      const uploadPromises = fileArray.map(async file => {
        try {
          const url = await handleFileUpload(file);
          newUrls.push(url);
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
        }
      });

      await Promise.all(uploadPromises);

      if (errors.length > 0) {
        toast.error(`Some files upload failed: ${errors.join(', ')}`);
      }

      if (newUrls.length > 0) {
        const updatedUrls = [...value, ...newUrls];
        onChange?.(updatedUrls);
        toast.success(`Successfully uploaded ${newUrls.length} images`);
      }

      setUploading(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && value.length < maxFiles) {
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
      if (!disabled && value.length < maxFiles) {
        fileInputRef.current?.click();
      }
    };

    const handleRemove = (index: number) => {
      const updatedUrls = value.filter((_, i) => i !== index);
      onChange?.(updatedUrls);
    };

    const defaultItemClassName = 'group relative flex-shrink-0 h-22 w-22';

    const canAddMore = value.length < maxFiles && !disabled;

    return (
      <div ref={ref} className={cn('w-full', className)}>
        <div className="flex flex-wrap gap-2">
          {/* 已上传的图片 */}
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className={cn(defaultItemClassName, 'w-fit', itemClassName)}>
              <div className="border-border bg-muted/50 overflow relative h-full w-full">
                <img src={url} alt={`Uploaded image ${index + 1}`} className="h-full w-full rounded-md object-cover" />

                {/* 删除按钮 */}
                <button
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 cursor-pointer rounded-full bg-red-500 p-1 text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110 hover:bg-red-500"
                  disabled={uploading}
                >
                  <X className="h-2 w-2" />
                </button>

                {/* 上传进度指示器 */}
                {uploadingFiles.has(`${url}-${index}`) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <motion.div
                      className="h-6 w-6 rounded-full border-2 border-white border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 添加上传按钮 */}
          {canAddMore && (
            <div className={cn(defaultItemClassName, itemClassName)}>
              <div
                className={cn(
                  'focus-visible:ring-ring relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed transition-all duration-300 ease-in-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  dragOver ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg' : 'border-border bg-muted/50 hover:border-border hover:bg-muted',
                  uploading && 'border-primary bg-primary/5',
                )}
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                  disabled={disabled}
                />

                {/* 上传进度动画 */}
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
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Plus className="text-muted-foreground group-hover:text-foreground h-6 w-6 transition-colors duration-200" />
                      <span className="text-muted-foreground group-hover:text-foreground text-xs transition-colors duration-200">Add image</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* 状态提示 */}
        <div className="text-muted-foreground mt-2 text-sm">
          {value.length === 0 && !uploading && <span>Drag or click to upload image</span>}
          {value.length > 0 && (
            <span>
              Uploaded {value.length}/{maxFiles} images
            </span>
          )}
          {uploading && <span>Uploading...</span>}
        </div>
      </div>
    );
  },
);

MultiImageUpload.displayName = 'MultiImageUpload';
