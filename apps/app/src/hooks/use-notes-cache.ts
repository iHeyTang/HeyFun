import { useCallback, useRef } from 'react';
import { create } from 'zustand';
import type { NoteWithRelations, FolderWithStats, TagWithStats } from '@/actions/notes';

// 缓存项接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// 缓存存储接口
interface NotesCacheStore {
  // 笔记列表缓存 (key: queryKey, value: NoteWithRelations[])
  notesListCache: Map<string, CacheItem<NoteWithRelations[]>>;
  // 单个笔记缓存 (key: noteId, value: NoteWithRelations)
  noteCache: Map<string, CacheItem<NoteWithRelations>>;
  // 文件夹列表缓存
  foldersCache: CacheItem<FolderWithStats[]> | null;
  // 标签列表缓存
  tagsCache: CacheItem<TagWithStats[]> | null;

  // 获取笔记列表缓存
  getNotesList: (queryKey: string) => NoteWithRelations[] | null;
  // 设置笔记列表缓存
  setNotesList: (queryKey: string, notes: NoteWithRelations[]) => void;

  // 获取单个笔记缓存
  getNote: (noteId: string) => NoteWithRelations | null;
  // 设置单个笔记缓存
  setNote: (noteId: string, note: NoteWithRelations) => void;

  // 获取文件夹列表缓存
  getFolders: () => FolderWithStats[] | null;
  // 设置文件夹列表缓存
  setFolders: (folders: FolderWithStats[]) => void;

  // 获取标签列表缓存
  getTags: () => TagWithStats[] | null;
  // 设置标签列表缓存
  setTags: (tags: TagWithStats[]) => void;

  // 清除单个笔记缓存
  clearNote: (noteId: string) => void;
  // 清除笔记列表缓存（当笔记被创建/更新/删除时）
  clearNotesList: () => void;
  // 清除所有缓存
  clearAll: () => void;
}

// 默认缓存过期时间（毫秒）
const DEFAULT_TTL = 5 * 60 * 1000; // 5分钟
const NOTE_TTL = 10 * 60 * 1000; // 单个笔记缓存10分钟
const FOLDERS_TTL = 30 * 60 * 1000; // 文件夹和标签缓存30分钟

// 生成查询键
const generateQueryKey = (params: {
  search?: string;
  folderId?: string | null;
  tagIds?: string[];
  page?: number;
  pageSize?: number;
}) => {
  const { search, folderId, tagIds, page = 1, pageSize = 50 } = params;
  const parts = [
    `page:${page}`,
    `size:${pageSize}`,
    folderId ? `folder:${folderId}` : 'folder:null',
    tagIds && tagIds.length > 0 ? `tags:${tagIds.sort().join(',')}` : 'tags:[]',
    search ? `search:${search}` : 'search:',
  ];
  return parts.join('|');
};

// 检查缓存是否过期
const isExpired = <T>(item: CacheItem<T> | null): boolean => {
  if (!item) return true;
  return Date.now() > item.expiresAt;
};

// 创建缓存项
const createCacheItem = <T>(data: T, ttl: number): CacheItem<T> => {
  const now = Date.now();
  return {
    data,
    timestamp: now,
    expiresAt: now + ttl,
  };
};

export const useNotesCacheStore = create<NotesCacheStore>((set, get) => ({
  notesListCache: new Map(),
  noteCache: new Map(),
  foldersCache: null,
  tagsCache: null,

  getNotesList: (queryKey: string) => {
    const cache = get().notesListCache.get(queryKey);
    if (cache && !isExpired(cache)) {
      return cache.data;
    }
    if (cache) {
      // 缓存过期，删除
      get().notesListCache.delete(queryKey);
    }
    return null;
  },

  setNotesList: (queryKey: string, notes: NoteWithRelations[]) => {
    set(state => {
      const newCache = new Map(state.notesListCache);
      newCache.set(queryKey, createCacheItem(notes, DEFAULT_TTL));
      return { notesListCache: newCache };
    });
  },

  getNote: (noteId: string) => {
    const cache = get().noteCache.get(noteId);
    if (cache && !isExpired(cache)) {
      return cache.data;
    }
    if (cache) {
      // 缓存过期，删除
      get().noteCache.delete(noteId);
    }
    return null;
  },

  setNote: (noteId: string, note: NoteWithRelations) => {
    set(state => {
      const newCache = new Map(state.noteCache);
      newCache.set(noteId, createCacheItem(note, NOTE_TTL));
      return { noteCache: newCache };
    });
  },

  getFolders: () => {
    const cache = get().foldersCache;
    if (cache && !isExpired(cache)) {
      return cache.data;
    }
    return null;
  },

  setFolders: (folders: FolderWithStats[]) => {
    set({ foldersCache: createCacheItem(folders, FOLDERS_TTL) });
  },

  getTags: () => {
    const cache = get().tagsCache;
    if (cache && !isExpired(cache)) {
      return cache.data;
    }
    return null;
  },

  setTags: (tags: TagWithStats[]) => {
    set({ tagsCache: createCacheItem(tags, FOLDERS_TTL) });
  },

  clearNote: (noteId: string) => {
    set(state => {
      const newCache = new Map(state.noteCache);
      newCache.delete(noteId);
      return { noteCache: newCache };
    });
    // 清除笔记后，也需要清除相关的列表缓存
    get().clearNotesList();
  },

  clearNotesList: () => {
    set({ notesListCache: new Map() });
  },

  clearAll: () => {
    set({
      notesListCache: new Map(),
      noteCache: new Map(),
      foldersCache: null,
      tagsCache: null,
    });
  },
}));

/**
 * 笔记缓存 Hook
 * 提供笔记相关的缓存管理功能
 */
export const useNotesCache = () => {
  const store = useNotesCacheStore();

  // 生成查询键的辅助函数
  const getQueryKey = useCallback(
    (params: {
      search?: string;
      folderId?: string | null;
      tagIds?: string[];
      page?: number;
      pageSize?: number;
    }) => {
      return generateQueryKey(params);
    },
    [],
  );

  return {
    // 笔记列表缓存
    getNotesList: store.getNotesList,
    setNotesList: store.setNotesList,
    getQueryKey,

    // 单个笔记缓存
    getNote: store.getNote,
    setNote: store.setNote,

    // 文件夹缓存
    getFolders: store.getFolders,
    setFolders: store.setFolders,

    // 标签缓存
    getTags: store.getTags,
    setTags: store.setTags,

    // 清除缓存
    clearNote: store.clearNote,
    clearNotesList: store.clearNotesList,
    clearAll: store.clearAll,
  };
};

