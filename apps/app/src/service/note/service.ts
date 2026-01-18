/**
 * Note Server - 业务服务层
 * 提供笔记相关的核心业务逻辑，供 action、route、tools 调用
 */

import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { nanoid } from 'nanoid';
import {
  CreateNoteInput,
  UpdateNoteInput,
  EditNoteInput,
  NotesListQuery,
  NotesListResponse,
  NotesTreeNode,
  NotesTreeResponse,
  NoteWithRelations,
  FolderWithStats,
  CreateFolderInput,
  UpdateFolderInput,
  CreateTagInput,
  UpdateTagInput,
  EditNoteResult,
  CreateNoteResult,
} from './types';
import { extractTextFromMarkdown, calculateContentHash, applyEdits } from './utils';

// ============================================
// Notes CRUD
// ============================================

/**
 * 创建笔记
 */
export async function createNote(orgId: string, input: CreateNoteInput): Promise<CreateNoteResult> {
  const { title, content, folderId, tagIds = [] } = input;

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

  // 验证文件夹存在（如果提供了 folderId）
  if (folderId) {
    const folder = await prisma.noteFolders.findUnique({
      where: {
        id: folderId,
        organizationId: orgId,
      },
    });
    if (!folder) {
      throw new Error('Folder not found');
    }
  }

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

  return { note, contentKey };
}

/**
 * 获取笔记列表
 */
