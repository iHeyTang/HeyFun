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

export default function MarketplacePage() {
  const { data: schemas = [], refresh: refreshSchemas } = useServerAction(listToolSchemas, {}, { cache: 'all-tools' });
  const { data: installedTools = [], refresh: refreshInstalledTools } = useServerAction(listAgentTools, {}, { cache: 'installed-tools' });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-theme-tertiary" />
          <Input
            placeholder="Search tools by name or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tools</SelectItem>
              <SelectItem value="installed">Installed</SelectItem>
              <SelectItem value="not-installed">Not Installed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-theme-secondary">
        {filteredTools.length === schemas.length
          ? `Showing all ${schemas.length} tools`
          : `Showing ${filteredTools.length} of ${schemas.length} tools`}
      </div>

      {/* Available Tools Section */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredTools.map(tool => (
          <ToolItem
            key={tool.name}
            tool={tool}
            installed={installedTools.some(installed => installed.schema.id === tool.id)}
            onShowInfo={() => toolInfoDialogRef.current?.showInfo(tool)}
          />
        ))}
      </div>

      {/* No Results Message */}
      {filteredTools.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="mb-2 text-lg font-medium text-theme-secondary">No tools found</h3>
          <p className="max-w-sm text-sm text-theme-tertiary">
            Try adjusting your search query or filter criteria to find the tools you&apos;re looking for.
          </p>
        </div>
      )}

      <ToolInfoDialog ref={toolInfoDialogRef} onConfigSuccess={handleConfigSuccess} />
    </div>
  );
}

const ToolItem = ({ tool, installed, onShowInfo }: { tool: ToolSchemas; installed: boolean; onShowInfo: () => void }) => {
  const tags = Array.isArray(tool.tags) ? tool.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const capabilities = Array.isArray(tool.capabilities) ? tool.capabilities.filter((cap): cap is string => typeof cap === 'string') : [];

  return (
    <div
      className="bg-silver-gradient border-muted flex cursor-pointer flex-col gap-3 rounded-lg border p-2 transition-all hover:border-theme-border-secondary hover:shadow-md"
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
            <span className="line-clamp-1 text-sm font-semibold text-theme-primary">{tool.name}</span>
            {installed && (
              <Badge variant="secondary" className="shrink-0 bg-theme-badge-green text-xs text-theme-badge-green">
                Installed
              </Badge>
            )}
          </div>
          {tool.author && <p className="mt-0.5 text-xs text-theme-secondary">by {tool.author}</p>}
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground line-clamp-2 h-9 text-xs leading-relaxed">{tool.description}</p>

      {/* Footer stats */}
      <div className="flex h-8 w-full items-center justify-between overflow-hidden border-t border-theme-border pt-2">
        <div className="flex items-center gap-3 text-xs text-theme-tertiary">
          {tool.stars && (
            <Badge className="flex items-center gap-1 bg-theme-badge-amber text-theme-badge-amber">
              <Star className="h-3 w-3" />
              {tool.stars > 1000 ? `${(tool.stars / 1000).toFixed(1)}k` : tool.stars}
            </Badge>
          )}
          {tool.downloads && (
            <Badge className="flex items-center gap-1 bg-theme-badge-blue text-theme-badge-blue">
              <Download className="h-3 w-3" />
              {tool.downloads > 1000 ? `${(tool.downloads / 1000).toFixed(1)}k` : tool.downloads}
            </Badge>
          )}
          {tool.version && <Badge className="bg-theme-badge-blue font-medium text-theme-badge-blue">v{tool.version}</Badge>}
          {tags.length > 0 && (
            <div className="flex w-full gap-1 overflow-hidden whitespace-nowrap">
              {tags.slice(0, 3).map((tag: string, index: number) => (
                <span key={index} className="inline-flex items-center gap-1 rounded-full bg-theme-secondary px-2 py-1 text-xs text-theme-secondary">
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
