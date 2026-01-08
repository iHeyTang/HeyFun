'use client';

import { getEnvironmentVariables, updateEnvironmentVariables } from '@/actions/settings';
import { useCallback } from 'react';
import { create } from 'zustand';

type EnvironmentVariablesData = Record<string, string>;

export const useEnvironmentVariablesStore = create<{
  data: EnvironmentVariablesData | undefined;
  isLoading: boolean;
  error: Error | undefined;
  initiated: boolean;
  initiating: boolean;
  loadEnvironmentVariables: () => Promise<void>;
  setEnvironmentVariables: (data: EnvironmentVariablesData | undefined) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | undefined) => void;
}>((set, get) => ({
  data: undefined,
  isLoading: false,
  error: undefined,
  initiated: false,
  initiating: false,
  loadEnvironmentVariables: async () => {
    const state = get();
    // 如果已经初始化完成或正在初始化，直接返回
    if (state.initiated || state.initiating) {
      return;
    }
    // 设置 initiating 为 true，防止并发调用
    set({ initiating: true, isLoading: true, error: undefined });
    try {
      const res = await getEnvironmentVariables({});
      const variablesData: EnvironmentVariablesData = res.data?.variables
        ? (res.data.variables as Record<string, string>)
        : {};
      set({ data: variablesData, initiated: true, initiating: false, isLoading: false });
    } catch (err) {
      set({ error: err as Error, initiated: true, initiating: false, isLoading: false });
    }
  },
  setEnvironmentVariables: (data: EnvironmentVariablesData | undefined) => {
    set({ data });
  },
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  setError: (error: Error | undefined) => {
    set({ error });
  },
}));

export const useEnvironmentVariables = () => {
  const { data, isLoading, error, loadEnvironmentVariables, setEnvironmentVariables } = useEnvironmentVariablesStore();

  const update = useCallback(
    async (variables: Record<string, string>) => {
      const res = await updateEnvironmentVariables({ variables });
      if (res.error) {
        throw new Error('Failed to update environment variables');
      }
      setEnvironmentVariables(variables);
      return res.data;
    },
    [setEnvironmentVariables],
  );

  return { data: data || {}, isLoading, error, update, loadEnvironmentVariables };
};
