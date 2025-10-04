import { removeTool } from '@/actions/tools';
import { confirm } from '@/components/block/confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import useAgentTools from '@/hooks/use-tools';
import { Info, Plus, X } from 'lucide-react';
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AddNewCustomToolDialog, AddNewCustomToolDialogRef } from './add-new-custom-tool-dialog';
import { useTranslations } from 'next-intl';

const DEFAULT_SELECTED_TOOLS = ['web_search', 'str_replace_editor', 'python_execute', 'browser_use'];

export const useInputToolsConfig = create<{
  enabledTools: string[];
  setEnabledTools: (selected: string[]) => void;
}>()(
  persist(
    set => ({
      enabledTools: [],
      setEnabledTools: selected => set({ enabledTools: selected }),
    }),
    {
      name: 'input-config-tools-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        enabledTools: state.enabledTools.length > 0 ? state.enabledTools : DEFAULT_SELECTED_TOOLS,
      }),
    },
  ),
);

interface InputToolsConfigDialogProps {
  ref: React.RefObject<InputToolsConfigDialogRef | null>;
}

export interface InputToolsConfigDialogRef {
  open: () => void;
}

export const InputToolsConfigDialog = ({ ref }: InputToolsConfigDialogProps) => {
  const [open, setOpen] = useState(false);
  const [showToolId, setShowToolId] = useState<string | null>(null);
  const addNewCustomToolRef = useRef<AddNewCustomToolDialogRef>(null);
  const { allTools, refreshTools } = useAgentTools();
  const { enabledTools, setEnabledTools } = useInputToolsConfig();
  const t = useTranslations('tasks.input.tools');

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setEnabledTools(enabledTools);
    },
  }));

  useEffect(() => {
    // if allTools is loaded, update the enabledTools, it's for the case enabled tools is not in the tools
    if (allTools?.length) {
      useInputToolsConfig.setState(state => {
        const selectedTools = state.enabledTools.filter(t => allTools.some(tool => tool.id === t));
        return { ...state, enabledTools: selectedTools };
      });
    }
  }, [allTools]);

  const handleToggleTool = (toolId: string) => {
    setEnabledTools(enabledTools?.includes(toolId) ? enabledTools.filter(id => id !== toolId) : [...(enabledTools ?? []), toolId]);
  };

  const handleShowToolInfo = (toolId: string) => {
    setShowToolId(toolId);
  };

  const handleRemoveCustomTool = (toolId: string) => {
    confirm({
      content: (
        <div>
          <p>{t('confirm.remove')}</p>
        </div>
      ),
      onConfirm: async () => {
        await removeTool({ toolId });
        setShowToolId(null);
        refreshTools();
      },
      buttonText: {
        confirm: t('confirm.confirmRemove'),
        cancel: t('confirm.cancel'),
      },
    });
  };

  const showToolInfo = useMemo(() => {
    return allTools?.find(t => t.id === showToolId);
  }, [showToolId, allTools]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ width: '90vw', maxWidth: '90vw', display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '80vh' }}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          <div className="flex h-[calc(100%-64px)] flex-1 flex-col gap-4">
            {/* Selected Tools Section */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {enabledTools?.map(toolId => {
                  const tool = allTools?.find(t => t.id === toolId);
                  return (
                    <Badge key={toolId} variant="secondary" className="flex items-center gap-1">
                      {tool?.name || 'unknown'}
                      <div className="hover:text-destructive cursor-pointer" onClick={() => handleToggleTool(toolId)}>
                        <X className="h-3 w-3" />
                      </div>
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Available Tools Section */}
            <div className="grid flex-1 grid-cols-4 content-start items-start gap-4 overflow-y-auto">
              {allTools?.map(tool => (
                <div
                  key={tool.id}
                  className={`group hover:bg-muted relative flex h-[80px] cursor-pointer flex-col justify-between rounded-md border p-2 transition-colors ${
                    enabledTools?.includes(tool.id) ? 'border-primary bg-muted' : ''
                  }`}
                  onClick={() => handleToggleTool(tool.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="line-clamp-1 text-sm font-medium">{tool.name}</span>
                    <div className="flex items-center gap-2">
                      {tool.type === 'mcp' && <Badge variant="secondary">{t('badge.mcp')}</Badge>}
                      {tool.source === 'CUSTOM' && <Badge variant="secondary">{t('badge.custom')}</Badge>}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info
                              className="text-muted-foreground hover:text-foreground h-4 w-4 cursor-pointer"
                              onClick={() => handleShowToolInfo(tool.id)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('tooltip.viewDetails')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Checkbox
                        onClick={e => {
                          e.stopPropagation();
                        }}
                        checked={enabledTools?.includes(tool.id)}
                        onCheckedChange={() => handleToggleTool(tool.id)}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{tool.description}</p>
                </div>
              ))}
              {/* action for add a new custom tools */}
              <div className="flex h-[80px] items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">{t('addCustom')}</h3>
                </div>
                <Button variant="outline" onClick={() => addNewCustomToolRef.current?.open()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tool Market Entry */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">{t('market.title')}</h3>
                <p className="text-muted-foreground text-sm">{t('market.description')}</p>
              </div>
              <Button variant="outline" onClick={() => window.open('/tools/market', '_blank')}>
                {t('market.browse')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tool Info Dialog */}
      <Dialog open={!!showToolId} onOpenChange={open => !open && setShowToolId(null)}>
        <DialogContent style={{ height: '500px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader className="h-12">
            <DialogTitle>{showToolInfo?.name || 'Unknown'}</DialogTitle>
            <div className="flex items-center gap-2">
              {showToolInfo?.type === 'mcp' && <Badge variant="secondary">{t('badge.mcp')}</Badge>}
              {showToolInfo?.source === 'CUSTOM' && <Badge variant="secondary">{t('badge.custom')}</Badge>}
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto">
            <div>
              <div className="markdown-body text-wrap">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    a: ({ href, children }) => {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {showToolInfo?.description}
                </Markdown>
              </div>
            </div>
          </div>
          <DialogFooter>
            {showToolInfo?.source === 'CUSTOM' && (
              <Button variant="outline" onClick={() => handleRemoveCustomTool(showToolInfo.id)}>
                Remove
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddNewCustomToolDialog
        ref={addNewCustomToolRef}
        onSuccess={() => {
          refreshTools();
        }}
      />
    </>
  );
};
