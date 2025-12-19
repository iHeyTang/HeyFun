'use client';

import { NotesTreeNode } from '@/actions/notes';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Loader2, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FolderInput } from './folder-input';

export type TreeNodeMoveRequest =
  | { type: 'folder'; folderId: string; name: string; currentParentId: string | null }
  | { type: 'note'; noteId: string; name: string; currentFolderId: string | null };

export interface TreeNodeItemProps {
  node: NotesTreeNode;
  level: number;
  isExpanded: boolean;
  isActive: boolean;
  mergeWithPrevActive?: boolean;
  mergeWithNextActive?: boolean;
  isDeleting: boolean;
  hasChildNodes: boolean;
  creatingFolderParentId: string | null | undefined;
  newFolderName: string;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  onToggleExpanded: (itemId: string, e?: React.MouseEvent) => void;
  onNoteSelect: (noteId: string) => void;
  onSetCreatingFolderParentId: (parentId: string | null) => void;
  onSetNewFolderName: (name: string) => void;
  onSetExpandedItems: (updater: (prev: Set<string>) => Set<string>) => void;
  onCreateNote: (parentId: string | null) => void;
  onDeleteFolder: (folderId: string, folderName: string, e: React.MouseEvent) => void;
  onDeleteNote: (noteId: string, e: React.MouseEvent) => void;
  onMoveRequest: (req: TreeNodeMoveRequest) => void;
  onCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  folderInputRef?: React.RefObject<HTMLInputElement | null>;
  renderChildren?: (children: NotesTreeNode[]) => React.ReactNode;
}

export function TreeNodeItem({
  node,
  level,
  isExpanded,
  isActive,
  mergeWithPrevActive,
  mergeWithNextActive,
  isDeleting,
  hasChildNodes,
  creatingFolderParentId,
  newFolderName,
  isCreatingFolder,
  isCreatingNote,
  onToggleExpanded,
  onNoteSelect,
  onSetCreatingFolderParentId,
  onSetNewFolderName,
  onSetExpandedItems,
  onCreateNote,
  onDeleteFolder,
  onDeleteNote,
  onMoveRequest,
  onCreateFolder,
  onCancelCreateFolder,
  folderInputRef,
  renderChildren,
}: TreeNodeItemProps) {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const itemId: string = node.type === 'folder' ? `folder-${node.id}` : `note-${node.id}`;
  const inputRef = folderInputRef;

  return (
    <div>
      <div
        className={cn(
          // 右侧菜单按钮使用 absolute 覆盖渲染，避免占用布局宽度（让标题尽可能"全宽"）
          'group relative flex cursor-pointer select-none items-center gap-1 rounded-md px-2 py-2 pr-8 transition-all',
          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground',
          isActive && mergeWithPrevActive && 'rounded-t-none',
          isActive && mergeWithNextActive && 'rounded-b-none',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (node.type === 'folder') {
            // 点击文件夹只展开/收起，不选中
            if (hasChildNodes) {
              onToggleExpanded(itemId);
            }
          } else {
            // 点击笔记时选中笔记
            onNoteSelect(node.id);
          }
        }}
      >
        <div className="flex h-4 w-4 items-center justify-center" onClick={e => hasChildNodes && onToggleExpanded(itemId, e)}>
          {hasChildNodes && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
        </div>
        {node.type === 'folder' ? (
          <>
            {isExpanded || !hasChildNodes ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0" />}
            <span className="flex-1 truncate text-sm">{node.name}</span>
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name || t('sidebar.untitled')}</span>
          </>
        )}
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={e => e.stopPropagation()}
                className="text-muted-foreground h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              {node.type === 'folder' ? (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      onSetNewFolderName(t('sidebar.newFolder'));
                      onSetCreatingFolderParentId(node.id);
                      // 确保文件夹展开以显示输入框
                      const folderItemId = `folder-${node.id}`;
                      onSetExpandedItems(prev => {
                        if (!prev.has(folderItemId)) {
                          return new Set(prev).add(folderItemId);
                        }
                        return prev;
                      });
                    }}
                    disabled={isCreatingFolder && creatingFolderParentId === node.id}
                  >
                    {isCreatingFolder && creatingFolderParentId === node.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {t('sidebar.newFolder')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateNote(node.id)} disabled={isCreatingNote}>
                    {isCreatingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    {t('sidebar.newNote')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onMoveRequest({
                        type: 'folder',
                        folderId: node.id,
                        name: node.name,
                        currentParentId: node.parentId || null,
                      })
                    }
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {t('sidebar.moveTo')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={e => onDeleteFolder(node.id, node.name, e)} disabled={isDeleting} variant="destructive">
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    {tCommon('delete')}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onCreateNote(node.note?.folderId || null)} disabled={isCreatingNote}>
                    {isCreatingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    {t('sidebar.newNote')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onMoveRequest({
                        type: 'note',
                        noteId: node.id,
                        name: node.name || t('sidebar.untitled'),
                        currentFolderId: node.note?.folderId || null,
                      })
                    }
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {t('sidebar.moveTo')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={e => onDeleteNote(node.id, e)} disabled={isDeleting} variant="destructive">
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    {tCommon('delete')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isExpanded && (
        <div>
          {/* 如果正在此文件夹下创建子文件夹，显示输入框 */}
          {node.type === 'folder' && creatingFolderParentId === node.id && inputRef && (
            <FolderInput
              ref={inputRef}
              value={newFolderName}
              onChange={onSetNewFolderName}
              onConfirm={onCreateFolder}
              onCancel={onCancelCreateFolder}
              level={level + 1}
              disabled={isCreatingFolder}
            />
          )}
          {hasChildNodes && renderChildren && <div>{renderChildren(node.children)}</div>}
        </div>
      )}
    </div>
  );
}
