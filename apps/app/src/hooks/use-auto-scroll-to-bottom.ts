import { useCallback, useEffect, useRef } from 'react';

interface UseAutoScrollToBottomOptions {
  /** 滚动容器的 ref */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 触发自动滚动的依赖项（通常是消息数量或内容） */
  trigger?: unknown;
  /** 距离底部多少像素内算作"在底部" */
  threshold?: number;
  /** 是否启用自动滚动 */
  enabled?: boolean;
}

/**
 * 自动滚动到底部的 Hook
 */
export function useAutoScrollToBottom({ containerRef, trigger, threshold = 100, enabled = true }: UseAutoScrollToBottomOptions) {
  // 自动滚动标识位：默认开启自动滚动
  const autoScrollEnabledRef = useRef(true);
  // 是否正在程序自动滚动（用于区分用户滚动和程序滚动）
  const isProgramScrollingRef = useRef(false);
  // 滚动事件防抖定时器
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 检查是否在底部（在阈值内）
   */
  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= threshold;
  }, [containerRef, threshold]);

  /**
   * 滚动到底部（程序自动滚动）
   */
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // 标记正在程序滚动
    isProgramScrollingRef.current = true;

    // 使用即时滚动，确保能跟上快速的内容更新
    container.scrollTop = container.scrollHeight;

    // 短暂延迟后重置程序滚动标记
    // 使用 requestAnimationFrame 确保滚动已完成
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isProgramScrollingRef.current = false;
      });
    });
  }, [containerRef]);

  /**
   * 处理滚动事件（监听用户手动滚动）
   */
  const handleScroll = useCallback(() => {
    // 如果是程序自动滚动，不处理（避免误判）
    if (isProgramScrollingRef.current) return;

    // 防抖：延迟检查，避免频繁触发
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      // 再次确认不是程序滚动（防止在防抖延迟期间程序滚动开始了）
      if (isProgramScrollingRef.current) return;

      const isAtBottom = checkIsAtBottom();

      // 根据是否在底部阈值内，更新自动滚动标识位
      // 如果在底部阈值内，开启自动滚动
      // 如果不在底部阈值内，关闭自动滚动
      autoScrollEnabledRef.current = isAtBottom;
    }, 100);
  }, [checkIsAtBottom]);

  // 设置滚动监听器（监听用户手动滚动）
  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    // 添加滚动监听器
    container.addEventListener('scroll', handleScroll, { passive: true });

    // 初始化时检查是否在底部，设置自动滚动状态
    autoScrollEnabledRef.current = checkIsAtBottom();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [enabled, containerRef, handleScroll, checkIsAtBottom]);

  // 当 trigger 变化时，如果自动滚动标识位为 true，则滚动到底部
  useEffect(() => {
    if (!enabled) return;
    // 只有当自动滚动标识位为 true 时才自动滚动
    if (!autoScrollEnabledRef.current) return;

    // 使用 requestAnimationFrame 确保 DOM 已更新后再滚动
    const rafId = requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [trigger, enabled, scrollToBottom]);

  // 返回手动滚动到底部的方法（供外部调用）
  return {
    scrollToBottom,
  };
}
