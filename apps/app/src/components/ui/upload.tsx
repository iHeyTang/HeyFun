'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Upload, X, File, Image, FileText, Music, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

const uploadVariants = cva(
  'relative flex flex-col items-center justify-center rounded border border-dashed transition-all duration-300 ease-in-out cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted/50 hover:border-border hover:bg-muted',
        primary: 'border-primary bg-primary/5 hover:border-primary hover:bg-primary/10',
        destructive: 'border-destructive bg-destructive/5 hover:border-destructive hover:bg-destructive/10',
      },
      size: {
        sm: 'min-h-[100px] p-4',
        default: 'min-h-[140px] p-6',
        lg: 'min-h-[180px] p-8',
      },
      state: {
        default: '',
        dragOver: 'border-primary bg-primary/10 scale-[1.02] shadow-lg',
        uploading: 'border-primary bg-primary/5',
        error: 'border-destructive bg-destructive/5',
        success: 'border-theme-success bg-theme-success-bg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      state: 'default',
    },
  },
);

const fileItemVariants = cva(
  'flex items-center gap-4 rounded-lg border bg-card p-4 transition-all duration-200 ease-in-out hover:shadow-md hover:scale-[1.01] group',
  {
    variants: {
      status: {
        pending: 'border-border',
        uploading: 'border-primary bg-primary/5',
        success: 'border-theme-success bg-theme-success-bg',
        error: 'border-destructive bg-destructive/5',
      },
    },
    defaultVariants: {
      status: 'pending',
    },
  },
);

