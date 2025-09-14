import { create } from 'zustand';

/**
 * Signed URL 缓存 Store (底层实现)
 * 
 * 功能特性：
 * 1. 本地缓存：避免重复请求相同的文件
 * 2. 防重复请求：同时请求相同文件时，共享同一个 Promise
 * 3. 过期管理：自动处理 URL 过期，默认 1 小时
 * 4. 错误处理：记录和获取错误状态
 * 5. 类型安全：完整的 TypeScript 类型定义
 * 
 * 使用示例：
 * ```tsx
 * const { getSignedUrl, setSignedUrl, clearCache, getError } = useSignedUrlStore();
 * 
 * // 获取签名 URL（自动缓存）
 * const url = await getSignedUrl('file-key');
 * 
 * // 手动设置 URL（预加载）
 * setSignedUrl('file-key', 'https://...', 3600);
 * 
 * // 清除特定缓存
 * clearCache('file-key');
 * 
 * // 获取错误信息
 * const error = getError('file-key');
 * ```
 */

interface SignedUrlCache {
  url: string;
  expiresAt: number;
}

interface SignedUrlState {
  // 缓存已获取的 URL
  signedUrlMap: Map<string, SignedUrlCache>;
  // 正在进行的请求，避免重复请求
  pendingRequests: Map<string, Promise<string>>;
  // 错误状态
  errors: Map<string, string>;
}

interface SignedUrlActions {
  // 获取签名 URL，支持缓存和防重复请求
  getSignedUrl: (fileKey: string) => Promise<string>;
  // 手动设置 URL（用于预加载）
  setSignedUrl: (fileKey: string, url: string, expiresIn?: number) => void;
  // 清除特定缓存
  clearCache: (fileKey: string) => void;
  // 清除所有缓存
  clearAllCache: () => void;
  // 获取错误信息
  getError: (fileKey: string) => string | undefined;
}

export const useSignedUrlStore = create<SignedUrlState & SignedUrlActions>((set, get) => ({
  signedUrlMap: new Map(),
  pendingRequests: new Map(),
  errors: new Map(),

  getSignedUrl: async (fileKey: string) => {
    const state = get();
    
    // 检查缓存中是否已有有效的 URL
    const cached = state.signedUrlMap.get(fileKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    // 检查是否已有正在进行的请求
    const pendingRequest = state.pendingRequests.get(fileKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // 创建新的请求
    const requestPromise = (async () => {
      try {
        // 清除之前的错误
        set(state => ({
          errors: new Map(state.errors).set(fileKey, ''),
        }));

        // 动态导入 getSignedUrl action
        const { getSignedUrl: getSignedUrlAction } = await import('@/actions/oss');
        const result = await getSignedUrlAction({ fileKey });
        
        // 处理 action 的返回结果
        const url = typeof result === 'string' ? result : result.data;
        if (!url) {
          throw new Error(typeof result === 'string' ? 'Unknown error' : result.error);
        }
        
        // 缓存 URL，默认 1 小时过期
        const expiresAt = Date.now() + 3600 * 1000;
        const newPendingRequests = new Map(state.pendingRequests);
        newPendingRequests.delete(fileKey);
        
        set(state => ({
          signedUrlMap: new Map(state.signedUrlMap).set(fileKey, { url, expiresAt }),
          pendingRequests: newPendingRequests,
        }));

        return url;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // 记录错误
        const newPendingRequests = new Map(state.pendingRequests);
        newPendingRequests.delete(fileKey);
        
        set(state => ({
          errors: new Map(state.errors).set(fileKey, errorMessage),
          pendingRequests: newPendingRequests,
        }));

        throw error;
      }
    })();

    // 记录正在进行的请求
    set(state => ({
      pendingRequests: new Map(state.pendingRequests).set(fileKey, requestPromise),
    }));

    return requestPromise;
  },

  setSignedUrl: (fileKey: string, url: string, expiresIn: number = 3600) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    set(state => ({
      signedUrlMap: new Map(state.signedUrlMap).set(fileKey, { url, expiresAt }),
    }));
  },

  clearCache: (fileKey: string) => {
    set(state => {
      const newMap = new Map(state.signedUrlMap);
      newMap.delete(fileKey);
      return { signedUrlMap: newMap };
    });
  },

  clearAllCache: () => {
    set({
      signedUrlMap: new Map(),
      pendingRequests: new Map(),
      errors: new Map(),
    });
  },

  getError: (fileKey: string) => {
    return get().errors.get(fileKey);
  },
}));

/**
 * 高级 Signed URL Hook (推荐使用)
 * 
 * 这是一个更简洁的 API，自动处理缓存逻辑：
 * - 自动检查缓存，有缓存直接返回
 * - 无缓存时自动获取并存入缓存
 * - 防重复请求，相同文件同时请求时共享 Promise
 * - 自动处理过期和错误
 * 
 * 使用示例：
 * ```tsx
 * const { getSignedUrl, isLoading, error, clearCache } = useSignedUrl();
 * 
 * // 简单获取 URL，自动处理缓存
 * const url = await getSignedUrl('file-key');
 * 
 * // 检查加载状态
 * if (isLoading('file-key')) {
 *   return <div>Loading...</div>;
 * }
 * 
 * // 检查错误
 * const errorMsg = error('file-key');
 * if (errorMsg) {
 *   return <div>Error: {errorMsg}</div>;
 * }
 * ```
 */
export const useSignedUrl = () => {
  const store = useSignedUrlStore();
  
  return {
    /**
     * 获取签名 URL
     * 自动处理缓存：有缓存用缓存，无缓存获取后存入缓存
     */
    getSignedUrl: store.getSignedUrl,
    
    /**
     * 检查指定文件是否正在加载
     */
    isLoading: (fileKey: string) => {
      return store.pendingRequests.has(fileKey);
    },
    
    /**
     * 获取指定文件的错误信息
     */
    error: store.getError,
    
    /**
     * 清除指定文件的缓存
     */
    clearCache: store.clearCache,
    
    /**
     * 清除所有缓存
     */
    clearAllCache: store.clearAllCache,
  };
};
