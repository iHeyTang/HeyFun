'use client';

import { getEnvironmentVariables, updateEnvironmentVariables } from '@/actions/settings';
import { useEnvironmentVariables } from '@/hooks/use-environment-variables';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

export default function EnvironmentVariablesPage() {
  const t = useTranslations('config.environmentVariables');
  const router = useRouter();
  const { data: envVars, isLoading, update, loadEnvironmentVariables } = useEnvironmentVariables();
  const [variables, setVariables] = useState<Array<{ key: string; value: string }>>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadEnvironmentVariables();
  }, [loadEnvironmentVariables]);

  useEffect(() => {
    if (envVars && !isLoading) {
      const entries = Object.entries(envVars).map(([key, value]) => ({ key, value: String(value) }));
      setVariables(entries);
    }
  }, [envVars, isLoading]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const variablesObj: Record<string, string> = {};
      variables.forEach(({ key, value }) => {
        if (key.trim()) {
          variablesObj[key.trim()] = value;
        }
      });
      await update(variablesObj);
      toast.success(t('toast.updateSuccess'));
      router.refresh();
    } catch (error) {
      toast.error(t('toast.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = () => {
    if (newKey.trim() && !variables.find(v => v.key === newKey.trim())) {
      setVariables([...variables, { key: newKey.trim(), value: newValue }]);
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemove = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const handleKeyChange = (index: number, value: string) => {
    const updated = [...variables];
    if (updated[index]) {
      updated[index].key = value;
      setVariables(updated);
    }
  };

  const handleValueChange = (index: number, value: string) => {
    const updated = [...variables];
    if (updated[index]) {
      updated[index].value = value;
      setVariables(updated);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="mb-10">
        <h1 className="text-lg font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>

      <div className="space-y-4">
        {/* 现有环境变量列表 */}
        {variables.map((variable, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1 space-y-2">
              <Label>{t('form.key')}</Label>
              <Input value={variable.key} onChange={e => handleKeyChange(index, e.target.value)} placeholder={t('form.keyPlaceholder')} />
            </div>
            <div className="flex-1 space-y-2">
              <Label>{t('form.value')}</Label>
              <Input
                type="password"
                value={variable.value}
                onChange={e => handleValueChange(index, e.target.value)}
                placeholder={t('form.valuePlaceholder')}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleRemove(index)} className="mt-6" title={t('actions.delete')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* 添加新环境变量 */}
        <div className="border-muted rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <Label className="text-sm font-medium">{t('form.addNew')}</Label>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>{t('form.key')}</Label>
              <Input
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder={t('form.keyPlaceholder')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleAdd();
                  }
                }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>{t('form.value')}</Label>
              <Input
                type="password"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder={t('form.valuePlaceholder')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleAdd();
                  }
                }}
              />
            </div>
            <Button onClick={handleAdd} disabled={!newKey.trim() || variables.some(v => v.key === newKey.trim())}>
              {t('actions.add')}
            </Button>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('actions.saving') : t('actions.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