export interface FileWithPreview {
  id: string;
  file: File;
  preview?: string;
  status?: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

export interface UploadProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'>,
    VariantProps<typeof uploadVariants> {
  asChild?: boolean;
  multiple?: boolean;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  value?: FileWithPreview[];
  onChange?: (files: FileWithPreview[]) => void;
  onUpload?: (files: FileWithPreview[]) => Promise<void>;
  showPreview?: boolean;
  showProgress?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  renderFile?: (file: FileWithPreview, removeFile: (id: string) => void) => React.ReactNode;
}

const getFileIcon = (file: File) => {
  const type = file.type;
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('video/')) return Video;
  if (type.startsWith('audio/')) return Music;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const UploadComponent = React.forwardRef<HTMLDivElement, UploadProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      multiple = false,
      accept,
      maxSize,
      maxFiles,
      value = [],
      onChange,
      onUpload,
      showPreview = true,
      showProgress = true,
      disabled = false,
      children,
      renderFile,
      ...props
    },
    ref,
  ) => {
    const [dragOver, setDragOver] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [files, setFiles] = React.useState<FileWithPreview[]>(value);

    React.useEffect(() => {
      setFiles(value);
    }, [value]);

    // 监听files状态变化，通知父组件
    React.useEffect(() => {
      onChange?.(files);
    }, [files, onChange]);

    const generateFileId = () => Math.random().toString(36).substr(2, 9);

    const createFileWithPreview = async (file: File): Promise<FileWithPreview> => {
      const fileWithPreview: FileWithPreview = {
        id: generateFileId(),
        file: file,
        status: 'pending' as const,
        progress: 0,
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }

      return fileWithPreview;
    };

    const validateFile = (file: File): string | null => {
      if (maxSize && file.size > maxSize) {
        return `文件大小不能超过 ${formatFileSize(maxSize)}`;
      }
      if (accept) {
        const acceptedTypes = accept.split(',').map(type => type.trim());
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const mimeType = file.type;

        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            return fileExtension === type;
          }
          return mimeType.match(type.replace('*', '.*'));
        });

        if (!isAccepted) {
          return `不支持的文件类型: ${file.type}`;
        }
      }
      return null;
    };

    const handleFiles = async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: FileWithPreview[] = [];
      const errors: string[] = [];

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
          continue;
        }

        if (maxFiles && files.length + validFiles.length >= maxFiles) {
          errors.push(`最多只能上传 ${maxFiles} 个文件`);
          break;
        }

        const fileWithPreview = await createFileWithPreview(file);
        validFiles.push(fileWithPreview);
      }

      if (errors.length > 0) {
        console.warn('文件验证错误:', errors);
      }

      if (validFiles.length > 0) {
        const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
        setFiles(updatedFiles);

        // 自动上传新添加的文件
        if (onUpload) {
          await uploadFiles(validFiles);
        }
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

    const removeFile = (fileId: string) => {
      const updatedFiles = files.filter(file => file.id !== fileId);
      setFiles(updatedFiles);
    };

    const uploadFiles = async (filesToUpload?: FileWithPreview[]) => {
      if (!onUpload) return;

      const targetFiles = filesToUpload || files;
      if (targetFiles.length === 0) return;

      setUploading(true);

      // 只更新需要上传的文件状态
      const updatedFiles = targetFiles.map(fileWithPreview => ({
        ...fileWithPreview,
        status: 'uploading' as const,
        progress: 0,
      }));

      // 更新文件状态 - 使用函数式更新确保获取最新状态
      setFiles(currentFiles => {
        const newFilesState = currentFiles.map(file => {
          const updatedFile = updatedFiles.find(uf => uf.id === file.id);
          return updatedFile || file;
        });
        return newFilesState;
      });

      try {
        await onUpload(updatedFiles);

        const successFiles = updatedFiles.map(fileWithPreview => ({
          ...fileWithPreview,
          status: 'success' as const,
          progress: 100,
        }));

        // 更新成功状态 - 使用函数式更新确保获取最新状态
        setFiles(currentFiles => {
          const finalFilesState = currentFiles.map(file => {
            const successFile = successFiles.find(sf => sf.id === file.id);
            return successFile || file;
          });
          return finalFilesState;
        });
      } catch (error) {
        const errorFiles = updatedFiles.map(fileWithPreview => ({
          ...fileWithPreview,
          status: 'error' as const,
          error: error instanceof Error ? error.message : '上传失败',
        }));

        // 更新错误状态 - 使用函数式更新确保获取最新状态
        setFiles(currentFiles => {
          const errorFilesState = currentFiles.map(file => {
            const errorFile = errorFiles.find(ef => ef.id === file.id);
            return errorFile || file;
          });
          return errorFilesState;
        });
      } finally {
        setUploading(false);
      }
    };

    const Comp = asChild ? Slot : 'div';

    const uploadState = uploading ? 'uploading' : dragOver ? 'dragOver' : 'default';

    // 单文件模式：如果有文件且不是多文件模式，显示文件预览替换占位符
    const shouldShowFilePreview = !multiple && files.length > 0;
    const currentFile = shouldShowFilePreview ? files[0] : null;

    return (
      <div ref={ref} className={cn('space-y-4', className)}>
        {shouldShowFilePreview && currentFile ? (
          // 单文件模式：显示文件预览（无边框）
          renderFile ? (
            <div onClick={handleClick} className="cursor-pointer">
              {renderFile(currentFile, removeFile)}
            </div>
          ) : (
            <div className="group relative flex h-full w-full cursor-pointer items-center justify-center" onClick={handleClick}>
              {currentFile.file.type.startsWith('image/') && currentFile.preview ? (
                <div className="relative">
                  <img src={currentFile.preview} alt={currentFile.file.name} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      removeFile(currentFile.id);
                    }}
                    className="absolute -top-2 -right-2 rounded-full bg-theme-destructive p-1.5 text-theme-destructive-foreground opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110 hover:bg-theme-destructive"
                    disabled={currentFile.status === 'uploading'}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-xl shadow-sm">
                  {React.createElement(getFileIcon(currentFile.file), {
                    className: 'text-muted-foreground h-8 w-8',
                  })}
                </div>
              )}

              {currentFile.status === 'uploading' && showProgress && (
                <div className="bg-muted absolute right-2 bottom-2 left-2 h-1 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-1 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${currentFile.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          )
        ) : (
          // 默认上传占位符（有边框）
          <Comp
            className={cn(uploadVariants({ variant, size, state: uploadState }))}
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
              multiple={multiple}
              accept={accept}
              onChange={handleFileInputChange}
              className="hidden"
              disabled={disabled}
              {...props}
            />

            {children || (
              <div className="flex h-16 w-16 items-center justify-center">
                <Upload className="text-muted-foreground group-hover:text-foreground h-6 w-6 transition-colors duration-200" />
              </div>
            )}
          </Comp>
        )}

        {showPreview && files.length > 0 && multiple && (
          <div className="space-y-3">
            {files.map(fileWithPreview => {
              return renderFile ? (
                <div key={fileWithPreview.id}>{renderFile(fileWithPreview, removeFile)}</div>
              ) : (
                <div key={fileWithPreview.id} className={cn(fileItemVariants({ status: fileWithPreview.status }))}>
                  <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg shadow-sm">
                    {React.createElement(getFileIcon(fileWithPreview.file), {
                      className: 'text-muted-foreground h-6 w-6',
                    })}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-card-foreground truncate text-sm font-semibold">{fileWithPreview.file.name}</p>

                    {fileWithPreview.status === 'uploading' && showProgress && (
                      <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${fileWithPreview.progress || 0}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {fileWithPreview.preview && fileWithPreview.file.type.startsWith('image/') && (
                    <div className="relative overflow-hidden rounded-lg shadow-sm">
                      <img src={fileWithPreview.preview} alt={fileWithPreview.file.name} className="h-12 w-12 object-cover" />
                    </div>
                  )}

                  <button
                    onClick={() => removeFile(fileWithPreview.id)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-1.5 transition-all duration-200 hover:scale-110"
                    disabled={fileWithPreview.status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

UploadComponent.displayName = 'Upload';

export { UploadComponent as Upload, uploadVariants, fileItemVariants };
