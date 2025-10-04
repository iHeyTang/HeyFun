'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAgents, createAgent, updateAgent, deleteAgent, Agent, getAgent } from '@/actions/agents';
import { useTranslations } from 'next-intl';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations('config.agents');

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const result = await getAgents({});
      if (result.data) {
        setAgents(result.data as Agent[]);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const handleCreateAgent = () => {
    setEditingAgent(null);
    setIsDialogOpen(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setIsDialogOpen(true);
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await deleteAgent({ id: agentId });
      await loadAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const handleSaveAgent = async (agentData: Partial<Agent>) => {
    try {
      setIsSaving(true);
      if (editingAgent) {
        await updateAgent({
          id: editingAgent.id,
          name: agentData.name!,
          description: agentData.description!,
          tools: agentData.tools!,
          systemPromptTemplate: agentData.systemPromptTemplate || undefined,
          isDefault: agentData.isDefault,
        });
      } else {
        await createAgent({
          name: agentData.name!,
          description: agentData.description!,
          tools: agentData.tools!,
          systemPromptTemplate: agentData.systemPromptTemplate || undefined,
          isDefault: agentData.isDefault,
        });
      }
      await loadAgents();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save agent:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateAgent}>
              <Plus className="mr-2 h-4 w-4" />
              {t('createAgent')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAgent ? t('editAgent') : t('createNew')}</DialogTitle>
              <DialogDescription>{t('configureDescription')}</DialogDescription>
            </DialogHeader>
            <AgentForm agentId={editingAgent?.id} onSave={handleSaveAgent} onCancel={() => setIsDialogOpen(false)} isSaving={isSaving} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {agents.map(agent => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {agent.name}
                    {agent.isDefault && <span className="bg-primary/10 text-primary rounded-md px-2 py-1 text-xs">{t('default')}</span>}
                  </CardTitle>
                  <CardDescription>{agent.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditAgent(agent)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!agent.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteAgent(agent.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-medium">{t('form.toolsCount', { count: agent.tools.length })}</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {agent.tools.map(tool => (
                      <span key={tool} className="bg-muted rounded px-2 py-1 text-xs">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface AgentFormProps {
  agentId?: string | null;
  onSave: (agentData: Partial<Agent>) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

function AgentForm({ agentId, onSave, onCancel, isSaving }: AgentFormProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const t = useTranslations('config.agents.form');

  const [formData, setFormData] = useState({
    name: agent?.name || '',
    description: agent?.description || '',
    tools: agent?.tools || [],
    systemPromptTemplate: agent?.systemPromptTemplate || undefined,
  });

  useEffect(() => {
    if (agentId) {
      getAgent({ id: agentId }).then(result => {
        if (result.data) {
          setAgent(result.data as Agent);
          setFormData({
            name: result.data.name,
            description: result.data.description,
            tools: result.data.tools,
            systemPromptTemplate: result.data.systemPromptTemplate || undefined,
          });
        }
      });
    }
  }, [agentId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t('name')}</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('namePlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('description')}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder={t('descriptionPlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-prompt">{t('systemPrompt')}</Label>
        <Textarea
          id="system-prompt"
          value={formData.systemPromptTemplate}
          onChange={e => setFormData({ ...formData, systemPromptTemplate: e.target.value })}
          placeholder={t('systemPromptPlaceholder')}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('tools')}</Label>
        <p className="text-muted-foreground text-sm">{t('toolsDescription')}</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? t('saving') : agent ? t('update') : t('create')}
        </Button>
      </div>
    </form>
  );
}
