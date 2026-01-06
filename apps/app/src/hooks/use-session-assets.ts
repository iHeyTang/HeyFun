'use client';

import { getSessionAssets } from '@/actions/assets';
import { useState, useEffect } from 'react';

export function useSessionAssets(sessionId: string | undefined, options?: { enabled?: boolean }) {
  const [data, setData] = useState<{ assets: any[]; total: number; page: number; pageSize: number } | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (options?.enabled === false || !sessionId) {
      return;
    }

    let cancelled = false;

    const fetchAssets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getSessionAssets({ sessionId });
        if (!cancelled) {
          if (result.error) {
            setError(new Error(result.error));
          } else if (result.data) {
            // getSessionAssets 返回的是 { assets, total, page, pageSize }
            setData({
              assets: result.data.assets || [],
              total: result.data.total || 0,
              page: result.data.page || 1,
              pageSize: result.data.pageSize || 20,
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch assets'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAssets();

    return () => {
      cancelled = true;
    };
  }, [sessionId, options?.enabled]);

  return { data, isLoading, error };
}
