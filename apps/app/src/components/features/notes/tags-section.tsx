'use client';

import { Tag, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TagWithStats } from '@/actions/notes';

export interface TagsSectionProps {
  tags: TagWithStats[];
  selectedTagIds?: string[];
  onTagToggle?: (tagId: string) => void;
  onCreateTag: (name: string) => Promise<void>;
  onDeleteTag: (tagId: string, tagName: string) => void;
  isCreatingTag: boolean;
}

export function TagsSection({ tags, selectedTagIds = [], onTagToggle, onCreateTag, onDeleteTag, isCreatingTag }: TagsSectionProps) {
  const t = useTranslations('notes');
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setShowTagInput(false);
      return;
    }

    await onCreateTag(newTagName.trim());
    setNewTagName('');
    setShowTagInput(false);
  };

  return (
    <div className="border-border/50 flex-shrink-0 border-t">
      <div className="p-3">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-muted-foreground select-none text-xs font-normal">{t('sidebar.tags')}</h3>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
            onClick={() => {
              setShowTagInput(true);
              setNewTagName('');
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {/* 创建标签输入框 */}
        {showTagInput && (
          <div className="mb-2 flex gap-1">
            <input
              type="text"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleCreateTag();
                } else if (e.key === 'Escape') {
                  setShowTagInput(false);
                  setNewTagName('');
                }
              }}
              placeholder={t('sidebar.tagNamePlaceholder')}
              className="border-input bg-background focus:ring-ring flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1"
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={handleCreateTag} disabled={isCreatingTag || !newTagName.trim()}>
              {t('sidebar.create')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowTagInput(false);
                setNewTagName('');
              }}
            >
              {t('sidebar.cancel')}
            </Button>
          </div>
        )}

        <div className="max-h-[200px] space-y-0.5 overflow-y-auto">
          {tags.length === 0 ? (
            <p className="text-muted-foreground px-2.5 py-2 text-xs">{t('sidebar.noTags')}</p>
          ) : (
            tags.map(tag => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <div
                  key={tag.id}
                  className={`group flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-all ${
                    isSelected ? 'bg-primary/5 text-foreground' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                  }`}
                  onClick={() => onTagToggle?.(tag.id)}
                >
                  <div className="flex flex-1 items-center gap-2">
                    <Tag className="h-4 w-4" style={{ color: tag.color || undefined }} />
                    <span className="flex-1 truncate">{tag.name}</span>
                    <span className="text-muted-foreground/60 shrink-0 text-xs">({tag.noteCount || 0})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-5 opacity-0 transition-all hover:bg-transparent group-hover:opacity-100"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteTag(tag.id, tag.name);
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

