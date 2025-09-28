import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImperativeHandle, useState } from 'react';
import { Button } from '@/components/ui/button';
import { shareTask } from '@/actions/tasks';
import { toast } from 'sonner';

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
      toast.success('Share Link Copied');
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
          <DialogTitle>Share Task</DialogTitle>
          <DialogDescription>Share this task</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Input value={shareUrl} readOnly className="w-full" />

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="expiration" className="mb-1 block text-sm">
                Duration
              </label>
              <Select value={shareExpiration} onValueChange={setShareExpiration}>
                <SelectTrigger id="expiration" className="w-full">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">365 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-end">
          <Button onClick={handleShare} disabled={loading}>
            {loading ? 'Processing...' : 'Create Share Link and Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
