'use client';

import type { NoteWithRelations } from '@/actions/notes';
import { createNote, getNotes } from '@/actions/notes';
import { Button } from '@/components/ui/button';
import { useNotesCache } from '@/hooks/use-notes-cache';
import { Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { NoteCard } from './note-card';

export function NotesHome() {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const cache = useNotesCache();

  const [notes, setNotes] = useState<NoteWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 路由跳转选择笔记（同步 URL）
  const handleRouteNoteSelect = (noteId: string | null) => {
    if (!noteId) {
      router.push('/dashboard/notes');
      return;
    }
    router.push(`/dashboard/notes/${noteId}`);
  };

  // 加载笔记列表（带缓存）
  const loadNotes = useCallback(async () => {
    const queryParams = {
      search: searchQuery || undefined,
      page: 1,
      pageSize: 50,
    };
    const queryKey = cache.getQueryKey(queryParams);

    const cachedNotes = cache.getNotesList(queryKey);
    if (cachedNotes) {
      setNotes(cachedNotes);
      return;
    }

    try {
      const result = await getNotes(queryParams);
      if (result.error) throw new Error(result.error);
      if (result.data) {
        setNotes(result.data.notes);
        cache.setNotesList(queryKey, result.data.notes);
      }
    } catch (error: any) {
      console.error('加载笔记失败:', error);
      toast.error(error.message || t('toast.loadError'));
    }
  }, [searchQuery, cache, t]);

  // 初始加载
  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      await loadNotes();
      setLoading(false);
    };
    initLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 搜索变化时静默加载
  useEffect(() => {
    if (!loading) loadNotes();
  }, [loadNotes, loading]);

  // 创建新笔记
  const handleCreateNote = async () => {
    try {
      setIsCreating(true);
      const result = await createNote({
        title: t('untitled'),
        content: t('defaultContent'),
      });

      if (result.error) throw new Error(result.error);
      if (result.data) {
        toast.success(t('toast.createSuccess'));
        cache.clearNotesList();
        router.push(`/dashboard/notes/${result.data.id}`);
      }
    } catch (error: any) {
      console.error('创建笔记失败:', error);
      toast.error(error.message || t('toast.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{tCommon('loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-8">
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground/70 mt-2.5 text-sm">{t('description')}</p>
          </div>

          <Button
            onClick={handleCreateNote}
            disabled={isCreating}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? tCommon('creating') : t('newNote')}
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="mb-8">
        <div className="relative">
          <Search className="text-muted-foreground/50 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('list.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="border-border/50 bg-background/50 focus:ring-ring/20 w-full rounded-lg border px-10 py-2.5 text-sm transition-all focus:border-border focus:bg-background focus:outline-none focus:ring-2"
          />
        </div>
      </div>

      {/* 笔记列表 */}
      {notes.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border/50">
          <div className="text-center">
            <p className="text-muted-foreground/70 mb-4">{t('emptyState.title')}</p>
            <Button onClick={handleCreateNote} disabled={isCreating} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {t('emptyState.createFirst')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} onSelect={handleRouteNoteSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
