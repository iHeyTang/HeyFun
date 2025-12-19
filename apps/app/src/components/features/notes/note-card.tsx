'use client';

import type { NoteWithRelations } from '@/actions/notes';
import { Pin } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NoteCardProps {
  note: NoteWithRelations;
  onSelect?: (noteId: string) => void;
}

export function NoteCard({ note, onSelect }: NoteCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onSelect) {
      onSelect(note.id);
    } else {
      router.push(`/dashboard/notes/${note.id}`);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative flex h-full min-h-[160px] cursor-pointer flex-col rounded-lg border border-border/50 bg-card/50 p-5 transition-all duration-200 hover:border-border hover:bg-card/80 hover:shadow-sm"
    >
      {/* 置顶标识 */}
      {note.isPinned && (
        <div className="absolute right-4 top-4">
          <Pin className="h-3.5 w-3.5 text-muted-foreground/60" fill="currentColor" />
        </div>
      )}

      {/* 标题 */}
      <div className="mb-3 pr-6">
        <h3 className="line-clamp-2 text-base font-medium leading-snug text-foreground group-hover:text-foreground/90">
          {note.title}
        </h3>
      </div>

      {/* 内容预览 */}
      {note.contentText && (
        <div className="mb-4 flex-1">
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground/80">
            {note.contentText}
          </p>
        </div>
      )}

      {/* 底部信息 */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/30 pt-3">
        <span className="text-xs text-muted-foreground/60">{formatDate(note.updatedAt)}</span>
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.tags.slice(0, 3).map(tag => (
              <span
                key={tag.id}
                className="rounded-md bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground/70"
              >
                {tag.name}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-xs text-muted-foreground/50">+{note.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

