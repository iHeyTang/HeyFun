'use client';

import { createApiKey, deleteApiKey, getApiKeys, updateApiKey } from '@/actions/gateway';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Key, Loader2, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  rateLimit: number | null;
  lastUsedAt: Date | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ApiKeysListProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
}

export function ApiKeysList({ refreshTrigger, onRefresh }: ApiKeysListProps) {
  const t = useTranslations('gateway');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rateLimit: '',
  });

  useEffect(() => {
    loadKeys();
  }, [refreshTrigger]);

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      const result = await getApiKeys({});
      if (result.data) {
        setKeys(result.data as ApiKey[]);
      } else {
        toast.error(result.error || t('toast.loadKeysFailed'));
      }
    } catch (error) {
      toast.error(t('toast.loadKeysFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!formData.name.trim()) {
      toast.error(t('toast.nameRequired'));
      return;
    }

    try {
      const result = await createApiKey({
        name: formData.name,
        description: formData.description || undefined,
        rateLimit: formData.rateLimit ? parseInt(formData.rateLimit) : undefined,
      });

      if (result.data) {
        setNewKey(result.data.key);
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '', rateLimit: '' });
        loadKeys();
        onRefresh?.();
        toast.success(t('toast.keyCreated'));
      } else {
        toast.error(result.error || t('toast.createKeyFailed'));
      }
    } catch (error) {
      toast.error(t('toast.createKeyFailed'));
    }
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;

    try {
      const result = await updateApiKey({
        id: editingKey.id,
        name: formData.name,
        description: formData.description || undefined,
        isActive: editingKey.isActive,
        rateLimit: formData.rateLimit ? parseInt(formData.rateLimit) : null,
      });

      if (result.data) {
        setIsEditDialogOpen(false);
        setEditingKey(null);
        setFormData({ name: '', description: '', rateLimit: '' });
        loadKeys();
        onRefresh?.();
        toast.success(t('toast.keyUpdated'));
      } else {
        toast.error(result.error || t('toast.updateKeyFailed'));
      }
    } catch (error) {
      toast.error(t('toast.updateKeyFailed'));
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    try {
      const result = await updateApiKey({
        id: key.id,
        isActive: !key.isActive,
      });

      if (result.data) {
        loadKeys();
        onRefresh?.();
        toast.success(t('toast.keyUpdated'));
      } else {
        toast.error(result.error || t('toast.updateKeyFailed'));
      }
    } catch (error) {
      toast.error(t('toast.updateKeyFailed'));
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const result = await deleteApiKey({ id });
      if (result.data?.success) {
        loadKeys();
        onRefresh?.();
        toast.success(t('toast.keyDeleted'));
      } else {
        toast.error(result.error || t('toast.deleteKeyFailed'));
      }
    } catch (error) {
      toast.error(t('toast.deleteKeyFailed'));
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(t('toast.keyCopied'));
  };

  const openEditDialog = (key: ApiKey) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      description: key.description || '',
      rateLimit: key.rateLimit?.toString() || '',
    });
    setIsEditDialogOpen(true);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          variant="outline"
          size="sm"
          className="bg-card/50 hover:border-border hover:bg-card/80 text-[13px] backdrop-blur-sm transition-colors"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('actions.createKey')}
        </Button>
      </div>

      {/* Keys List */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(500px,1fr))] gap-3">
        {keys.map(key => (
          <div
            key={key.id}
            className="group relative w-full cursor-default select-none rounded-lg bg-muted/30 px-4 py-3 text-left transition-all hover:bg-muted"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fafafa] shadow">
                  <Key className="text-foreground h-4 w-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="items-baseline gap-2">
                    <div className="text-foreground text-[14px] font-medium">{key.name}</div>
                    {key.description && (
                      <div className="text-muted-foreground mt-1 text-[13px] leading-relaxed">{key.description}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="text-muted-foreground font-mono">{key.keyPrefix}...</span>
                    {key.rateLimit && (
                      <span className="text-muted-foreground">
                        {t('rateLimit')}: {key.rateLimit}/min
                      </span>
                    )}
                    {key.lastUsedAt && (
                      <span className="text-muted-foreground">
                        {t('lastUsedAt')}: {formatDate(key.lastUsedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={key.isActive} onCheckedChange={() => handleToggleActive(key)} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(key)}
                  className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span className="text-muted-foreground text-xs">{t('actions.edit')}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteKey(key.id)}
                  className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="text-muted-foreground h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {keys.length === 0 && !isLoading && (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground text-[13px]">{t('emptyState.keys')}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.createTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('form.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.descriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rateLimit">{t('form.rateLimit')}</Label>
              <Input
                id="rateLimit"
                type="number"
                value={formData.rateLimit}
                onChange={e => setFormData({ ...formData, rateLimit: e.target.value })}
                placeholder={t('form.rateLimitPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleCreateKey}>{t('actions.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.editTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('form.name')}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t('form.description')}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.descriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rateLimit">{t('form.rateLimit')}</Label>
              <Input
                id="edit-rateLimit"
                type="number"
                value={formData.rateLimit}
                onChange={e => setFormData({ ...formData, rateLimit: e.target.value })}
                placeholder={t('form.rateLimitPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleUpdateKey}>{t('actions.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={!!newKey} onOpenChange={() => setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.keyCreatedTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.keyCreatedDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between gap-2">
                <code className="text-muted-foreground flex-1 break-all font-mono text-sm">{newKey}</code>
                <Button variant="ghost" size="sm" onClick={() => newKey && handleCopyKey(newKey)} className="flex-shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">{t('dialog.keyWarning')}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>{t('actions.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
