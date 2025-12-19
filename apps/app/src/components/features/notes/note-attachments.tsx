'use client';

import { Button } from '@/components/ui/button';
import { Paperclip, X, Download, File } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { uploadFile, validateFile, formatFileSize } from '@/lib/browser/file';
import { addAttachmentToNote, deleteAttachment, getNoteAttachments } from '@/actions/notes';
import type { NoteAttachments } from '@prisma/client';
import { getSignedUrl } from '@/actions/oss';

interface NoteAttachmentsProps {
  noteId: string;
  organizationId: string;
}

export function NoteAttachments({ noteId, organizationId }: NoteAttachmentsProps) {
  const t = useTranslations('notes.attachment');
  const tCommon = useTranslations('common');
  const [attachments, setAttachments] = useState<NoteAttachments[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载附件列表
  const loadAttachments = async () => {
    try {
      const result = await getNoteAttachments({ noteId });
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        setAttachments(result.data);
      }
    } catch (error: any) {
      console.error('加载附件失败:', error);
      toast.error(error.message || t('loadError'));
    }
  };

  // 初始化时加载附件
  useEffect(() => {
    if (noteId) {
      loadAttachments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件
    const maxSize = 50 * 1024 * 1024; // 50MB
    const validationError = validateFile(file, undefined, maxSize);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploading(true);
    try {
      // 上传文件到 OSS
      const fileKey = await uploadFile(file, 'notes/attachments');

      // 添加到数据库
      const result = await addAttachmentToNote({
        noteId,
        fileKey,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success(t('uploadSuccess'));
      await loadAttachments();
    } catch (error: any) {
      console.error('上传附件失败:', error);
      toast.error(error.message || t('uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除附件
  const handleDeleteAttachment = async (attachmentId: string, fileName: string) => {
    if (!confirm(t('deleteConfirm', { name: fileName }))) {
      return;
    }

    try {
      const result = await deleteAttachment({ attachmentId });
      if (result.error) {
        throw new Error(result.error);
      }
      toast.success(t('deleteSuccess'));
      await loadAttachments();
    } catch (error: any) {
      console.error('删除附件失败:', error);
      toast.error(error.message || t('deleteError'));
    }
  };

  // 下载附件
  const handleDownloadAttachment = async (attachment: NoteAttachments) => {
    try {
      const result = await getSignedUrl({ fileKey: attachment.fileKey });
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        window.open(result.data, '_blank');
      }
    } catch (error: any) {
      console.error('获取下载链接失败:', error);
      toast.error(error.message || t('downloadError'));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t('title')}</h4>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Paperclip className="mr-2 h-4 w-4" />
          {uploading ? t('uploading') : t('add')}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      </div>

      {attachments.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('noAttachments')}</p>
      ) : (
        <div className="space-y-1">
          {attachments.map(attachment => (
            <div key={attachment.id} className="bg-muted/30 group flex items-center justify-between rounded border px-3 py-2 text-sm">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <File className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="truncate">{attachment.fileName}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{formatFileSize(attachment.fileSize)}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDownloadAttachment(attachment)}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteAttachment(attachment.id, attachment.fileName)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
