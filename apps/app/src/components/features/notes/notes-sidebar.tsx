'use client';

import type { NotesTreeNode, TagWithStats } from '@/actions/notes';
import { createFolder, createNote, createTag, deleteFolder, deleteNote, deleteTag, getNotesTree, getTags, updateFolder, updateNote } from '@/actions/notes';
import { ConfirmDialog, confirm } from '@/components/block/confirm';
import { MoveToFolderDialog, mapDialogValueToFolderId, mapFolderIdToDialogValue } from '@/components/features/notes/move-to-folder-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNotesCache } from '@/hooks/use-notes-cache';
import { FileText, Home, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FolderInput } from './folder-input';
import { TagsSection } from './tags-section';
import { TreeNodeItem, type TreeNodeMoveRequest } from './tree-node-item';

interface NotesSidebarProps {
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string | null) => void;
  // Optional: keep for future filtering; not required for current UX
  selectedFolderId?: string | null;
  selectedTagIds?: string[];
  onTagToggle?: (tagId: string) => void;
}

export function NotesSidebar({ selectedNoteId, onNoteSelect, selectedFolderId, selectedTagIds = [], onTagToggle }: NotesSidebarProps) {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const cache = useNotesCache();
  const [tags, setTags] = useState<TagWithStats[]>([]);
  const [tree, setTree] = useState<NotesTreeNode[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<string | null | undefined>(undefined);
  const [moveRequest, setMoveRequest] = useState<TreeNodeMoveRequest | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveToValue, setMoveToValue] = useState<string>('__root__');
  const previousTreeRef = useRef<string[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isCreatingRootFolder = creatingFolderParentId === null && newFolderName !== '';

  // 根据当前选中的 note，推导其所属文件夹（用于高亮“当前目录”）
  const derivedFolderId = useMemo((): string | null => {
    if (!selectedNoteId) return null;
    const stack: NotesTreeNode[] = [...tree];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.type === 'note' && n.id === selectedNoteId) {
        return n.parentId || n.note?.folderId || null;
      }
      if (n.children?.length) stack.push(...n.children);
    }
    return null;
  }, [tree, selectedNoteId]);

  const effectiveSelectedFolderId = selectedFolderId === undefined ? derivedFolderId : selectedFolderId;

  const folderOptions = useMemo(() => {
    const out: Array<{ id: string; name: string; depth: number }> = [];
    const walk = (nodes: NotesTreeNode[], depth: number) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          out.push({ id: n.id, name: n.name, depth });
          if (n.children?.length) walk(n.children, depth + 1);
        }
      }
    };
    walk(tree, 0);
    return out;
  }, [tree]);

  const collectDescendantFolderIds = useCallback(
    (folderId: string): Set<string> => {
    const descendants = new Set<string>();
    const walk = (nodes: NotesTreeNode[]) => {
      for (const n of nodes) {
        if (n.type !== 'folder') continue;
        if (n.id === folderId) {
          const collect = (children: NotesTreeNode[]) => {
            for (const c of children) {
              if (c.type === 'folder') {
                descendants.add(c.id);
                if (c.children?.length) collect(c.children);
              }
            }
          };
          collect(n.children || []);
          return true;
        }
        if (n.children?.length && walk(n.children)) return true;
      }
      return false;
    };
    walk(tree);
    return descendants;
    },
    [tree],
  );

  const moveFolderOptions = useMemo(() => {
    if (!moveRequest) return folderOptions;
    if (moveRequest.type !== 'folder') return folderOptions;
    const descendants = collectDescendantFolderIds(moveRequest.folderId);
    return folderOptions.map(f => ({
      ...f,
      disabled: f.id === moveRequest.folderId || descendants.has(f.id),
    }));
  }, [folderOptions, moveRequest, collectDescendantFolderIds]);

  // 加载文件夹、标签和笔记（带缓存）
  const loadData = async (forceRefresh = false) => {
    try {
      const tagsPromise = forceRefresh ? getTags({}) : cache.getTags() ? Promise.resolve({ data: cache.getTags(), error: null }) : getTags({});
      const treePromise = getNotesTree({});

      const [tagsResult, treeResult] = await Promise.all([tagsPromise, treePromise]);

      if (tagsResult?.error) throw new Error(tagsResult.error);
      if (treeResult?.error) throw new Error(treeResult.error);

      if (tagsResult?.data) {
        setTags(tagsResult.data);
        cache.setTags(tagsResult.data);
      }

      if (treeResult?.data?.tree) {
        setTree(treeResult.data.tree);
      }
    } catch (error: any) {
      console.error('加载数据失败:', error);
      toast.error(error.message || t('toast.loadError'));
    }
  };

  const handleMoveRequest = (req: TreeNodeMoveRequest) => {
    setMoveRequest(req);
    const current = req.type === 'folder' ? req.currentParentId : req.currentFolderId;
    setMoveToValue(mapFolderIdToDialogValue(current));
    setMoveDialogOpen(true);
  };

  const handleConfirmMove = async () => {
    if (!moveRequest) return;
    const targetFolderId = mapDialogValueToFolderId(moveToValue);

    try {
      setIsMoving(true);

      if (moveRequest.type === 'note') {
        if ((moveRequest.currentFolderId || null) === (targetFolderId || null)) {
          setMoveDialogOpen(false);
          return;
        }
        await updateNote({
          noteId: moveRequest.noteId,
          folderId: targetFolderId,
        });
      } else {
        if ((moveRequest.currentParentId || null) === (targetFolderId || null)) {
          setMoveDialogOpen(false);
          return;
        }
        await updateFolder({
          folderId: moveRequest.folderId,
          parentId: targetFolderId,
        });
      }

      toast.success(t('toast.moveSuccess'));
      await loadData(true);
      setMoveDialogOpen(false);
    } catch (error: any) {
      console.error('移动失败:', error);
      toast.error(error.message || t('toast.moveError'));
    } finally {
      setIsMoving(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听 tree 变化，自动展开新创建项的父级
  useEffect(() => {
    const collectKeys = (nodes: NotesTreeNode[], out: string[] = []) => {
      for (const n of nodes) {
        out.push(n.type === 'folder' ? `folder-${n.id}` : `note-${n.id}`);
        if (n.children?.length) collectKeys(n.children, out);
      }
      return out;
    };

    const currentKeys = collectKeys(tree, []);
    const prevKeys = new Set(previousTreeRef.current);

    const newKeys = currentKeys.filter(k => !prevKeys.has(k));
    if (newKeys.length) {
      // 展开这些新节点的父链
      const expandParent = (targetKey: string, nodes: NotesTreeNode[]): boolean => {
        for (const node of nodes) {
          const nodeKey = node.type === 'folder' ? `folder-${node.id}` : `note-${node.id}`;
          const isDirectParent = node.children?.some(child => (child.type === 'folder' ? `folder-${child.id}` : `note-${child.id}`) === targetKey);
          if (isDirectParent) {
            if (node.type === 'folder') setExpandedItems(prev => new Set(prev).add(nodeKey));
            return true;
          }
          if (node.children?.length && expandParent(targetKey, node.children)) {
            if (node.type === 'folder') setExpandedItems(prev => new Set(prev).add(nodeKey));
            return true;
          }
        }
        return false;
      };

      for (const k of newKeys) {
        expandParent(k, tree);
      }
    }

    previousTreeRef.current = currentKeys;
  }, [tree]);

  // 切换展开/折叠
  const toggleExpanded = (itemId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      return newExpanded;
    });
  };

  // 创建文件夹
  const handleCreateFolder = async (parentId?: string | null) => {
    const targetParentId = parentId !== undefined ? parentId : creatingFolderParentId;
    const folderName = newFolderName.trim() || t('sidebar.newFolder');

    try {
      setIsCreatingFolder(true);
      const result = await createFolder({
        name: folderName,
        parentId: targetParentId || null,
      });

      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        toast.success(t('folder.createSuccess'));
        setNewFolderName('');
        setCreatingFolderParentId(undefined);
        // 强制刷新数据
        await loadData(true);
      }
    } catch (error: any) {
      console.error('创建文件夹失败:', error);
      toast.error(error.message || t('folder.createError'));
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 创建笔记
  const handleCreateNote = async (parentId?: string | null) => {
    try {
      setIsCreatingNote(true);
      const folderId = parentId || null;
      const result = await createNote({
        title: t('sidebar.newNote'),
        content: '',
        folderId,
      });

      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        toast.success(t('toast.createSuccess'));
        // 强制刷新数据
        await loadData(true);
        // 选中新创建的笔记
        onNoteSelect(result.data.id);
      }
    } catch (error: any) {
      console.error('创建笔记失败:', error);
      toast.error(error.message || t('toast.createError'));
    } finally {
      setIsCreatingNote(false);
    }
  };

  // 删除文件夹
  const handleDeleteFolder = async (folderId: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    confirm({
      content: t('folder.deleteConfirm', { name: folderName }),
      buttonText: {
        cancel: tCommon('cancel'),
        confirm: tCommon('delete'),
        loading: tCommon('deleting'),
      },
      onConfirm: async () => {
        try {
          setDeleting(folderId);
          const result = await deleteFolder({
            folderId,
            moveNotesTo: null,
          });

          if (result.error) {
            throw new Error(result.error);
          }
          toast.success(t('folder.deleteSuccess'));
          // 强制刷新数据
          await loadData(true);
        } catch (error: any) {
          console.error('删除文件夹失败:', error);
          toast.error(error.message || t('folder.deleteError'));
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  // 删除笔记
  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    confirm({
      content: t('toast.deleteConfirm'),
      buttonText: {
        cancel: tCommon('cancel'),
        confirm: tCommon('delete'),
        loading: tCommon('deleting'),
      },
      onConfirm: async () => {
        try {
          setDeleting(noteId);
          const result = await deleteNote({ noteId, permanent: false });

          if (result.error) {
            throw new Error(result.error);
          }
          toast.success(t('toast.deleteSuccess'));
          // 强制刷新数据
          await loadData(true);
          if (selectedNoteId === noteId) {
            onNoteSelect(null);
          }
        } catch (error: any) {
          console.error('删除笔记失败:', error);
          toast.error(error.message || t('toast.deleteError'));
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  // 创建标签
  const handleCreateTag = async (name: string) => {
    try {
      setIsCreatingTag(true);
      const result = await createTag({
        name,
      });

      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        toast.success(t('tag.createSuccess'));
        // 强制刷新数据
        await loadData(true);
      }
    } catch (error: any) {
      console.error('创建标签失败:', error);
      toast.error(error.message || t('tag.createError'));
    } finally {
      setIsCreatingTag(false);
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: string, tagName: string) => {
    confirm({
      content: t('tag.deleteConfirm', { name: tagName }),
      buttonText: {
        cancel: tCommon('cancel'),
        confirm: tCommon('delete'),
        loading: tCommon('deleting'),
      },
      onConfirm: async () => {
        try {
          const result = await deleteTag({ tagId });

          if (result.error) {
            throw new Error(result.error);
          }
          toast.success(t('tag.deleteSuccess'));
          // 强制刷新数据
          await loadData(true);
          // tag selection is optional; if provided, caller can handle it via onTagToggle
          if (selectedTagIds.includes(tagId)) {
            onTagToggle?.(tagId);
          }
        } catch (error: any) {
          console.error('删除标签失败:', error);
          toast.error(error.message || t('tag.deleteError'));
        }
      },
    });
  };

  // 判断是否有子节点
  const hasChildren = (node: NotesTreeNode): boolean => {
    return node.children && node.children.length > 0;
  };

  // 计算“可见节点列表”（展开状态生效），用于处理相邻选中项的圆角融合
  const activeAdjacencyMap = useMemo(() => {
    const visible: Array<{ itemId: string; isActive: boolean }> = [];

    const walk = (nodes: NotesTreeNode[]) => {
      for (const n of nodes) {
        const itemId = n.type === 'folder' ? `folder-${n.id}` : `note-${n.id}`;
        const isActive = n.type === 'folder' ? effectiveSelectedFolderId === n.id : selectedNoteId === n.id;
        visible.push({ itemId, isActive });

        const isExpanded = n.type === 'folder' && expandedItems.has(itemId);
        if (isExpanded && n.children?.length) {
          walk(n.children);
        }
      }
    };

    walk(tree);

    const map = new Map<string, { mergePrev: boolean; mergeNext: boolean }>();
    for (let i = 0; i < visible.length; i++) {
      const cur = visible[i];
      if (!cur?.isActive) continue;
      const prev = i > 0 ? visible[i - 1] : undefined;
      const next = i < visible.length - 1 ? visible[i + 1] : undefined;
      const mergePrev = !!prev?.isActive;
      const mergeNext = !!next?.isActive;
      map.set(cur.itemId, { mergePrev, mergeNext });
    }
    return map;
  }, [tree, expandedItems, effectiveSelectedFolderId, selectedNoteId]);

  // 渲染树节点
  const renderNode = (node: NotesTreeNode, level: number = 0): React.ReactNode => {
    const itemId = node.type === 'folder' ? `folder-${node.id}` : `note-${node.id}`;
    const isExpanded = expandedItems.has(itemId);
    const hasChildNodes = hasChildren(node);
    const isActive = node.type === 'folder' ? effectiveSelectedFolderId === node.id : selectedNoteId === node.id;
    const isDeleting = deleting === node.id;
    const adjacency = activeAdjacencyMap.get(itemId);

    return (
      <TreeNodeItem
        key={itemId}
        node={node}
        level={level}
        isExpanded={isExpanded}
        isActive={isActive}
        mergeWithPrevActive={!!adjacency?.mergePrev}
        mergeWithNextActive={!!adjacency?.mergeNext}
        isDeleting={isDeleting}
        hasChildNodes={hasChildNodes}
        creatingFolderParentId={creatingFolderParentId}
        newFolderName={newFolderName}
        isCreatingFolder={isCreatingFolder}
        isCreatingNote={isCreatingNote}
        onToggleExpanded={toggleExpanded}
        onNoteSelect={onNoteSelect}
        onSetCreatingFolderParentId={setCreatingFolderParentId}
        onSetNewFolderName={setNewFolderName}
        onSetExpandedItems={setExpandedItems}
        onCreateNote={handleCreateNote}
        onDeleteFolder={handleDeleteFolder}
        onDeleteNote={handleDeleteNote}
        onMoveRequest={handleMoveRequest}
        onCreateFolder={handleCreateFolder}
        onCancelCreateFolder={() => {
          setCreatingFolderParentId(undefined);
          setNewFolderName('');
        }}
        folderInputRef={folderInputRef}
        renderChildren={children => children.map(child => renderNode(child, level + 1))}
      />
    );
  };

  return (
    <div className="border-border/50 bg-background/50 flex h-full flex-col overflow-hidden border-r">
      <ConfirmDialog />
      <MoveToFolderDialog
        open={moveDialogOpen}
        onOpenChange={open => {
          setMoveDialogOpen(open);
          if (!open) setMoveRequest(null);
        }}
        value={moveToValue}
        onValueChange={setMoveToValue}
        folders={moveRequest?.type === 'folder' ? moveFolderOptions : folderOptions}
        description={moveRequest ? `${moveRequest.type === 'folder' ? t('sidebar.folders') : t('title')}: ${moveRequest.name}` : undefined}
        confirmDisabled={
          !moveRequest ||
          (moveRequest.type === 'note'
            ? (moveRequest.currentFolderId || null) === (mapDialogValueToFolderId(moveToValue) || null)
            : (moveRequest.currentParentId || null) === (mapDialogValueToFolderId(moveToValue) || null))
        }
        loading={isMoving}
        onConfirm={handleConfirmMove}
      />

      {/* 文件夹区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 头部 - 固定 */}
        <div className="flex flex-shrink-0 items-center justify-between px-3 py-2">
          <Button
            className="text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1"
            size="sm"
            variant="ghost"
            onClick={e => {
              e.stopPropagation();
              router.push('/dashboard/notes');
            }}
          >
            {/* 回到首页（/dashboard/notes） */}
            <Home className="size-4" />
            <h3 className="text-muted-foreground select-none truncate text-xs font-normal">{t('sidebar.folders')}</h3>
          </Button>

          {/* 全局新增（文件夹/笔记） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
                title={t('sidebar.create')}
                disabled={(isCreatingFolder && creatingFolderParentId === null) || isCreatingNote}
                onClick={e => e.stopPropagation()}
              >
                {isCreatingFolder && creatingFolderParentId === null ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={() => {
                  setNewFolderName(t('sidebar.newFolder'));
                  setCreatingFolderParentId(null); // null 表示在根目录创建
                }}
                disabled={isCreatingFolder && creatingFolderParentId === null}
              >
                {t('sidebar.newFolder')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateNote(null)} disabled={isCreatingNote}>
                {t('sidebar.newNote')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 笔记树 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {tree.length === 0 && !isCreatingRootFolder ? (
            <div className="text-muted-foreground select-none py-8 text-center text-sm">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>{t('sidebar.noNotes')}</p>
            </div>
          ) : (
            <div>
              {/* 如果正在根目录创建文件夹，显示输入框 */}
              {isCreatingRootFolder && (
                <FolderInput
                  ref={folderInputRef}
                  value={newFolderName}
                  onChange={setNewFolderName}
                  onConfirm={() => handleCreateFolder()}
                  onCancel={() => {
                    setCreatingFolderParentId(undefined);
                    setNewFolderName('');
                  }}
                  level={0}
                  disabled={isCreatingFolder}
                />
              )}
              {tree.map(node => renderNode(node, 0))}
            </div>
          )}
        </div>
      </div>

      {/* 标签区域 */}
      <TagsSection
        tags={tags}
        selectedTagIds={selectedTagIds}
        onTagToggle={onTagToggle}
        onCreateTag={handleCreateTag}
        onDeleteTag={handleDeleteTag}
        isCreatingTag={isCreatingTag}
      />
    </div>
  );
}
