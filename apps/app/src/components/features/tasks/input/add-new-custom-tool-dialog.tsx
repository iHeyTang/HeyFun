import { installCustomTool } from '@/actions/tools';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import React, { useImperativeHandle, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export interface AddNewCustomToolDialogRef {
  open: () => void;
}

export const AddNewCustomToolDialog = React.forwardRef<AddNewCustomToolDialogRef, { onSuccess?: () => void }>((props, ref) => {
  const [open, setOpen] = useState(false);
  const t = useTranslations('tasks.input.tools.addNew');

  const [toolName, setToolName] = useState('');
  const [toolConfig, setToolConfig] = useState('');

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
    },
  }));

  const handleAddTool = async () => {
    if (!toolName) {
      toast.error(t('nameRequired'));
      return;
    }
    if (!toolConfig) {
      toast.error(t('configRequired'));
      return;
    }
    if (toolName && toolConfig) {
      const res = await installCustomTool({ name: toolName, config: toolConfig });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.data?.message || t('success'));
        setOpen(false);
        props.onSuccess?.();
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    setToolName('');
    setToolConfig('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={open => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent style={{ overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <DialogHeader className="h-12">
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4">
          <Input placeholder={t('namePlaceholder')} value={toolName} onChange={e => setToolName(e.target.value)} />
          <Textarea
            placeholder={t('configPlaceholder')}
            value={toolConfig}
            onChange={e => setToolConfig(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleAddTool}>{t('add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

AddNewCustomToolDialog.displayName = 'AddNewCustomToolDialog';
