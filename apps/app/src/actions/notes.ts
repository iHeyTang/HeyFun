'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import type { Notes, NoteFolders, NoteTags, NoteLinks, NoteAttachments, NoteVersions } from '@prisma/client';

// ============================================
// Types - 类型定义
// ============================================

// 笔记内容使用 Markdown 格式（字符串）
export type NoteContent = string; // Markdown 格式的字符串

// 扩展的笔记类型（包含关联数据和内容）
export type NoteWithRelations = Omit<Notes, 'contentKey'> & {
  content?: NoteContent; // 可选，读取时才加载内容
  contentKey: string; // OSS key
  folder?: NoteFolders | null;
  tags?: (NoteTags & { relation: { id: string; createdAt: Date } })[];
  attachments?: NoteAttachments[];
  linkCount?: number;
  backLinkCount?: number;
};

// 扩展的文件夹类型（包含子文件夹和笔记数量）
export type FolderWithStats = NoteFolders & {
  children?: FolderWithStats[];
  noteCount?: number;
  _depth?: number; // 用于前端渲染的深度标记
};

// 扩展的标签类型（包含笔记数量）
export type TagWithStats = NoteTags & {
  noteCount?: number;
};

// 笔记链接类型（包含关联的笔记信息）
export type NoteLinkWithNotes = NoteLinks & {
  sourceNote: Pick<Notes, 'id' | 'title'>;
  targetNote: Pick<Notes, 'id' | 'title'>;
};

// API 请求类型
export type CreateNoteInput = {
  title: string;
  content: NoteContent; // Markdown 格式
  folderId?: string | null;
  tagIds?: string[];
};

export type UpdateNoteInput = {
  title?: string;
  content?: NoteContent; // Markdown 格式
  folderId?: string | null;
  isPinned?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  tagIds?: string[];
};

export type CreateFolderInput = {
  name: string;
  parentId?: string | null;
};

export type UpdateFolderInput = {
  name?: string;
  parentId?: string | null;
  order?: number;
};

export type CreateTagInput = {
  name: string;
  color?: string | null;
};

export type UpdateTagInput = {
  name?: string;
  color?: string | null;
  order?: number;
};

export type CreateNoteLinkInput = {
  sourceNoteId: string;
  targetNoteId: string;
  linkType?: 'bidirectional' | 'unidirectional';
};

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

export type SearchNotesQuery = {
  query: string;
  folderId?: string | null;
  tagIds?: string[];
  limit?: number;
};

