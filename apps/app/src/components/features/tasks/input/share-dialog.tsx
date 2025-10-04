import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImperativeHandle, useState } from 'react';
import { Button } from '@/components/ui/button';
import { shareTask } from '@/actions/tasks';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export interface ShareDialogRef {
  open: (taskId: string) => void;
}

interface ShareDialogProps {
  ref: React.RefObject<ShareDialogRef | null>;
}

export const ShareDialog = ({ ref }: ShareDialogProps) => {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareExpiration, setShareExpiration] = useState('7');
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState('');
  const t = useTranslations('tasks.input.share');

  useImperativeHandle(ref, () => ({
    open: (taskId: string) => {
      setOpen(true);
      setTaskId(taskId);
      const url = typeof window !== 'undefined' ? `${window.location.origin}/share/tasks/${taskId}` : '';
      setShareUrl(url);
    },
  }));

  const handleShare = async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const daysToMs = parseInt(shareExpiration) * 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + daysToMs;
      await shareTask({ taskId, expiresAt });
      navigator.clipboard.writeText(shareUrl);
      toast.success(t('linkCopied'));
    } catch (error) {
      console.error('Error sharing task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        style={{ maxWidth: '600px' }}
        onEscapeKeyDown={e => {
          e.preventDefault();
        }}
        onOpenAutoFocus={e => {
          e.preventDefault();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Input value={shareUrl} readOnly className="w-full" />

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="expiration" className="mb-1 block text-sm">
                {t('duration')}
              </label>
              <Select value={shareExpiration} onValueChange={setShareExpiration}>
                <SelectTrigger id="expiration" className="w-full">
                  <SelectValue placeholder={t('durationPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t('days7')}</SelectItem>
                  <SelectItem value="30">{t('days30')}</SelectItem>
                  <SelectItem value="60">{t('days60')}</SelectItem>
                  <SelectItem value="180">{t('days180')}</SelectItem>
                  <SelectItem value="365">{t('days365')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-end">
          <Button onClick={handleShare} disabled={loading}>
            {loading ? t('processing') : t('createLink')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
