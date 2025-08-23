'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAgents, createAgent, updateAgent, deleteAgent, Agent } from '@/actions/agents';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const result = await getAgents({});
      if (result.data) {
        setAgents(result.data);
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
          promptTemplates: agentData.promptTemplates,
          isDefault: agentData.isDefault,
        });
      } else {
        await createAgent({
          name: agentData.name!,
          description: agentData.description!,
          tools: agentData.tools!,
          promptTemplates: agentData.promptTemplates,
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
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-muted-foreground">Configure custom agents with specific tools and prompts</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateAgent}>
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAgent ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
              <DialogDescription>Configure your custom agent with specific tools and prompt templates</DialogDescription>
            </DialogHeader>
            <AgentForm agent={editingAgent} onSave={handleSaveAgent} onCancel={() => setIsDialogOpen(false)} isSaving={isSaving} />
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
                    {agent.isDefault && <span className="bg-primary/10 text-primary rounded-md px-2 py-1 text-xs">Default</span>}
                  </CardTitle>
                  <CardDescription>{agent.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditAgent(agent)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!agent.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => handleDeleteAgent(agent.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-medium">Tools ({agent.tools.length})</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {agent.tools.map(tool => (
                      <span key={tool} className="bg-muted rounded px-2 py-1 text-xs">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
                {agent.promptTemplates && (
                  <div>
                    <Label className="text-xs font-medium">Custom Prompts</Label>
                    <p className="text-muted-foreground text-xs">Custom system, plan, and next step prompts configured</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface AgentFormProps {
  agent?: Agent | null;
  onSave: (agentData: Partial<Agent>) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

function AgentForm({ agent, onSave, onCancel, isSaving }: AgentFormProps) {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    description: agent?.description || '',
    tools: agent?.tools || [],
    promptTemplates: agent?.promptTemplates || {
      system: '',
      plan: '',
      next: '',
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter agent name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter agent description"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Tools</Label>
        <p className="text-muted-foreground text-sm">Select tools this agent can use (TODO: Implement tool selector)</p>
      </div>

      <div className="space-y-4">
        <Label>Prompt Templates (Optional)</Label>

        <div className="space-y-2">
          <Label htmlFor="system-prompt">System Prompt</Label>
          <Textarea
            id="system-prompt"
            value={formData.promptTemplates.system}
            onChange={e =>
              setFormData({
                ...formData,
                promptTemplates: { ...formData.promptTemplates, system: e.target.value },
              })
            }
            placeholder="Enter custom system prompt template"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="plan-prompt">Plan Prompt</Label>
          <Textarea
            id="plan-prompt"
            value={formData.promptTemplates.plan}
            onChange={e =>
              setFormData({
                ...formData,
                promptTemplates: { ...formData.promptTemplates, plan: e.target.value },
              })
            }
            placeholder="Enter custom plan prompt template"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="next-prompt">Next Step Prompt</Label>
          <Textarea
            id="next-prompt"
            value={formData.promptTemplates.next}
            onChange={e =>
              setFormData({
                ...formData,
                promptTemplates: { ...formData.promptTemplates, next: e.target.value },
              })
            }
            placeholder="Enter custom next step prompt template"
            rows={4}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : agent ? 'Update Agent' : 'Create Agent'}
        </Button>
      </div>
    </form>
  );
}
