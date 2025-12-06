'use client';

import { getModelConfigs, updateModelConfig } from '@/actions/gateway';
import { ModelCard } from '@/components/features/model-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ModelInfo } from '@repo/llm/chat';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface ModelConfig {
  isEnabled: boolean;
  isVisible: boolean;
  customConfig: any;
  rateLimit: number | null;
  maxTokens: number | null;
}

interface ModelWithConfig {
  model: ModelInfo;
  config: ModelConfig;
}

interface ModelConfigsProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
}

export function ModelList({ refreshTrigger, onRefresh }: ModelConfigsProps) {
  const t = useTranslations('gateway');
  const [modelsWithConfigs, setModelsWithConfigs] = useState<ModelWithConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [editingModel, setEditingModel] = useState<ModelWithConfig | null>(null);
  const [formData, setFormData] = useState({
    isEnabled: true,
    isVisible: true,
    rateLimit: '',
    maxTokens: '',
  });

  useEffect(() => {
    loadConfigs();
  }, [refreshTrigger]);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const result = await getModelConfigs({});
      if (result.data) {
        setModelsWithConfigs(result.data as ModelWithConfig[]);
      } else {
        toast.error(result.error || t('toast.loadConfigsFailed'));
      }
    } catch (error) {
      toast.error(t('toast.loadConfigsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    if (!editingModel) return;

    try {
      const result = await updateModelConfig({
        modelId: editingModel.model.id,
        isEnabled: formData.isEnabled,
        isVisible: formData.isVisible,
        rateLimit: formData.rateLimit ? parseInt(formData.rateLimit) : null,
        maxTokens: formData.maxTokens ? parseInt(formData.maxTokens) : null,
      });

      if (result.data) {
        setEditingModel(null);
        setFormData({ isEnabled: true, isVisible: true, rateLimit: '', maxTokens: '' });
        loadConfigs();
        onRefresh?.();
        toast.success(t('toast.configUpdated'));
      } else {
        toast.error(result.error || t('toast.updateConfigFailed'));
      }
    } catch (error) {
      toast.error(t('toast.updateConfigFailed'));
    }
  };

  const filteredModels = useMemo(() => {
    if (selectedProvider === 'all') return modelsWithConfigs;
    return modelsWithConfigs.filter(item => item.model.provider === selectedProvider);
  }, [modelsWithConfigs, selectedProvider]);

  const providers = useMemo(() => {
    return Array.from(new Set(modelsWithConfigs.map(item => item.model.provider))).sort();
  }, [modelsWithConfigs]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="bg-card/50 hover:border-border hover:bg-card/80 w-[160px] text-[13px] backdrop-blur-sm transition-colors">
            <SelectValue placeholder={t('providers.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[13px]">
              {t('providers.all')}
            </SelectItem>
            {providers.map(provider => (
              <SelectItem key={provider} value={provider} className="text-[13px]">
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Models List */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(500px,1fr))] gap-3">
        {filteredModels.map(({ model, config }) => (
          <ModelCard key={model.id} model={model} className="bg-muted/30 hover:bg-muted" />
        ))}
      </div>

      {filteredModels.length === 0 && !isLoading && (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground text-[13px]">{t('emptyState.configs')}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Edit Dialog */}
      {editingModel && (
        <div className="bg-card/50 fixed inset-0 z-50 flex items-center justify-center border backdrop-blur-sm">
          <Card className="bg-card w-full max-w-md border p-6">
            <h3 className="text-foreground mb-4 text-lg font-semibold">{t('dialog.editTitle')}</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('form.modelId')}</Label>
                <p className="text-muted-foreground text-sm">{editingModel.model.id}</p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-enabled">{t('enabled')}</Label>
                <Switch
                  id="edit-enabled"
                  checked={formData.isEnabled}
                  onCheckedChange={checked => setFormData({ ...formData, isEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-visible">{t('visible')}</Label>
                <Switch
                  id="edit-visible"
                  checked={formData.isVisible}
                  onCheckedChange={checked => setFormData({ ...formData, isVisible: checked })}
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
              <div className="space-y-2">
                <Label htmlFor="edit-maxTokens">{t('form.maxTokens')}</Label>
                <Input
                  id="edit-maxTokens"
                  type="number"
                  value={formData.maxTokens}
                  onChange={e => setFormData({ ...formData, maxTokens: e.target.value })}
                  placeholder={t('form.maxTokensPlaceholder')}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingModel(null)}>
                {t('actions.cancel')}
              </Button>
              <Button onClick={handleUpdateConfig}>{t('actions.save')}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
