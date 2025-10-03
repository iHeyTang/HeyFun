'use client';

import { cloneVoiceWithModel, getVoiceSupportedModels } from '@/actions/voices';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import { useEffect, useImperativeHandle, useState } from 'react';
import { toast } from 'sonner';
import { VoiceModel } from '../types';
import { AudioUpload } from '@/components/block/image-upload';

export interface VoiceCloneDialogRef {
  open: () => void;
}

export interface VoiceCloneDialogProps {
  ref: React.RefObject<VoiceCloneDialogRef | null>;
  onSuccess?: () => void;
}

export const VoiceCloneDialog = (props: VoiceCloneDialogProps) => {
  const t = useTranslations('voices');
  const tc = useTranslations('common');
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneForm, setCloneForm] = useState({
    name: '',
    description: '',
    modelName: '',
    audioFile: '',
    text: '',
  });
  const [loading, setLoading] = useState(false);
  const [voiceModels, setVoiceModels] = useState<VoiceModel[]>([]);

  useEffect(() => {
    loadVoiceModels();
  }, []);

  const loadVoiceModels = async () => {
    const result = await getVoiceSupportedModels({});
    if (result.data) {
      setVoiceModels(result.data);
    }
  };

  const handleCreateCloneTask = async () => {
    if (!cloneForm.name || !cloneForm.audioFile || !cloneForm.text || !cloneForm.modelName) {
      toast.error(t('toast.fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const result = await cloneVoiceWithModel({
        modelName: cloneForm.modelName,
        name: cloneForm.name,
        description: cloneForm.description,
        audio: cloneForm.audioFile,
        text: cloneForm.text,
      });

      if (result.data?.success) {
        toast.success(t('toast.cloneSuccess'));
        setCloneDialogOpen(false);
        setCloneForm({
          name: '',
          description: '',
          modelName: voiceModels[0]?.name || '',
          audioFile: '',
          text: '',
        });
        props.onSuccess?.();
      } else {
        toast.error(result.data?.error || t('toast.cloneFailed'));
      }
    } catch (error) {
      toast.error(t('toast.cloneFailed'));
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(props.ref, () => ({
    open: () => {
      setCloneDialogOpen(true);
    },
  }));

  return (
    <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cloneDialog.title')}</DialogTitle>
          <DialogDescription>{t('cloneDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('cloneDialog.fields.name')}</Label>
            <Input
              placeholder={t('cloneDialog.fields.namePlaceholder')}
              value={cloneForm.name}
              onChange={e => setCloneForm({ ...cloneForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('cloneDialog.fields.description')}</Label>
            <Textarea
              placeholder={t('cloneDialog.fields.descriptionPlaceholder')}
              value={cloneForm.description}
              onChange={e => setCloneForm({ ...cloneForm, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('cloneDialog.fields.model')}</Label>
            <Select value={cloneForm.modelName} onValueChange={value => setCloneForm({ ...cloneForm, modelName: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('cloneDialog.fields.modelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {voiceModels
                  .filter(m => m.supportsCloning)
                  .map(model => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('cloneDialog.fields.audioFile')}</Label>
            <AudioUpload
              maxSize={10 * 1024 * 1024}
              value={cloneForm.audioFile}
              onChange={value => setCloneForm({ ...cloneForm, audioFile: value })}
            />
            <p className="text-muted-foreground text-xs">{t('cloneDialog.fields.audioFileHint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('cloneDialog.fields.text')}</Label>
            <Textarea
              placeholder={t('cloneDialog.fields.textPlaceholder')}
              value={cloneForm.text}
              onChange={e => setCloneForm({ ...cloneForm, text: e.target.value })}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleCreateCloneTask} disabled={loading}>
            {t('actions.startClone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
