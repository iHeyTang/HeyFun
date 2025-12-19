'use client';

import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { updateNote } from '@/actions/notes';
import type { NoteWithRelations } from '@/actions/notes';
import dynamic from 'next/dynamic';

// 动态导入 WYSIWYG 编辑器组件（避免 SSR 问题）
const WysiwygEditor = dynamic(() => import('@/components/block/wysiwyg-editor').then(mod => mod.WysiwygEditor), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading...</div>,
});

interface NoteEditorPanelProps {
  note: NoteWithRelations;
  onNoteUpdate: (noteId: string | null) => void;
}

export function NoteEditorPanel({ note, onNoteUpdate }: NoteEditorPanelProps) {
  const t = useTranslations('notes');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [hasChanges, setHasChanges] = useState(false);

  // 当笔记变化时更新状态
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
    setHasChanges(false);
  }, [note]);

  // 检测变化
  useEffect(() => {
    const hasTitleChange = title !== note.title;
    const hasContentChange = content !== (note.content || '');
    setHasChanges(hasTitleChange || hasContentChange);
  }, [title, content, note]);

  // 保存笔记
  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateNote({
        noteId: note.id,
        title,
        content,
      });

      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        toast.success(t('detail.saveSuccess'));
        setHasChanges(false);
        // 重新加载笔记
        onNoteUpdate(note.id);
      }
    } catch (error: any) {
      console.error('保存笔记失败:', error);
      toast.error(error.message || t('detail.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* 编辑器区域 */}
      <div className="flex-1 overflow-hidden">
        {/* WYSIWYG 编辑器 - 所见即所得，不需要预览模式 */}
        <div className="h-full">
          <WysiwygEditor
            value={content}
            onChange={value => {
              setContent(value);
            }}
            placeholder={t('defaultContent')}
            className="h-full"
            autoFocus
            title={{
              value: title,
              onChange: setTitle,
              placeholder: t('detail.titlePlaceholder'),
            }}
            toolbarRightSlot={
              <Button onClick={handleSave} disabled={!hasChanges || saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                {saving ? t('detail.saving') : hasChanges ? t('detail.save') : t('detail.saved')}
              </Button>
            }
            noteId={note.id}
            onNoteUpdate={() => {
              // 重新加载笔记
              onNoteUpdate(note.id);
            }}
          />
        </div>
      </div>
    </div>
  );
}
