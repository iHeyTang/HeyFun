'use client';

import { getUsageStats, getUsageRecords } from '@/actions/gateway';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart3, Loader2, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface UsageStatsProps {
  refreshTrigger?: number;
}

export function UsageStats({ refreshTrigger }: UsageStatsProps) {
  const t = useTranslations('gateway');
  const [stats, setStats] = useState<any>(null);
  const [records, setRecords] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');
  const [recordsPage, setRecordsPage] = useState(1);
  const recordsPageSize = 20;

  useEffect(() => {
    loadStats();
    loadRecords();
  }, [timeRange, refreshTrigger, recordsPage]);

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

  const loadRecords = async () => {
    setIsLoadingRecords(true);
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

      const result = await getUsageRecords({
        startDate,
        endDate,
        page: recordsPage,
        pageSize: recordsPageSize,
      });

      console.log('[UsageStats] getUsageRecords result:', result);

      if (result.data) {
        console.log('[UsageStats] Records data:', result.data);
        setRecords(result.data);
      } else {
        console.error('[UsageStats] Failed to load records:', result.error);
        toast.error(result.error || t('toast.loadRecordsFailed'));
      }
    } catch (error) {
      toast.error(t('toast.loadRecordsFailed'));
    } finally {
      setIsLoadingRecords(false);
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

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
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
          <div className="bg-muted/30 hover:bg-muted group relative w-full cursor-default select-none rounded-lg px-4 py-3 text-left transition-all">
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

          <div className="bg-muted/30 hover:bg-muted group relative w-full cursor-default select-none rounded-lg px-4 py-3 text-left transition-all">
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

          <div className="bg-muted/30 hover:bg-muted group relative w-full cursor-default select-none rounded-lg px-4 py-3 text-left transition-all">
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

          <div className="bg-muted/30 hover:bg-muted group relative w-full cursor-default select-none rounded-lg px-4 py-3 text-left transition-all">
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
                className="bg-muted/30 hover:bg-muted group relative w-full cursor-default select-none rounded-lg px-4 py-3 text-left transition-all"
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

      {/* Usage Records List */}
      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-medium">{t('records.title')}</h3>
        {isLoadingRecords ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : records?.records && records.records.length > 0 ? (
          <>
            <div className="bg-muted/30 overflow-hidden rounded-lg">
              <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted/95 sticky top-0 z-10 backdrop-blur-sm">
                    <tr className="border-border/50 border-b">
                      <th className="text-muted-foreground px-4 py-3 text-left text-[12px] font-medium">{t('records.time')}</th>
                      <th className="text-muted-foreground px-4 py-3 text-left text-[12px] font-medium">{t('records.model')}</th>
                      <th className="text-muted-foreground px-4 py-3 text-left text-[12px] font-medium">{t('records.endpoint')}</th>
                      <th className="text-muted-foreground px-4 py-3 text-right text-[12px] font-medium">{t('records.inputTokens')}</th>
                      <th className="text-muted-foreground px-4 py-3 text-right text-[12px] font-medium">{t('records.outputTokens')}</th>
                      <th className="text-muted-foreground px-4 py-3 text-right text-[12px] font-medium">{t('records.totalTokens')}</th>
                      <th className="text-muted-foreground px-4 py-3 text-right text-[12px] font-medium">{t('records.responseTime')}</th>
                      <th className="text-muted-foreground px-4 py-3 text-center text-[12px] font-medium">{t('records.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.records.map((record: any) => (
                      <tr key={record.id} className="border-border/30 hover:bg-muted/50 border-b transition-colors">
                        <td className="text-foreground px-4 py-3 text-[12px]">{formatDate(record.createdAt)}</td>
                        <td className="text-foreground px-4 py-3 font-mono text-[12px]">{record.modelId}</td>
                        <td className="text-foreground px-4 py-3 font-mono text-[12px]">{record.endpoint}</td>
                        <td className="text-foreground px-4 py-3 text-right text-[12px]">{formatNumber(record.inputTokens)}</td>
                        <td className="text-foreground px-4 py-3 text-right text-[12px]">{formatNumber(record.outputTokens)}</td>
                        <td className="text-foreground px-4 py-3 text-right text-[12px] font-medium">{formatNumber(record.totalTokens)}</td>
                        <td className="text-muted-foreground px-4 py-3 text-right text-[12px]">{formatDuration(record.responseTime)}</td>
                        <td className="px-4 py-3 text-center">
                          {record.statusCode ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                record.statusCode >= 400
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  : record.statusCode >= 300
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              }`}
                            >
                              {record.statusCode}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Pagination */}
            {records.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-[12px]">
                  {t('records.pagination', {
                    current: recordsPage,
                    total: records.totalPages,
                    count: records.total,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecordsPage(p => Math.max(1, p - 1))}
                    disabled={recordsPage === 1}
                    className="h-8 text-[12px]"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    {t('records.prev')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecordsPage(p => Math.min(records.totalPages, p + 1))}
                    disabled={recordsPage >= records.totalPages}
                    className="h-8 text-[12px]"
                  >
                    {t('records.next')}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-[13px]">{t('emptyState.records')}</p>
          </div>
        )}
      </div>

      {stats && stats.totalRequests === 0 && (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground text-[13px]">{t('emptyState.usage')}</p>
        </div>
      )}
    </div>
  );
}
