/**
 * Note Server - 类型定义
 */

import type { Notes, NoteFolders, NoteTags, NoteAttachments } from '@prisma/client';

// ============================================
// 基础类型
// ============================================

/** 笔记内容使用 Markdown 格式（字符串） */
export type NoteContent = string;

/** 扩展的笔记类型（包含关联数据和内容） */
export type NoteWithRelations = Omit<Notes, 'contentKey'> & {
  content?: NoteContent;
  contentKey: string;
  folder?: NoteFolders | null;
  tags?: (NoteTags & { relation: { id: string; createdAt: Date } })[];
  attachments?: NoteAttachments[];
  linkCount?: number;
  backLinkCount?: number;
};

/** 扩展的文件夹类型（包含子文件夹和笔记数量） */
export type FolderWithStats = NoteFolders & {
  children?: FolderWithStats[];
  noteCount?: number;
  _depth?: number;
};

/** 扩展的标签类型（包含笔记数量） */
export type TagWithStats = NoteTags & {
  noteCount?: number;
};

// ============================================
// 输入类型
// ============================================

/** 创建笔记输入 */
export type CreateNoteInput = {
  title: string;
  content: NoteContent;
  folderId?: string | null;
  tagIds?: string[];
};

/** 更新笔记输入 */
export type UpdateNoteInput = {
  title?: string;
  content?: NoteContent;
  folderId?: string | null;
  isPinned?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  tagIds?: string[];
};

/** 编辑操作（diff 模式） */
export type EditOperation = {
  oldText: string;
  newText: string;
};

/** 编辑笔记输入（支持 diff） */
export type EditNoteInput = {
  noteId: string;
  title?: string;
  edits?: EditOperation[];
  fullContent?: string;
};

/** 创建文件夹输入 */
export type CreateFolderInput = {
  name: string;
  parentId?: string | null;
};

/** 更新文件夹输入 */
export type UpdateFolderInput = {
  name?: string;
  parentId?: string | null;
  order?: number;
};

/** 创建标签输入 */
export type CreateTagInput = {
  name: string;
  color?: string | null;
};

/** 更新标签输入 */
export type UpdateTagInput = {
  name?: string;
  color?: string | null;
  order?: number;
};

/** 笔记列表查询参数 */
export type NotesListQuery = {
  page?: number;
  pageSize?: number;
  folderId?: string | null;
  tagIds?: string[];
  search?: string;
  isPinned?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  orderBy?: 'createdAt' | 'updatedAt' | 'title';
  order?: 'asc' | 'desc';
};

// ============================================
// 响应类型
// ============================================

/** 笔记列表响应 */
export type NotesListResponse = {
  notes: NoteWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

/** 笔记树节点 */
export type NotesTreeNode = {
  type: 'folder' | 'note';
  id: string;
  name: string;
  parentId: string | null;
  children: NotesTreeNode[];
  folder?: Pick<FolderWithStats, 'id' | 'name' | 'parentId' | 'order' | 'createdAt' | 'updatedAt' | 'noteCount'>;
  note?: Pick<Notes, 'id' | 'title' | 'folderId' | 'createdAt' | 'updatedAt'>;
};

/** 笔记树响应 */
export type NotesTreeResponse = {
  tree: NotesTreeNode[];
};

/** 编辑笔记结果 */
export type EditNoteResult = {
  noteId: string;
  title: string;
  editCount: number;
  failedEdits?: Array<{ oldText: string; reason: string }>;
  contentKey?: string;
};

/** 创建笔记结果 */
export type CreateNoteResult = {
  note: Notes;
  contentKey: string;
};
