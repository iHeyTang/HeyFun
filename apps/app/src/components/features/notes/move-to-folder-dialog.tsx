'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FolderTreeDropdown } from '@/components/features/notes/folder-tree-dropdown';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export type FolderOption = {
  id: string;
  name: string;
  depth: number;
  disabled?: boolean;
};

const ROOT_VALUE = '__root__';

export interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  title?: string;
  description?: string;
  folders: FolderOption[];
  rootLabel?: string;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  title,
  description,
  folders,
  rootLabel,
  confirmText,
  cancelText,
  confirmDisabled,
  loading,
  onConfirm,
}: MoveToFolderDialogProps) {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');

  // dialog 打开时如果 value 为空，回退到 root，避免 Select 受控警告
  useEffect(() => {
    if (!open) return;
    if (!value) onValueChange(ROOT_VALUE);
  }, [open, value, onValueChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || t('sidebar.moveTo')}</DialogTitle>
          {description ? <div className="text-muted-foreground text-sm">{description}</div> : null}
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">{t('sidebar.selectDestination')}</div>
          <FolderTreeDropdown
            value={value || ROOT_VALUE}
            onValueChange={onValueChange}
            folders={folders}
            rootValue={ROOT_VALUE}
            rootLabel={rootLabel || t('sidebar.root')}
            placeholder={t('sidebar.selectDestination')}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!loading}>
            {cancelText || tCommon('cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={!!loading || !!confirmDisabled}>
            {loading ? tCommon('confirm.processing') : confirmText || tCommon('confirm.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function mapDialogValueToFolderId(value: string): string | null {
  return value === ROOT_VALUE ? null : value;
}

export function mapFolderIdToDialogValue(folderId: string | null | undefined): string {
  return folderId ? folderId : ROOT_VALUE;
}


