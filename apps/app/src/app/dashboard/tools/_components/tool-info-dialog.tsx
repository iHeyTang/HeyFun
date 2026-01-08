import { refreshToolMetadata } from '@/actions/tools';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToolSchemas } from '@prisma/client';
import { Download, ExternalLink, FileText, Package, RefreshCw, Star, Tag, Wrench } from 'lucide-react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ToolConfigDialog, ToolConfigDialogRef } from './tool-config-dialog';

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
        <DialogContent className="flex h-[90vh] w-[90vw] flex-col overflow-hidden p-0" style={{ maxWidth: '900px' }} showCloseButton={true}>
          {/* Header */}
          <DialogHeader className="border-border/50 bg-muted/30 px-6 pb-4 pr-12 pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {tool.logoUrl ? (
                  <div className="border-border/50 bg-muted/50 relative overflow-hidden rounded-xl border p-2">
                    <img src={tool.logoUrl} alt={`${tool.name} logo`} className="h-14 w-14 rounded-lg object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="from-primary/20 to-primary/5 border-border/50 text-primary flex h-14 w-14 items-center justify-center rounded-xl border bg-gradient-to-br text-xl font-semibold shadow-sm">
                    {tool.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="mb-2 flex items-baseline gap-3 text-xl font-semibold">
                  <span className="text-foreground">{tool.name}</span>
                  {tool.author && <span className="text-muted-foreground text-sm font-normal">by {tool.author}</span>}
                </DialogTitle>

                <div className="flex flex-wrap items-center gap-2">
                  {tool.version && (
                    <Badge
                      variant="outline"
                      className="bg-muted/50 text-muted-foreground border-border/50 border px-2 py-0.5 text-[11px] font-medium"
                    >
                      v{tool.version}
                    </Badge>
                  )}
                  {tool.stars && (
                    <Badge
                      variant="outline"
                      className="bg-badge-amber/10 text-badge-amber border-badge-amber/20 flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium"
                    >
                      <Star className="h-3 w-3" />
                      {tool.stars > 1000 ? `${(tool.stars / 1000).toFixed(1)}k` : tool.stars}
                    </Badge>
                  )}
                  {tool.downloads && (
                    <Badge
                      variant="outline"
                      className="bg-badge-blue/10 text-badge-blue border-badge-blue/20 flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium"
                    >
                      <Download className="h-3 w-3" />
                      {tool.downloads > 1000 ? `${(tool.downloads / 1000).toFixed(1)}k` : tool.downloads}
                    </Badge>
                  )}
                  {tool.license && (
                    <Badge
                      variant="outline"
                      className="bg-badge-green/10 text-badge-green border-badge-green/20 flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium"
                    >
                      <Package className="h-3 w-3" />
                      {tool.license}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    toolConfigDialogRef.current?.showConfig(tool!);
                  }}
                  className="font-medium"
                >
                  Install Tool
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden px-6">
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

              <TabsContent value="overview" className="m-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-6 pb-4">
                    {/* Quick Links */}
                    {(tool.sourceUrl || tool.repoUrl) && (
                      <div className="space-y-3">
                        <h3 className="text-foreground text-sm font-semibold">Links</h3>
                        <div className="flex flex-wrap gap-2">
                          {tool.sourceUrl && (
                            <a
                              href={tool.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-badge-blue/10 text-badge-blue border-badge-blue/20 hover:bg-badge-blue/20 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Homepage
                            </a>
                          )}
                          {tool.repoUrl && (
                            <a
                              href={tool.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-badge-green/10 text-badge-green border-badge-green/20 hover:bg-badge-green/20 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Repository
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-foreground text-sm font-semibold">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag: string, index: number) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="bg-secondary/50 text-muted-foreground border-border/50 inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium"
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {tool.description && (
                      <div className="space-y-2">
                        <h3 className="text-foreground text-sm font-semibold">Description</h3>
                        <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">{tool.description}</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="capabilities" className="m-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-4">
                    <h3 className="text-foreground text-sm font-semibold">Available Tools</h3>
                    {capabilities.length > 0 ? (
                      <div className="grid gap-2">
                        {capabilities.map((capability: string, index: number) => (
                          <div
                            key={index}
                            className="border-border/50 bg-muted/30 hover:bg-muted/50 flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                          >
                            <Wrench className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                            <span className="text-foreground text-sm font-medium">{capability}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">No capabilities information available</p>
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
