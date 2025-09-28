import { refreshToolMetadata } from '@/actions/tools';
import { Markdown } from '@/components/block/markdown/markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToolSchemas } from '@prisma/client';
import { Download, ExternalLink, FileText, Package, RefreshCw, Star, Tag, User, Wrench } from 'lucide-react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ToolConfigDialog, ToolConfigDialogRef } from './tool-config-dialog';
import { Separator } from '@/components/ui/separator';

export interface ToolInfoDialogRef {
  showInfo: (tool: ToolSchemas) => void;
}

interface ToolInfoDialogProps {
  onConfigSuccess: () => void;
}

export const ToolInfoDialog = forwardRef<ToolInfoDialogRef, ToolInfoDialogProps>((props, ref) => {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<ToolSchemas>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toolConfigDialogRef = useRef<ToolConfigDialogRef>(null);

  useImperativeHandle(ref, () => ({
    showInfo: (tool: ToolSchemas) => {
      setTool(tool);
      setOpen(true);
    },
  }));

  const handleRefreshMetadata = async () => {
    if (!tool || (!tool.repoUrl && !tool.sourceUrl)) {
      toast.error('No repository URL available for this tool');
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshToolMetadata({ toolId: tool.id });
      toast.success('Tool metadata updated successfully');
      // Refresh the tool data
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      toast.error('Failed to refresh metadata', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!tool) {
    return null;
  }

  const tags = Array.isArray(tool.tags) ? tool.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const capabilities = Array.isArray(tool.capabilities) ? tool.capabilities.filter((cap): cap is string => typeof cap === 'string') : [];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90vh] w-[90vw] flex-col overflow-hidden" style={{ maxWidth: '800px' }} showCloseButton={false}>
          {/* Header */}
          <DialogHeader className="mb-2">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {tool.logoUrl ? (
                  <img src={tool.logoUrl} alt={`${tool.name} logo`} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="from-primary/50 to-primary/80 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br text-xl font-bold text-white">
                    {tool.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="mb-1 flex items-baseline gap-2 text-lg font-bold">
                  <div>{tool.name}</div>
                  {tool.author && (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm font-normal">
                      <span>by {tool.author}</span>
                    </div>
                  )}
                </DialogTitle>

                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  {tool.version && <Badge variant="outline">v{tool.version}</Badge>}
                  {tool.stars && (
                    <Badge className="flex items-center gap-1 bg-badge-amber text-badge-amber">
                      <Star className="h-3 w-3" />
                      {tool.stars > 1000 ? `${(tool.stars / 1000).toFixed(1)}k` : tool.stars}
                    </Badge>
                  )}
                  {tool.downloads && (
                    <Badge className="flex items-center gap-1 bg-badge-blue text-badge-blue">
                      <Download className="h-3 w-3" />
                      {tool.downloads > 1000 ? `${(tool.downloads / 1000).toFixed(1)}k` : tool.downloads}
                    </Badge>
                  )}
                  {tool.license && (
                    <Badge className="rounded-full bg-badge-green px-3 text-badge-green">
                      <Package className="h-4 w-4" />
                      {tool.license}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <Button variant="default" size="sm" onClick={() => toolConfigDialogRef.current?.showConfig(tool!)}>
                  Install Tool
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="overview" className="flex h-full flex-col">
              <div className="mb-2">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="overview" className="flex cursor-pointer items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="capabilities" className="flex cursor-pointer items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Capabilities
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="m-0 flex-1 overflow-hidden pl-1">
                <ScrollArea className="h-full">
                  <div className="space-y-6">
                    {/* Quick Links */}
                    {tool.sourceUrl && (
                      <div>
                        <Badge className="mb-2 bg-badge-blue text-badge-blue">Homepage</Badge>
                        <div className="pl-2">
                          <a href={tool.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                            <ExternalLink className="h-4 w-4" />
                            {tool.sourceUrl}
                          </a>
                        </div>
                      </div>
                    )}
                    {tool.repoUrl && (
                      <div>
                        <Badge className="mb-2 bg-badge-green text-badge-green">Repository</Badge>
                        <div className="pl-2">
                          <a href={tool.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                            <ExternalLink className="h-4 w-4" />
                            {tool.repoUrl}
                          </a>
                        </div>
                      </div>
                    )}
                    {/* Description */}
                    {tool.description && (
                      <div>
                        <Badge className="mb-2 bg-badge-amber text-badge-amber">Description</Badge>
                        <div className="pl-2">{tool.description}</div>
                      </div>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div>
                        <Badge className="mb-2 bg-badge-purple text-badge-purple">Tags</Badge>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="capabilities" className="m-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Available Tools</h3>
                    {capabilities.length > 0 ? (
                      <div className="grid gap-3">
                        {capabilities.map((capability: string, index: number) => (
                          <div key={index} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                            <Wrench className="h-5 w-5 flex-shrink-0" />
                            <span className="font-medium">{capability}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="italic">No capabilities information available</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
      <ToolConfigDialog ref={toolConfigDialogRef} onSuccess={props.onConfigSuccess} />
    </>
  );
});

ToolInfoDialog.displayName = 'ToolInfoDialog';
