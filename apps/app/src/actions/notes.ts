'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { NoteService } from '@/service/note';
import type {
  CreateNoteInput,
  UpdateNoteInput,
  CreateFolderInput,
  UpdateFolderInput,
  CreateTagInput,
  UpdateTagInput,
  NotesListQuery,
  NotesListResponse,
  NotesTreeResponse,
  NoteWithRelations,
  FolderWithStats,
  TagWithStats,
  NotesTreeNode,
} from '@/service/note';
import type { Notes, NoteFolders, NoteTags, NoteLinks, NoteAttachments, NoteVersions } from '@prisma/client';

// ============================================
// Re-export Types
// ============================================

export type { NoteContent } from '@/service/note';
export type {
  NoteWithRelations,
  FolderWithStats,
  TagWithStats,
  CreateNoteInput,
  UpdateNoteInput,
  CreateFolderInput,
  UpdateFolderInput,
  CreateTagInput,
  UpdateTagInput,
  NotesListQuery,
  NotesListResponse,
  NotesTreeNode,
  NotesTreeResponse,
};

// 笔记链接类型（包含关联的笔记信息）
export type NoteLinkWithNotes = NoteLinks & {
  sourceNote: Pick<Notes, 'id' | 'title'>;
  targetNote: Pick<Notes, 'id' | 'title'>;
};

// 笔记统计类型
export type NoteStats = {
  total: number;
  pinned: number;
  starred: number;
  archived: number;
  byFolder: Array<{
    folderId: string | null;
    folderName: string | null;
    count: number;
  }>;
  byTag: Array<{
    tagId: string;
    tagName: string;
    count: number;
  }>;
};

// 从聊天保存笔记的输入类型
export type SaveNoteFromChatInput = {
  sessionId: string;
  messageIds?: string[];
  title?: string;
  folderId?: string | null;
  tagIds?: string[];
};

// AI 辅助功能类型
export type GenerateNoteSummaryInput = {
  noteId: string;
  maxLength?: number;
};

export type SuggestTagsInput = {
  noteId: string;
  maxTags?: number;
};

export type FindRelatedNotesInput = {
  noteId: string;
  limit?: number;
};

export type SearchNotesQuery = {
  query: string;
  folderId?: string | null;
  tagIds?: string[];
  limit?: number;
};

export type FoldersListResponse = {
  folders: FolderWithStats[];
};

export type TagsListResponse = {
  tags: TagWithStats[];
};

// ============================================
// Notes CRUD
// ============================================

/**
 * 创建笔记
 */
export const createNote = withUserAuth('notes/createNote', async ({ orgId, args }: AuthWrapperContext<CreateNoteInput>) => {
  const result = await NoteService.createNote(orgId, args);
  // 返回完整的笔记信息
  return NoteService.getNote(orgId, result.note.id);
});

/**
 * 获取笔记列表
 */
export const getNotes = withUserAuth(
  'notes/getNotes',
  async ({ orgId, args }: AuthWrapperContext<NotesListQuery>): Promise<NotesListResponse> => {
    return NoteService.getNotes(orgId, args || {});
  },
);

/**
 * 获取侧边栏树状结构
 */
export const getNotesTree = withUserAuth(
  'notes/getNotesTree',
  async ({ orgId }: AuthWrapperContext<{}>): Promise<NotesTreeResponse> => {
    return NoteService.getNotesTree(orgId);
  },
);

/**
 * 获取单个笔记（包含内容）
 */
export const getNote = withUserAuth(
  'notes/getNote',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string; includeContent?: boolean }>) => {
  const { noteId, includeContent = true } = args;
    const note = await NoteService.getNote(orgId, noteId, includeContent);
    if (!note) {
      throw new Error('笔记不存在');
    }
    return note;
  },
);

/**
 * 更新笔记
 */
export const updateNote = withUserAuth(
  'notes/updateNote',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string } & UpdateNoteInput>) => {
    const { noteId, ...input } = args;
    return NoteService.updateNote(orgId, noteId, input);
  },
);

/**
 * 删除笔记（软删除）
 */
export const deleteNote = withUserAuth(
  'notes/deleteNote',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string; permanent?: boolean }>) => {
  const { noteId, permanent = false } = args;
    await NoteService.deleteNote(orgId, noteId, permanent);
  },
);

// ============================================
// Folders CRUD
// ============================================

/**
 * 创建文件夹
 */
export const createFolder = withUserAuth('notes/createFolder', async ({ orgId, args }: AuthWrapperContext<CreateFolderInput>) => {
  return NoteService.createFolder(orgId, args);
});

/**
 * 获取文件夹列表
 */
export const getFolders = withUserAuth('notes/getFolders', async ({ orgId }: AuthWrapperContext<{}>) => {
  return NoteService.getFolders(orgId);
});

/**
 * 更新文件夹
 */
export const updateFolder = withUserAuth(
  'notes/updateFolder',
  async ({ orgId, args }: AuthWrapperContext<{ folderId: string } & UpdateFolderInput>) => {
    const { folderId, ...input } = args;
    return NoteService.updateFolder(orgId, folderId, input);
  },
);

/**
 * 删除文件夹
 */
export const deleteFolder = withUserAuth(
  'notes/deleteFolder',
  async ({ orgId, args }: AuthWrapperContext<{ folderId: string; moveNotesTo?: string | null }>) => {
    const { folderId, moveNotesTo } = args;
    await NoteService.deleteFolder(orgId, folderId, moveNotesTo);
  },
);

// ============================================
// Tags CRUD
// ============================================

/**
 * 创建标签
 */
export const createTag = withUserAuth('notes/createTag', async ({ orgId, args }: AuthWrapperContext<CreateTagInput>) => {
  return NoteService.createTag(orgId, args);
});

/**
 * 获取标签列表
 */
export const getTags = withUserAuth('notes/getTags', async ({ orgId }: AuthWrapperContext<{}>) => {
  return NoteService.getTags(orgId);
});

/**
 * 更新标签
 */
export const updateTag = withUserAuth(
  'notes/updateTag',
  async ({ orgId, args }: AuthWrapperContext<{ tagId: string } & UpdateTagInput>) => {
    const { tagId, ...input } = args;
    return NoteService.updateTag(orgId, tagId, input);
  },
);

/**
 * 删除标签
 */
export const deleteTag = withUserAuth('notes/deleteTag', async ({ orgId, args }: AuthWrapperContext<{ tagId: string }>) => {
  const { tagId } = args;
  await NoteService.deleteTag(orgId, tagId);
});

// ============================================
// Attachments CRUD
// ============================================

/**
 * 添加附件到笔记
 */
export const addAttachmentToNote = withUserAuth(
  'notes/addAttachmentToNote',
  async ({
    orgId,
    args,
  }: AuthWrapperContext<{ noteId: string; fileKey: string; fileName: string; fileType: string; fileSize: number }>) => {
    const { noteId, ...attachment } = args;
    return NoteService.addAttachment(orgId, noteId, attachment);
  },
);

/**
 * 获取笔记的附件列表
 */
export const getNoteAttachments = withUserAuth(
  'notes/getNoteAttachments',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string }>) => {
  const { noteId } = args;
    return NoteService.getAttachments(orgId, noteId);
  },
);

/**
 * 删除附件
 */
export const deleteAttachment = withUserAuth(
  'notes/deleteAttachment',
  async ({ orgId, args }: AuthWrapperContext<{ attachmentId: string }>) => {
  const { attachmentId } = args;
    await NoteService.deleteAttachment(orgId, attachmentId);
  },
);
