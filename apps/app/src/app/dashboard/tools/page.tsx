'use client';
import { listAgentTools, listToolSchemas } from '@/actions/tools';
import { Sparkles, Search, Filter, Star, Download, ExternalLink, Tag, Plus } from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import { ToolInfoDialog, ToolInfoDialogRef } from './_components/tool-info-dialog';
import { useServerAction } from '@/hooks/use-async';
import { ToolSchemas } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';

export default function MarketplacePage() {
  const { data: schemas = [], refresh: refreshSchemas } = useServerAction(listToolSchemas, {}, { cache: 'all-tools' });
  const { data: installedTools = [], refresh: refreshInstalledTools } = useServerAction(listAgentTools, {}, { cache: 'installed-tools' });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const t = useTranslations('tools.page');

  const toolInfoDialogRef = useRef<ToolInfoDialogRef>(null);

  const handleConfigSuccess = () => {
    refreshSchemas();
    refreshInstalledTools();
  };

  const handleRegisterSuccess = () => {
    refreshSchemas();
    refreshInstalledTools();
  };

  const filteredTools = useMemo(() => {
    let filtered = schemas;

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        tool => tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || tool.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(tool => {
        const isInstalled = installedTools.some(installed => installed.schema.id === tool.id);
        return statusFilter === 'installed' ? isInstalled : !isInstalled;
      });
    }

    return filtered;
  }, [schemas, installedTools, searchQuery, statusFilter]);

  return (
    <div className="h-full w-full overflow-auto p-4">
      {/* Filter Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input placeholder={t('search.placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t('filter.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="installed">{t('filter.installed')}</SelectItem>
              <SelectItem value="not-installed">{t('filter.notInstalled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm">
        {filteredTools.length === schemas.length
          ? t('results.showing', { total: schemas.length })
          : t('results.filtered', { count: filteredTools.length, total: schemas.length })}
      </div>

      {/* Available Tools Section */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredTools.map(tool => (
          <ToolItem
            key={tool.name}
            tool={tool}
            installed={installedTools.some(installed => installed.schema.id === tool.id)}
            onShowInfo={() => toolInfoDialogRef.current?.showInfo(tool)}
            t={t}
          />
        ))}
      </div>

      {/* No Results Message */}
      {filteredTools.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="mb-2 text-lg font-medium">{t('emptyState.title')}</h3>
          <p className="max-w-sm text-sm">{t('emptyState.description')}</p>
        </div>
      )}

      <ToolInfoDialog ref={toolInfoDialogRef} onConfigSuccess={handleConfigSuccess} />
    </div>
  );
}

const ToolItem = ({ tool, installed, onShowInfo, t }: { tool: ToolSchemas; installed: boolean; onShowInfo: () => void; t: any }) => {
  const tags = Array.isArray(tool.tags) ? tool.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const capabilities = Array.isArray(tool.capabilities) ? tool.capabilities.filter((cap): cap is string => typeof cap === 'string') : [];

  return (
    <div
      className="bg-muted border-muted hover:border-border-secondary flex cursor-pointer flex-col gap-3 rounded-lg border p-2 transition-all hover:shadow-md"
      onClick={onShowInfo}
    >
      {/* Header with logo and status */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {tool.logoUrl ? (
            <img src={tool.logoUrl} alt={`${tool.name} logo`} className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="from-primary/20 to-primary/5 flex h-10 w-10 items-center justify-center rounded bg-gradient-to-br text-sm font-medium text-white">
              {tool.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-primary line-clamp-1 text-sm font-semibold">{tool.name}</span>
            {installed && (
              <Badge variant="secondary" className="bg-badge-green shrink-0 text-xs">
                {t('badge.installed')}
              </Badge>
            )}
          </div>
          {tool.author && (
            <p className="mt-0.5 text-xs">
              {t('item.by')} {tool.author}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground line-clamp-2 h-9 text-xs leading-relaxed">{tool.description}</p>

      {/* Footer stats */}
      <div className="border-border flex h-8 w-full items-center justify-between overflow-hidden border-t pt-2">
        <div className="flex items-center gap-3 text-xs">
          {tool.stars && (
            <Badge className="bg-badge-amber text-badge-amber flex items-center gap-1">
              <Star className="h-3 w-3" />
              {tool.stars > 1000 ? `${(tool.stars / 1000).toFixed(1)}k` : tool.stars}
            </Badge>
          )}
          {tool.downloads && (
            <Badge className="bg-badge-blue text-badge-blue flex items-center gap-1">
              <Download className="h-3 w-3" />
              {tool.downloads > 1000 ? `${(tool.downloads / 1000).toFixed(1)}k` : tool.downloads}
            </Badge>
          )}
          {tool.version && <Badge className="bg-badge-blue text-badge-blue font-medium">v{tool.version}</Badge>}
          {tags.length > 0 && (
            <div className="flex w-full gap-1 overflow-hidden whitespace-nowrap">
              {tags.slice(0, 3).map((tag: string, index: number) => (
                <span key={index} className="bg-secondary inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs">
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
