'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EmptyStateProps {
  onCreateProject: () => void;
  isCreating: boolean;
}

export default function EmptyState({ onCreateProject, isCreating }: EmptyStateProps) {
  const tCommon = useTranslations('common');
  const tEmpty = useTranslations('flowcanvas.emptyState');

  return (
    <div className="flex h-96 flex-col items-center justify-center text-center">
      <h3 className="mb-2 text-xl font-semibold">{tEmpty('title')}</h3>
      <p className="text-muted-foreground mb-6 max-w-md">{tEmpty('description')}</p>
      <Button onClick={onCreateProject} disabled={isCreating} className="bg-primary hover:bg-primary/90">
        <Plus className="mr-2 h-4 w-4" />
        {isCreating ? tCommon('creating') : tEmpty('createFirst')}
      </Button>
    </div>
  );
}
