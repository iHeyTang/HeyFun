'use client';
import { listAgentTools, listToolSchemas } from '@/actions/tools';
import { Search } from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import { ToolInfoDialog, ToolInfoDialogRef } from './_components/tool-info-dialog';
import { ToolCard } from './_components/tool-card';
import { useServerAction } from '@/hooks/use-async';
import { ToolSchemas } from '@prisma/client';
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
        const isInstalled = installedTools.some(installed => {
          // 通过 schema.id 匹配
          if (installed.schema?.id === tool.id) {
            return true;
          }
          // 通过 name 匹配
          if (installed.name === tool.name) {
            return true;
          }
          return false;
        });
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredTools.map(tool => (
          <ToolCard
            key={tool.name}
            tool={tool}
            installed={installedTools.some(installed => {
              // 通过 schema.id 匹配
              if (installed.schema?.id === tool.id) {
                return true;
              }
              // 通过 name 匹配
              if (installed.name === tool.name) {
                return true;
              }
              return false;
            })}
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