export async function getNotes(orgId: string, query: NotesListQuery = {}): Promise<NotesListResponse> {
  const { page = 1, pageSize = 20, folderId, tagIds = [], search, isPinned, isStarred, isArchived, orderBy = 'updatedAt', order = 'desc' } = query;

  const where: any = {
    organizationId: orgId,
    isDeleted: false,
  };

  // 文件夹筛选
  if (folderId !== undefined) {
    if (folderId === null) {
      where.folderId = null;
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
}

/**
 * 获取笔记树
 */
export async function getNotesTree(orgId: string): Promise<NotesTreeResponse> {
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

  // 递归排序
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
}

/**
 * 获取单个笔记
 */
export async function getNote(orgId: string, noteId: string, includeContent: boolean = true) {
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
    return null;
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
}

/**
 * 更新笔记
 */
export async function updateNote(orgId: string, noteId: string, input: UpdateNoteInput) {
  const { title, content, folderId, isPinned, isStarred, isArchived, tagIds } = input;

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

  // 如果更新文件夹，验证目标文件夹归属
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

    if (contentHash !== existingNote.contentHash) {
      const newContentKey = `${orgId}/notes/${Date.now()}_${nanoid(8)}.md`;

      await storage.put(newContentKey, Buffer.from(content, 'utf-8'), {
        contentType: 'text/markdown',
      });

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
    await prisma.noteTagRelations.deleteMany({
      where: { noteId },
    });

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

  // 返回更新后的笔记
  return getNote(orgId, noteId);
}

/**
 * 编辑笔记（支持 diff）
 */
export async function editNote(orgId: string, input: EditNoteInput): Promise<EditNoteResult> {
  const { noteId, title, edits, fullContent } = input;

  // 获取现有笔记
  const existingNote = await prisma.notes.findUnique({
    where: {
      id: noteId,
      organizationId: orgId,
      isDeleted: false,
    },
  });

  if (!existingNote) {
    throw new Error('Note not found');
  }

  // 读取现有内容
  let currentContent: string = '';
  try {
    const contentBuffer = await storage.getBytes(existingNote.contentKey);
    if (contentBuffer) {
      currentContent = Buffer.from(contentBuffer).toString('utf-8');
    }
  } catch (error) {
    throw new Error('Failed to read current note content');
  }

  // 确定新内容
  let newContent: string = currentContent;
  let editCount = 0;
  let failedEdits: Array<{ oldText: string; reason: string }> = [];

  if (fullContent !== undefined) {
    // 覆盖模式
    newContent = fullContent;
    editCount = 1;
  } else if (edits && edits.length > 0) {
    // diff 模式
    const result = applyEdits(currentContent, edits);
    newContent = result.newContent;
    editCount = result.successCount;
    failedEdits = result.failedEdits;

    if (editCount === 0 && failedEdits.length > 0) {
      throw new Error('All edit operations failed');
    }
  }

  // 准备更新数据
  const updateData: any = {};

  if (title !== undefined) {
    updateData.title = title.trim();
  }

  // 如果内容有变化，上传新内容到 OSS
  const contentChanged = newContent !== currentContent;
  let newContentKey: string | undefined;

  if (contentChanged) {
    const contentHash = calculateContentHash(newContent);

    if (contentHash !== existingNote.contentHash) {
      const contentText = extractTextFromMarkdown(newContent);
      newContentKey = `${orgId}/notes/${Date.now()}_${nanoid(8)}.md`;

      await storage.put(newContentKey, Buffer.from(newContent, 'utf-8'), {
        contentType: 'text/markdown',
      });

      updateData.contentKey = newContentKey;
      updateData.contentHash = contentHash;
      updateData.contentText = contentText;
    }
  }

  // 如果没有任何更新
  if (Object.keys(updateData).length === 0 && !contentChanged) {
    return {
      noteId: existingNote.id,
      title: existingNote.title,
      editCount: 0,
    };
  }

  // 更新笔记
  const updatedNote = await prisma.notes.update({
    where: { id: noteId },
    data: updateData,
  });

  const result: EditNoteResult = {
    noteId: updatedNote.id,
    title: updatedNote.title,
    editCount,
    contentKey: newContentKey,
  };

  if (failedEdits.length > 0) {
    result.failedEdits = failedEdits;
  }

  return result;
}

/**
 * 删除笔记
 */
export async function deleteNote(orgId: string, noteId: string, permanent: boolean = false) {
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
    await prisma.notes.delete({
      where: { id: noteId },
    });
  } else {
    await prisma.notes.update({
      where: { id: noteId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

// ============================================
// Folders CRUD
// ============================================

/**
 * 创建文件夹
 */
export async function createFolder(orgId: string, input: CreateFolderInput) {
  const { name, parentId } = input;

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

  return prisma.noteFolders.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      parentId: parentId || null,
    },
  });
}

/**
 * 获取文件夹列表
 */
export async function getFolders(orgId: string) {
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
}

/**
 * 更新文件夹
 */
export async function updateFolder(orgId: string, folderId: string, input: UpdateFolderInput) {
  const { name, parentId, order } = input;

  const existingFolder = await prisma.noteFolders.findUnique({
    where: {
      id: folderId,
      organizationId: orgId,
    },
  });

  if (!existingFolder) {
    throw new Error('文件夹不存在');
  }

  if (parentId && parentId === folderId) {
    throw new Error('不能将文件夹移动到自身');
  }

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

    const isDescendant = await checkFolderDescendant(orgId, folderId, parentId);
    if (isDescendant) {
      throw new Error('不能将文件夹移动到自己的子文件夹');
    }
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name.trim();
  if (parentId !== undefined) updateData.parentId = parentId || null;
  if (order !== undefined) updateData.order = order;

  return prisma.noteFolders.update({
    where: { id: folderId },
    data: updateData,
  });
}

/**
 * 删除文件夹
 */
export async function deleteFolder(orgId: string, folderId: string, moveNotesTo?: string | null) {
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

  if (existingFolder._count.children > 0) {
    throw new Error('请先删除子文件夹');
  }

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

  await prisma.noteFolders.delete({
    where: { id: folderId },
  });
}

// ============================================
// Tags CRUD
// ============================================

/**
 * 创建标签
 */
export async function createTag(orgId: string, input: CreateTagInput) {
  const { name, color } = input;

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

  return prisma.noteTags.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      color: color || null,
    },
  });
}

/**
 * 获取标签列表
 */
export async function getTags(orgId: string) {
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
}

/**
 * 更新标签
 */
export async function updateTag(orgId: string, tagId: string, input: UpdateTagInput) {
  const { name, color, order } = input;

  const existingTag = await prisma.noteTags.findUnique({
    where: {
      id: tagId,
      organizationId: orgId,
    },
  });

  if (!existingTag) {
    throw new Error('标签不存在');
  }

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

  return prisma.noteTags.update({
    where: { id: tagId },
    data: updateData,
  });
}

/**
 * 删除标签
 */
export async function deleteTag(orgId: string, tagId: string) {
  const existingTag = await prisma.noteTags.findUnique({
    where: {
      id: tagId,
      organizationId: orgId,
    },
  });

  if (!existingTag) {
    throw new Error('标签不存在');
  }

  await prisma.noteTags.delete({
    where: { id: tagId },
  });
}

// ============================================
// Attachments CRUD
// ============================================

/**
 * 添加附件
 */
export async function addAttachment(
  orgId: string,
  noteId: string,
  attachment: { fileKey: string; fileName: string; fileType: string; fileSize: number },
) {
  const { fileKey, fileName, fileType, fileSize } = attachment;

  const note = await prisma.notes.findUnique({
    where: {
      id: noteId,
      organizationId: orgId,
    },
  });

  if (!note) {
    throw new Error('笔记不存在');
  }

  const isOrgFile = fileKey.startsWith(`${orgId}/`);
  if (!isOrgFile) {
    throw new Error('文件权限验证失败');
  }

  return prisma.noteAttachments.create({
    data: {
      organizationId: orgId,
      noteId,
      fileKey,
      fileName,
      fileType,
      fileSize,
    },
  });
}

/**
 * 获取附件列表
 */
export async function getAttachments(orgId: string, noteId: string) {
  return prisma.noteAttachments.findMany({
    where: {
      noteId,
      organizationId: orgId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * 删除附件
 */
export async function deleteAttachment(orgId: string, attachmentId: string) {
  const attachment = await prisma.noteAttachments.findUnique({
    where: {
      id: attachmentId,
      organizationId: orgId,
    },
  });

  if (!attachment) {
    throw new Error('附件不存在');
  }

  try {
    await storage.delete(attachment.fileKey);
  } catch (error) {
    console.error('Failed to delete file from OSS:', error);
  }

  await prisma.noteAttachments.delete({
    where: { id: attachmentId },
  });
}

// ============================================
// Helper Functions
// ============================================

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
