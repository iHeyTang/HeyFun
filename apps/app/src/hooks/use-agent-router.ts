/**
 * Agent Router Hook
 * 用于同步 session 和路由
 */

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

const AGENT_BASE_PATH = '/dashboard/agent';
const AGENT_SESSION_PATH = '/dashboard/agent/session';

/**
 * Hook for managing agent session routing
 */
export const useAgentRouter = () => {
  const router = useRouter();
  const pathname = usePathname();

  /**
   * 导航到指定的 session
   */
  const navigateToSession = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) {
        router.push(AGENT_BASE_PATH);
        return;
      }
      router.push(`${AGENT_SESSION_PATH}/${sessionId}`);
    },
    [router],
  );

  /**
   * 从当前路径提取 sessionId
   */
  const getSessionIdFromPath = useCallback((): string | null => {
    if (!pathname) return null;
    if (pathname.startsWith(AGENT_SESSION_PATH + '/')) {
      const parts = pathname.split('/');
      const sessionIdIndex = parts.indexOf('session') + 1;
      if (sessionIdIndex > 0 && sessionIdIndex < parts.length) {
        return parts[sessionIdIndex] || null;
      }
    }
    return null;
  }, [pathname]);

  /**
   * 检查当前是否在 agent 页面
   */
  const isAgentPage = useCallback((): boolean => {
    if (!pathname) return false;
    return pathname.startsWith(AGENT_BASE_PATH);
  }, [pathname]);

  return {
    navigateToSession,
    getSessionIdFromPath,
    isAgentPage,
  };
};

