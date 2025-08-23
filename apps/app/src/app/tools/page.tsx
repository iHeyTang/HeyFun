'use client';
import { listAgentTools, listToolSchemas } from '@/actions/tools';
import { Sparkles } from 'lucide-react';
import { useRef } from 'react';
import { ToolInfoDialog, ToolInfoDialogRef } from './_components/tool-info-dialog';
import { ToolRegisterDialog, ToolRegisterDialogRef } from './_components/tool-register-dialog';
import { useServerAction } from '@/hooks/use-async';
import { ToolSchemas } from '@prisma/client';
import { Badge } from '@/components/ui/badge';

export default function MarketplacePage() {
  const { data: schemas = [], refresh: refreshSchemas } = useServerAction(listToolSchemas, {}, { cache: 'all-tools' });
  const { data: installedTools = [], refresh: refreshInstalledTools } = useServerAction(listAgentTools, {}, { cache: 'installed-tools' });

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

      {/* Available Tools Section */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {schemas.map(tool => (
          <ToolItem
            key={tool.name}
            tool={tool}
            installed={installedTools.some(installed => installed.schema.id === tool.id)}
            onShowInfo={() => toolInfoDialogRef.current?.showInfo(tool)}
          />
        ))}
      </div>

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
