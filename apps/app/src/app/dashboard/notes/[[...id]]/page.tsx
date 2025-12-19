'use client';

import type { NoteWithRelations } from '@/actions/notes';
import { getNote } from '@/actions/notes';
import { NotesHome } from '@/components/features/notes/notes-home';
import { NoteEditorPanel } from '@/components/features/notes/note-editor-panel';
import { useNotesCache } from '@/hooks/use-notes-cache';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

function NotePage() {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();

  const routeNoteId = useMemo(() => {
    const id = params?.id;
    if (Array.isArray(id)) return id[0] || null;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }, [params]);

  const cache = useNotesCache();

  const [selectedNote, setSelectedNote] = useState<NoteWithRelations | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);

  // 路由变化时加载笔记（带缓存）
  useEffect(() => {
    const loadSelected = async () => {
      if (!routeNoteId) {
        setSelectedNote(null);
        return;
      }

      const cached = cache.getNote(routeNoteId);
      if (cached) {
        setSelectedNote(cached);
        return;
      }

      try {
        setLoadingNote(true);
        const result = await getNote({ noteId: routeNoteId });
        if (result.error) throw new Error(result.error);
        if (result.data) {
          setSelectedNote(result.data);
          cache.setNote(routeNoteId, result.data);
        }
      } catch (error: any) {
        console.error('加载笔记失败:', error);
        toast.error(error.message || t('detail.loadError'));
        router.push('/dashboard/notes');
      } finally {
        setLoadingNote(false);
      }
    };

    loadSelected();
  }, [routeNoteId, cache, router, t]);

  // 路由跳转选择笔记（同步 URL）
  // 仅用于 NoteEditorPanel 保存后刷新当前笔记
  const reloadNote = useCallback(
    async (noteId: string | null) => {
      if (!noteId) return;
      try {
        const result = await getNote({ noteId });
        if (result.error) throw new Error(result.error);
        if (result.data) {
          cache.setNote(noteId, result.data);
          setSelectedNote(result.data);
        }
      } catch (error: any) {
        console.error('刷新笔记失败:', error);
      }
    },
    [cache],
  );

  return loadingNote ? (
    <div className="flex h-full items-center justify-center">
      <div className="text-muted-foreground">{tCommon('loading')}</div>
    </div>
  ) : selectedNote ? (
    <NoteEditorPanel note={selectedNote} onNoteUpdate={reloadNote} />
  ) : (
    <NotesHome />
  );
}

export default NotePage;