// API 响应类型
export type NotesListResponse = {
  notes: NoteWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FoldersListResponse = {
  folders: FolderWithStats[];
};

export type TagsListResponse = {
  tags: TagWithStats[];
};

// ============================================
// Notes Tree - 聚合树结构（文件夹 + 笔记）
// ============================================

export type NotesTreeNode = {
  type: 'folder' | 'note';
  id: string;
  name: string;
  parentId: string | null;
  children: NotesTreeNode[];
  folder?: Pick<FolderWithStats, 'id' | 'name' | 'parentId' | 'order' | 'createdAt' | 'updatedAt' | 'noteCount'>;
  note?: Pick<Notes, 'id' | 'title' | 'folderId' | 'createdAt' | 'updatedAt'>;
};

export type NotesTreeResponse = {
  tree: NotesTreeNode[];
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
  messageIds?: string[]; // 如果为空，保存整个会话
  title?: string; // 如果为空，自动生成
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

// ============================================
// Notes CRUD
// ============================================

/**
 * 创建笔记
 */
export const createNote = withUserAuth('notes/createNote', async ({ orgId, args }: AuthWrapperContext<CreateNoteInput>) => {
  const { title, content, folderId, tagIds = [] } = args;

  try {
    // 计算内容哈希
    const contentHash = calculateContentHash(content);

    // 提取纯文本内容用于搜索
    const contentText = extractTextFromMarkdown(content);

    // 生成 OSS 文件 key
    const contentKey = `${orgId}/notes/${Date.now()}_${nanoid(8)}.md`;

    // 上传内容到 OSS
    await storage.put(contentKey, Buffer.from(content, 'utf-8'), {
      contentType: 'text/markdown',
    });

    // 创建笔记
    const note = await prisma.notes.create({
      data: {
        organizationId: orgId,
        title: title.trim(),
        contentKey,
        contentHash,
        contentText,
        folderId: folderId || null,
      },
      include: {
        folder: true,
        tagRelations: {
          include: {
            tag: true,
          },
        },
      },
    });

    // 如果有标签，创建关联
    if (tagIds.length > 0) {
      await prisma.noteTagRelations.createMany({
        data: tagIds.map(tagId => ({
          noteId: note.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    // 重新获取包含标签的笔记
    const noteWithTags = await prisma.notes.findUnique({
      where: { id: note.id },
      include: {
        folder: true,
        tagRelations: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!noteWithTags) {
      throw new Error('笔记创建失败');
    }

    return noteWithTags;
  } catch (error) {
    console.error('Error creating note:', error);
    throw error;
  }
});

/**
 * 获取笔记列表
 */
export const getNotes = withUserAuth('notes/getNotes', async ({ orgId, args }: AuthWrapperContext<NotesListQuery>): Promise<NotesListResponse> => {
  const {
    page = 1,
    pageSize = 20,
    folderId,
    tagIds = [],
    search,
    isPinned,
    isStarred,
    isArchived,
    orderBy = 'updatedAt',
    order = 'desc',
  } = args || {};

  try {
    const where: any = {
      organizationId: orgId,
      isDeleted: false,
    };

    // 文件夹筛选
    if (folderId !== undefined) {
      if (folderId === null) {
        where.folderId = null; // 未分类的笔记
      } else {
        where.folderId = folderId;
      }
    }

    // 标签筛选
    if (tagIds.length > 0) {
      where.tagRelations = {
        some: {
          tagId: { in: tagIds },
        },
      };
    }

    // 搜索
    if (search) {
      where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { contentText: { contains: search, mode: 'insensitive' } }];
    }

    // 状态筛选
    if (isPinned !== undefined) where.isPinned = isPinned;
    if (isStarred !== undefined) where.isStarred = isStarred;
    if (isArchived !== undefined) where.isArchived = isArchived;

    const [notes, total] = await Promise.all([
      prisma.notes.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          [orderBy]: order,
        },
        include: {
          folder: true,
          tagRelations: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              links: true,
              backLinks: true,
            },
          },
        },
      }),
      prisma.notes.count({ where }),
    ]);

    // 转换数据格式
    const notesWithRelations: NoteWithRelations[] = notes.map((note: any) => ({
      ...note,
      tags: note.tagRelations.map((rel: any) => ({
        ...rel.tag,
        relation: {
          id: rel.id,
          createdAt: rel.createdAt,
        },
      })),
      linkCount: note._count.links,
      backLinkCount: note._count.backLinks,
    }));

    return {
      notes: notesWithRelations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error('Error getting notes:', error);
    throw error;
  }
});

/**
 * 获取侧边栏树状结构（后端聚合：文件夹 + 笔记）
 * - 只返回渲染树所需的最小字段
 * - 文件夹按 order/createdAt 排序
 * - 笔记按 updatedAt desc 排序
 */
export const getNotesTree = withUserAuth('notes/getNotesTree', async ({ orgId }: AuthWrapperContext<{}>): Promise<NotesTreeResponse> => {
  try {
    const [foldersRaw, notesRaw] = await Promise.all([
      prisma.noteFolders.findMany({
        where: {
          organizationId: orgId,
        },
        include: {
          _count: {
            select: {
              notes: {
                where: {
                  isDeleted: false,
                },
              },
            },
          },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.notes.findMany({
        where: {
          organizationId: orgId,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          folderId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
      }),
    ]);

    const folderNodes = new Map<string, NotesTreeNode>();
    const rootNodes: NotesTreeNode[] = [];

    // 先创建所有文件夹节点
    for (const folder of foldersRaw as any[]) {
      const folderWithStats: FolderWithStats = {
        ...folder,
        noteCount: folder._count?.notes ?? 0,
      };

      folderNodes.set(folder.id, {
        type: 'folder',
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        children: [],
        folder: {
          id: folderWithStats.id,
          name: folderWithStats.name,
          parentId: folderWithStats.parentId,
          order: folderWithStats.order,
          createdAt: folderWithStats.createdAt,
          updatedAt: folderWithStats.updatedAt,
          noteCount: folderWithStats.noteCount,
        },
      });
    }

    // 构建文件夹层级
    for (const node of folderNodes.values()) {
      if (node.parentId && folderNodes.has(node.parentId)) {
        folderNodes.get(node.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // 添加笔记节点
    for (const note of notesRaw) {
      const noteNode: NotesTreeNode = {
        type: 'note',
        id: note.id,
        name: note.title,
        parentId: note.folderId,
        children: [],
        note: note,
      };

      if (note.folderId && folderNodes.has(note.folderId)) {
        folderNodes.get(note.folderId)!.children.push(noteNode);
      } else {
        rootNodes.push(noteNode);
      }
    }

    // 递归排序：文件夹在前，笔记在后；同类型再按规则排序
    const sortNodes = (nodes: NotesTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        if (a.type === 'folder') {
          const ao = a.folder?.order ?? 0;
          const bo = b.folder?.order ?? 0;
          if (ao !== bo) return ao - bo;
          const ac = a.folder?.createdAt?.getTime?.() ?? 0;
          const bc = b.folder?.createdAt?.getTime?.() ?? 0;
          if (ac !== bc) return ac - bc;
          return (a.name || '').localeCompare(b.name || '');
        }
        // note
        const au = a.note?.updatedAt?.getTime?.() ?? 0;
        const bu = b.note?.updatedAt?.getTime?.() ?? 0;
        if (au !== bu) return bu - au;
        return (a.name || '').localeCompare(b.name || '');
      });

      for (const n of nodes) {
        if (n.children?.length) sortNodes(n.children);
      }
    };
    sortNodes(rootNodes);

    return { tree: rootNodes };
  } catch (error) {
    console.error('Error getting notes tree:', error);
    throw error;
  }
});

/**
 * 获取单个笔记（包含内容）
 */
export const getNote = withUserAuth('notes/getNote', async ({ orgId, args }: AuthWrapperContext<{ noteId: string; includeContent?: boolean }>) => {
  const { noteId, includeContent = true } = args;

  try {
    const note = await prisma.notes.findUnique({
      where: {
        id: noteId,
        organizationId: orgId,
        isDeleted: false,
      },
      include: {
        folder: true,
        tagRelations: {
          include: {
            tag: true,
          },
        },
        attachments: true,
        links: {
          include: {
            targetNote: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        backLinks: {
          include: {
            sourceNote: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        _count: {
          select: {
            links: true,
            backLinks: true,
          },
        },
      },
    });

    if (!note) {
      throw new Error('笔记不存在');
    }

    // 从 OSS 读取内容
    let content: string | undefined;
    if (includeContent) {
      try {
        const contentBuffer = await storage.getBytes(note.contentKey);
        if (contentBuffer) {
          content = Buffer.from(contentBuffer).toString('utf-8');
        }
      } catch (error) {
        console.error('Error reading note content from OSS:', error);
        // 如果读取失败，content 保持为 undefined
      }
    }

    return {
      ...note,
      content,
      tags: note.tagRelations.map((rel: any) => ({
        ...rel.tag,
        relation: {
          id: rel.id,
          createdAt: rel.createdAt,
        },
      })),
      linkCount: note._count.links,
      backLinkCount: note._count.backLinks,
    };
  } catch (error) {
    console.error('Error getting note:', error);
    throw error;
  }
});

/**
 * 更新笔记
 */
export const updateNote = withUserAuth('notes/updateNote', async ({ orgId, args }: AuthWrapperContext<{ noteId: string } & UpdateNoteInput>) => {
  const { noteId, title, content, folderId, isPinned, isStarred, isArchived, tagIds } = args;

  try {
    // 验证笔记存在
    const existingNote = await prisma.notes.findUnique({
      where: {
        id: noteId,
        organizationId: orgId,
      },
    });

    if (!existingNote) {
      throw new Error('笔记不存在');
    }

    // 如果更新文件夹，验证目标文件夹归属（防止跨组织/非法 parent）
    if (folderId !== undefined && folderId) {
      const folder = await prisma.noteFolders.findUnique({
        where: {
          id: folderId,
          organizationId: orgId,
        },
      });
      if (!folder) {
        throw new Error('文件夹不存在');
      }
    }

    // 构建更新数据
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (folderId !== undefined) updateData.folderId = folderId || null;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (isStarred !== undefined) updateData.isStarred = isStarred;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    // 如果更新内容，上传到 OSS
    if (content !== undefined) {
      const contentHash = calculateContentHash(content);
      const contentText = extractTextFromMarkdown(content);

      // 如果内容哈希相同，不需要更新 OSS
      if (contentHash !== existingNote.contentHash) {
        // 生成新的 OSS key（保留历史版本）
        const newContentKey = `${orgId}/notes/${Date.now()}_${nanoid(8)}.md`;

        // 上传新内容到 OSS
        await storage.put(newContentKey, Buffer.from(content, 'utf-8'), {
          contentType: 'text/markdown',
        });

        // 删除旧内容（可选，可以保留用于版本历史）
        // await storage.delete(existingNote.contentKey);

        updateData.contentKey = newContentKey;
        updateData.contentHash = contentHash;
        updateData.contentText = contentText;
      }
    }

    // 更新笔记
    await prisma.notes.update({
      where: { id: noteId },
      data: updateData,
    });

    // 更新标签关联
    if (tagIds !== undefined) {
      // 删除现有关联
      await prisma.noteTagRelations.deleteMany({
        where: { noteId },
      });

      // 创建新关联
      if (tagIds.length > 0) {
        await prisma.noteTagRelations.createMany({
          data: tagIds.map(tagId => ({
            noteId,
            tagId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 返回更新后的笔记（包含内容）
    const updatedNote = await prisma.notes.findUnique({
      where: { id: noteId },
      include: {
        folder: true,
        tagRelations: {
          include: {
            tag: true,
          },
        },
        attachments: true,
        _count: {
          select: {
            links: true,
            backLinks: true,
          },
        },
      },
    });

    if (!updatedNote) {
      throw new Error('笔记不存在');
    }

    // 从 OSS 读取内容
    let noteContent: string | undefined;
    try {
      const contentBuffer = await storage.getBytes(updatedNote.contentKey);
      if (contentBuffer) {
        noteContent = Buffer.from(contentBuffer).toString('utf-8');
      }
    } catch (error) {
      console.error('Error reading note content from OSS:', error);
    }

    return {
      ...updatedNote,
      content: noteContent,
      tags: updatedNote.tagRelations.map((rel: any) => ({
        ...rel.tag,
        relation: {
          id: rel.id,
          createdAt: rel.createdAt,
        },
      })),
      linkCount: updatedNote._count.links,
      backLinkCount: updatedNote._count.backLinks,
    };
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
});

/**
 * 删除笔记（软删除）
 */
export const deleteNote = withUserAuth('notes/deleteNote', async ({ orgId, args }: AuthWrapperContext<{ noteId: string; permanent?: boolean }>) => {
  const { noteId, permanent = false } = args;

  try {
    const existingNote = await prisma.notes.findUnique({
      where: {
        id: noteId,
        organizationId: orgId,
      },
    });

    if (!existingNote) {
      throw new Error('笔记不存在');
    }

    if (permanent) {
      // 永久删除
      await prisma.notes.delete({
        where: { id: noteId },
      });
    } else {
      // 软删除
      await prisma.notes.update({
        where: { id: noteId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }

    return;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
});

// ============================================
// Folders CRUD
// ============================================

/**
 * 创建文件夹
 */
export const createFolder = withUserAuth('notes/createFolder', async ({ orgId, args }: AuthWrapperContext<CreateFolderInput>) => {
  const { name, parentId } = args;

  try {
    // 检查父文件夹是否存在
    if (parentId) {
      const parentFolder = await prisma.noteFolders.findUnique({
        where: {
          id: parentId,
          organizationId: orgId,
        },
      });

      if (!parentFolder) {
        throw new Error('父文件夹不存在');
      }
    }

    // 检查同级别是否有重名
    const duplicateFolder = await prisma.noteFolders.findFirst({
      where: {
        organizationId: orgId,
        name: name.trim(),
        parentId: parentId || null,
      },
    });

    if (duplicateFolder) {
      throw new Error('文件夹名称已存在');
    }

    const folder = await prisma.noteFolders.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        parentId: parentId || null,
      },
    });

    return folder;
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
});

/**
 * 获取文件夹列表
 */
export const getFolders = withUserAuth('notes/getFolders', async ({ orgId }: AuthWrapperContext<{}>) => {
  try {
    const folders = await prisma.noteFolders.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        _count: {
          select: {
            notes: {
              where: {
                isDeleted: false,
              },
            },
            children: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return folders.map((folder: any) => ({
      ...folder,
      noteCount: folder._count.notes,
    }));
  } catch (error) {
    console.error('Error getting folders:', error);
    throw error;
  }
});

/**
 * 更新文件夹
 */
export const updateFolder = withUserAuth(
  'notes/updateFolder',
  async ({ orgId, args }: AuthWrapperContext<{ folderId: string } & UpdateFolderInput>) => {
    const { folderId, name, parentId, order } = args;

    try {
      const existingFolder = await prisma.noteFolders.findUnique({
        where: {
          id: folderId,
          organizationId: orgId,
        },
      });

      if (!existingFolder) {
        throw new Error('文件夹不存在');
      }

      // 检查是否移动到自己的子文件夹（防止循环）
      if (parentId && parentId === folderId) {
        throw new Error('不能将文件夹移动到自身');
      }

      // 如果设置 parentId，验证目标父文件夹存在且归属同一组织
      if (parentId) {
        const parentFolder = await prisma.noteFolders.findUnique({
          where: {
            id: parentId,
            organizationId: orgId,
          },
        });
        if (!parentFolder) {
          throw new Error('父文件夹不存在');
        }
      }

      if (parentId) {
        // 检查是否移动到自己的子文件夹
        const isDescendant = await checkFolderDescendant(orgId, folderId, parentId);
        if (isDescendant) {
          throw new Error('不能将文件夹移动到自己的子文件夹');
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (parentId !== undefined) updateData.parentId = parentId || null;
      if (order !== undefined) updateData.order = order;

      const folder = await prisma.noteFolders.update({
        where: { id: folderId },
        data: updateData,
      });

      return folder;
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  },
);

/**
 * 删除文件夹
 */
export const deleteFolder = withUserAuth(
  'notes/deleteFolder',
  async ({ orgId, args }: AuthWrapperContext<{ folderId: string; moveNotesTo?: string | null }>) => {
    const { folderId, moveNotesTo } = args;

    try {
      const existingFolder = await prisma.noteFolders.findUnique({
        where: {
          id: folderId,
          organizationId: orgId,
        },
        include: {
          _count: {
            select: {
              notes: {
                where: {
                  isDeleted: false,
                },
              },
              children: true,
            },
          },
        },
      });

      if (!existingFolder) {
        throw new Error('文件夹不存在');
      }

      // 如果有子文件夹，不能删除
      if (existingFolder._count.children > 0) {
        throw new Error('请先删除子文件夹');
      }

      // 如果有笔记，移动到指定文件夹或根目录
      if (existingFolder._count.notes > 0) {
        await prisma.notes.updateMany({
          where: {
            folderId,
            organizationId: orgId,
            isDeleted: false,
          },
          data: {
            folderId: moveNotesTo || null,
          },
        });
      }

      // 删除文件夹
      await prisma.noteFolders.delete({
        where: { id: folderId },
      });

      return;
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  },
);

// ============================================
// Tags CRUD
// ============================================

/**
 * 创建标签
 */
export const createTag = withUserAuth('notes/createTag', async ({ orgId, args }: AuthWrapperContext<CreateTagInput>) => {
  const { name, color } = args;

  try {
    // 检查标签是否已存在
    const existingTag = await prisma.noteTags.findUnique({
      where: {
        organizationId_name: {
          organizationId: orgId,
          name: name.trim(),
        },
      },
    });

    if (existingTag) {
      throw new Error('标签已存在');
    }

    const tag = await prisma.noteTags.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        color: color || null,
      },
    });

    return tag;
  } catch (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
});

/**
 * 获取标签列表
 */
export const getTags = withUserAuth('notes/getTags', async ({ orgId }: AuthWrapperContext<{}>) => {
  try {
    const tags = await prisma.noteTags.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        _count: {
          select: {
            noteRelations: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return tags.map((tag: any) => ({
      ...tag,
      noteCount: tag._count.noteRelations,
    }));
  } catch (error) {
    console.error('Error getting tags:', error);
    throw error;
  }
});

/**
 * 更新标签
 */
export const updateTag = withUserAuth('notes/updateTag', async ({ orgId, args }: AuthWrapperContext<{ tagId: string } & UpdateTagInput>) => {
  const { tagId, name, color, order } = args;

  try {
    const existingTag = await prisma.noteTags.findUnique({
      where: {
        id: tagId,
        organizationId: orgId,
      },
    });

    if (!existingTag) {
      throw new Error('标签不存在');
    }

    // 如果更新名称，检查是否与其他标签重名
    if (name && name.trim() !== existingTag.name) {
      const duplicateTag = await prisma.noteTags.findUnique({
        where: {
          organizationId_name: {
            organizationId: orgId,
            name: name.trim(),
          },
        },
      });

      if (duplicateTag) {
        throw new Error('标签名称已存在');
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color || null;
    if (order !== undefined) updateData.order = order;

    const tag = await prisma.noteTags.update({
      where: { id: tagId },
      data: updateData,
    });

    return tag;
  } catch (error) {
    console.error('Error updating tag:', error);
    throw error;
  }
});

/**
 * 删除标签
 */
export const deleteTag = withUserAuth('notes/deleteTag', async ({ orgId, args }: AuthWrapperContext<{ tagId: string }>) => {
  const { tagId } = args;

  try {
    const existingTag = await prisma.noteTags.findUnique({
      where: {
        id: tagId,
        organizationId: orgId,
      },
    });

    if (!existingTag) {
      throw new Error('标签不存在');
    }

    // 删除标签（关联关系会自动删除，因为设置了 onDelete: Cascade）
    await prisma.noteTags.delete({
      where: { id: tagId },
    });

    return;
  } catch (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * 从 Markdown 中提取纯文本（用于搜索）
 */
function extractTextFromMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }

  // 简单的 Markdown 文本提取
  // 移除 Markdown 语法标记，保留纯文本
  const text = markdown
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]*`/g, '')
    // 移除链接，保留文本
    .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, '')
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗体和斜体标记
    .replace(/\*\*([^\*]*)\*\*/g, '$1')
    .replace(/\*([^\*]*)\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    // 移除列表标记
    .replace(/^[\*\-\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // 移除引用标记
    .replace(/^>\s+/gm, '')
    // 移除水平线
    .replace(/^---+$/gm, '')
    // 移除多余空白
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return text;
}

/**
 * 计算内容哈希值（用于版本控制和去重）
 */
function calculateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 检查文件夹是否是另一个文件夹的后代
 */
async function checkFolderDescendant(orgId: string, ancestorId: string, descendantId: string): Promise<boolean> {
  const folder = await prisma.noteFolders.findUnique({
    where: {
      id: descendantId,
      organizationId: orgId,
    },
  });

  if (!folder || !folder.parentId) {
    return false;
  }

  if (folder.parentId === ancestorId) {
    return true;
  }

  return checkFolderDescendant(orgId, ancestorId, folder.parentId);
}

// ============================================
// Attachments CRUD
// ============================================

/**
 * 添加附件到笔记
 */
export const addAttachmentToNote = withUserAuth(
  'notes/addAttachmentToNote',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string; fileKey: string; fileName: string; fileType: string; fileSize: number }>) => {
    const { noteId, fileKey, fileName, fileType, fileSize } = args;

    try {
      // 验证笔记存在
      const note = await prisma.notes.findUnique({
        where: {
          id: noteId,
          organizationId: orgId,
        },
      });

      if (!note) {
        throw new Error('笔记不存在');
      }

      // 验证文件权限
      const isOrgFile = fileKey.startsWith(`${orgId}/`);
      if (!isOrgFile) {
        throw new Error('文件权限验证失败');
      }

      // 创建附件记录
      const attachment = await prisma.noteAttachments.create({
        data: {
          organizationId: orgId,
          noteId,
          fileKey,
          fileName,
          fileType,
          fileSize,
        },
      });

      return attachment;
    } catch (error) {
      console.error('Error adding attachment:', error);
      throw error;
    }
  },
);

/**
 * 获取笔记的附件列表
 */
export const getNoteAttachments = withUserAuth('notes/getNoteAttachments', async ({ orgId, args }: AuthWrapperContext<{ noteId: string }>) => {
  const { noteId } = args;

  try {
    const attachments = await prisma.noteAttachments.findMany({
      where: {
        noteId,
        organizationId: orgId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return attachments;
  } catch (error) {
    console.error('Error getting attachments:', error);
    throw error;
  }
});

/**
 * 删除附件
 */
export const deleteAttachment = withUserAuth('notes/deleteAttachment', async ({ orgId, args }: AuthWrapperContext<{ attachmentId: string }>) => {
  const { attachmentId } = args;

  try {
    const attachment = await prisma.noteAttachments.findUnique({
      where: {
        id: attachmentId,
        organizationId: orgId,
      },
    });

    if (!attachment) {
      throw new Error('附件不存在');
    }

    // 删除 OSS 文件
    try {
      await storage.delete(attachment.fileKey);
    } catch (error) {
      console.error('Failed to delete file from OSS:', error);
      // 继续删除数据库记录，即使 OSS 删除失败
    }

    // 删除数据库记录
    await prisma.noteAttachments.delete({
      where: { id: attachmentId },
    });

    return;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    throw error;
  }
});
