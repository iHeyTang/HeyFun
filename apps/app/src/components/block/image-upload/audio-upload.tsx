'use client';

import { uploadVariants } from '@/components/ui/upload';
import { uploadFile, validateFile } from '@/lib/browser/file';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Music, X, Mic, Square } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

export interface AudioUploadProps {
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
  enableRecording?: boolean; // 是否启用录音功能
  maxRecordingDuration?: number; // 最大录音时长（秒）
}

export const AudioUpload = React.forwardRef<HTMLDivElement, AudioUploadProps>(
  (
    {
      value,
      onChange,
      accept = 'audio/*',
      maxSize = 50 * 1024 * 1024, // 50MB
      uploadPath = 'paintboard',
      disabled = false,
      className,
      size = 'default',
      variant = 'default',
      showPreview = true,
      placeholder,
      enableRecording = false,
      maxRecordingDuration = 300, // 默认最大录音 5 分钟
    },
    ref,
  ) => {
    const [dragOver, setDragOver] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [recording, setRecording] = React.useState(false);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const mediaStreamRef = React.useRef<MediaStream | null>(null);

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
        toast.success('Audio uploaded successfully');
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('Audio upload failed');
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

    // 停止录音
    const stopRecording = React.useCallback(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      setRecording(false);
      setRecordingTime(0);
    }, []);

    // 开始录音
    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

          // 上传录制的音频
          await handleFileUpload(audioFile);
        };

        mediaRecorder.start();
        setRecording(true);
        setRecordingTime(0);

        // 开始计时
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime(prev => {
            const newTime = prev + 1;
            if (newTime >= maxRecordingDuration) {
              // 使用 setTimeout 避免在 setState 回调中调用其他 setState
              setTimeout(() => stopRecording(), 0);
            }
            return newTime;
          });
        }, 1000);

        toast.success('开始录音');
      } catch (error) {
        console.error('录音启动失败:', error);
        toast.error('无法访问麦克风，请检查权限设置');
      }
    };

    // 切换录音状态
    const handleRecordingToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    };

    // 格式化录音时间
    const formatRecordingTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 清理录音资源
    React.useEffect(() => {
      return () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
      };
    }, []);

    const uploadState = uploading ? 'uploading' : dragOver ? 'dragOver' : disabled ? null : 'default';

    return (
      <div ref={ref} className={cn('relative w-full', className)}>
        {value ? (
          // 显示音频预览
          <div className="relative w-full rounded border p-4">
            <audio
              src={`/api/oss/${value}`}
              controls
              className="w-full"
              onError={() => {
                toast.error('Audio loading failed');
              }}
            >
              Your browser does not support audio playback
            </audio>
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
              'min-h-[100px]',
              recording && 'border-red-500 bg-red-50/5',
            )}
            onClick={uploading || recording ? undefined : handleClick}
            onDragOver={uploading || recording ? undefined : handleDragOver}
            onDragLeave={uploading || recording ? undefined : handleDragLeave}
            onDrop={uploading || recording ? undefined : handleDrop}
            role="button"
            tabIndex={disabled || uploading || recording ? -1 : 0}
            aria-disabled={disabled || uploading || recording}
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

            {/* 录音动画 */}
            {recording && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-red-500/10 to-red-500/5"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
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
                <p className="text-muted-foreground text-sm">上传中...</p>
              </motion.div>
            ) : recording ? (
              <motion.div className="z-10 flex flex-col items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <Mic className="h-8 w-8 text-red-500" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-medium text-red-500">录音中...</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatRecordingTime(recordingTime)} / {formatRecordingTime(maxRecordingDuration)}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="z-10 flex flex-col items-center gap-2 px-4 py-6">
                {placeholder || (
                  <>
                    <Music className="text-muted-foreground h-8 w-8" />
                    <div className="text-center">
                      <p className="text-sm">拖放音频文件或点击上传</p>
                      <p className="text-muted-foreground mt-1 text-xs">最大支持 {Math.floor(maxSize / 1024 / 1024)}MB</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 录音按钮 */}
            {enableRecording && !uploading && (
              <div className="absolute right-3 bottom-3">
                <motion.button
                  onClick={handleRecordingToggle}
                  disabled={disabled}
                  className={cn(
                    'hover:bg-accent bg-background focus-visible:ring-ring flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                    recording && 'border-red-500 bg-red-50 hover:bg-red-100',
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {recording ? <Square className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

AudioUpload.displayName = 'AudioUpload';
