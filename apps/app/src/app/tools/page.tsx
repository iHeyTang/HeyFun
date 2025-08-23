'use client';
import { listAgentTools, listToolSchemas } from '@/actions/tools';
import { Sparkles, Search, Filter } from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import { ToolInfoDialog, ToolInfoDialogRef } from './_components/tool-info-dialog';
import { ToolRegisterDialog, ToolRegisterDialogRef } from './_components/tool-register-dialog';
import { useServerAction } from '@/hooks/use-async';
import { ToolSchemas } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MarketplacePage() {
  const { data: schemas = [], refresh: refreshSchemas } = useServerAction(listToolSchemas, {}, { cache: 'all-tools' });
  const { data: installedTools = [], refresh: refreshInstalledTools } = useServerAction(listAgentTools, {}, { cache: 'installed-tools' });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const toolInfoDialogRef = useRef<ToolInfoDialogRef>(null);
  const toolRegisterDialogRef = useRef<ToolRegisterDialogRef>(null);

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
      <div className="mt-8 mb-8 flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <h1 className="relative z-10 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-center text-4xl font-bold tracking-tight text-transparent">
            Tools Market
          </h1>
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
            <Sparkles className="h-8 w-8 animate-pulse text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
      <div className="mb-4 text-sm text-gray-600">
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
          <h3 className="mb-2 text-lg font-medium text-gray-600">No tools found</h3>
          <p className="max-w-sm text-sm text-gray-500">Try adjusting your search query or filter criteria to find the tools you're looking for.</p>
        </div>
      )}

      <ToolInfoDialog ref={toolInfoDialogRef} onConfigSuccess={handleConfigSuccess} />
      <ToolRegisterDialog ref={toolRegisterDialogRef} onSuccess={handleRegisterSuccess} />
    </div>
  );
}

const ToolItem = ({ tool, installed, onShowInfo }: { tool: ToolSchemas; installed: boolean; onShowInfo: () => void }) => {
  return (
    <div className="bg-silver-gradient border-muted flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-all" onClick={onShowInfo}>
      <div className="flex items-center justify-between">
        <span className="line-clamp-1 font-semibold transition-colors">{tool.name}</span>
        {installed && (
          <Badge variant="secondary" className="bg-green-100 text-xs text-green-800">
            Installed
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs break-all transition-colors">{tool.description}</p>
    </div>
  );
};
