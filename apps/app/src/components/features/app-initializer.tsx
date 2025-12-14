'use client';

import { useLLM } from '@/hooks/use-llm';
import { usePreferences } from '@/hooks/use-preferences';
import { useEffect } from 'react';

/**
 * AppInitializer 组件
 * 在应用启动时初始化全局数据（模型列表和用户偏好）
 * 这个组件应该在应用的根布局中使用，确保数据在应用启动时就被加载
 */
export function AppInitializer() {
  const { initiate } = useLLM();
  const { loadPreferences } = usePreferences();

  useEffect(() => {
    // 初始化模型列表和用户偏好
    initiate();
    loadPreferences();
  }, [initiate, loadPreferences]);

  // 这个组件不渲染任何内容
  return null;
}

