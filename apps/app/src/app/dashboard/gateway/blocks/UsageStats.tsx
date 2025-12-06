'use client';

import { getUsageStats } from '@/actions/gateway';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Loader2, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface UsageStatsProps {
  refreshTrigger?: number;
}

export function UsageStats({ refreshTrigger }: UsageStatsProps) {
  const t = useTranslations('gateway');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadStats();
  }, [timeRange, refreshTrigger]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1d':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const result = await getUsageStats({
        startDate,
        endDate,
      });

      if (result.data) {
        setStats(result.data);
      } else {
        toast.error(result.error || t('toast.loadStatsFailed'));
      }
    } catch (error) {
      toast.error(t('toast.loadStatsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="bg-card/50 hover:border-border hover:bg-card/80 w-[160px] text-[13px] backdrop-blur-sm transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d" className="text-[13px]">
              {t('timeRange.1d')}
            </SelectItem>
            <SelectItem value="7d" className="text-[13px]">
              {t('timeRange.7d')}
            </SelectItem>
            <SelectItem value="30d" className="text-[13px]">
              {t('timeRange.30d')}
            </SelectItem>
            <SelectItem value="90d" className="text-[13px]">
              {t('timeRange.90d')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="group relative w-full cursor-default select-none rounded-lg bg-muted/30 px-4 py-3 text-left transition-all hover:bg-muted">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[12px]">{t('stats.totalRequests')}</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{formatNumber(stats.totalRequests)}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fafafa] shadow">
                <BarChart3 className="text-foreground h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="group relative w-full cursor-default select-none rounded-lg bg-muted/30 px-4 py-3 text-left transition-all hover:bg-muted">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[12px]">{t('stats.totalTokens')}</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{formatNumber(stats.totalTokens)}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fafafa] shadow">
                <TrendingUp className="text-foreground h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="group relative w-full cursor-default select-none rounded-lg bg-muted/30 px-4 py-3 text-left transition-all hover:bg-muted">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[12px]">{t('stats.inputTokens')}</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{formatNumber(stats.totalInputTokens)}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fafafa] shadow">
                <TrendingUp className="text-foreground h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="group relative w-full cursor-default select-none rounded-lg bg-muted/30 px-4 py-3 text-left transition-all hover:bg-muted">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[12px]">{t('stats.outputTokens')}</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{formatNumber(stats.totalOutputTokens)}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fafafa] shadow">
                <TrendingUp className="text-foreground h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Stats */}
      {stats && stats.modelStats && stats.modelStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-medium">{t('modelStats.title')}</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(500px,1fr))] gap-3">
            {stats.modelStats.map((model: any) => (
              <div
                key={model.modelId}
                className="group relative w-full cursor-default select-none rounded-lg bg-muted/30 px-4 py-3 text-left transition-all hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fafafa] shadow">
                      <BarChart3 className="text-foreground h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="text-foreground text-[14px] font-medium">{model.modelId}</div>
                      <div className="text-muted-foreground flex items-center text-[11px]">
                        <span>
                          {t('modelStats.requests')}: {formatNumber(model.requests)}
                        </span>
                        <span className="mx-1">·</span>
                        <span>
                          {t('modelStats.tokens')}: {formatNumber(model.totalTokens)}
                        </span>
                        {model.errors > 0 && (
                          <>
                            <span className="mx-1">·</span>
                            <span>
                              {t('modelStats.errors')}: {model.errors}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {stats && stats.totalRequests === 0 && (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground text-[13px]">{t('emptyState.usage')}</p>
        </div>
      )}
    </div>
  );
}

