'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Check } from 'lucide-react';
import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useTranslations } from 'next-intl';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  tools: string[];
  isDefault?: boolean;
}

export interface AgentSelectorRef {
  open: () => void;
  close: () => void;
}

interface AgentSelectorStore {
  selectedAgent: AgentInfo | null;
  setSelectedAgent: (agent: AgentInfo | null) => void;
}

export const useAgentSelectorStore = (storageKey: string) =>
  create<AgentSelectorStore>()(
    persist(
      set => ({
        selectedAgent: null,
        setSelectedAgent: agent => set({ selectedAgent: agent }),
      }),
      {
        name: storageKey,
      },
    ),
  );

interface AgentSelectorDialogProps {
  availableAgents: AgentInfo[];
  selectedAgent: AgentInfo | null;
  onAgentSelect: (agent: AgentInfo | null) => void;
  storageKey: string;
}

export const AgentSelectorDialog = forwardRef<AgentSelectorRef, AgentSelectorDialogProps>(
  ({ availableAgents, selectedAgent, onAgentSelect, storageKey }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const t = useTranslations('common.agentSelector');

    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }));

    const handleAgentSelect = (agent: AgentInfo | null) => {
      onAgentSelect(agent);
      setIsOpen(false);
    };

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Default option */}
            <Card
              className={`cursor-pointer transition-colors ${selectedAgent === null ? 'ring-primary ring-2' : 'hover:bg-muted/50'}`}
              onClick={() => handleAgentSelect(null)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    <CardTitle className="text-base">{t('funmax')}</CardTitle>
                    {selectedAgent === null && <Check className="text-primary h-4 w-4" />}
                  </div>
                  <Badge variant="secondary">{t('system')}</Badge>
                </div>
                <CardDescription>{t('defaultDescription')}</CardDescription>
              </CardHeader>
            </Card>

            {/* Custom agents */}
            {availableAgents.map(agent => (
              <Card
                key={agent.id}
                className={`cursor-pointer transition-colors ${selectedAgent?.id === agent.id ? 'ring-primary ring-2' : 'hover:bg-muted/50'}`}
                onClick={() => handleAgentSelect(agent)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      {selectedAgent?.id === agent.id && <Check className="text-primary h-4 w-4" />}
                    </div>
                    {agent.isDefault && <Badge variant="default">{t('default')}</Badge>}
                  </div>
                  <CardDescription>{agent.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        {t('tools')} ({agent.tools.length})
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {agent.tools.slice(0, 3).map(tool => (
                          <Badge key={tool} variant="outline" className="text-xs">
                            {tool}
                          </Badge>
                        ))}
                        {agent.tools.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            {t('moreTools', { count: agent.tools.length - 3 })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);

AgentSelectorDialog.displayName = 'AgentSelectorDialog';
