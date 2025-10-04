'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { WorkspaceFile } from '@/components/features/tasks/preview/preview-content/workspace-preview/workspace-file';
import { ThemeLogo } from '@/components/features/theme-logo';
import { useTranslations } from 'next-intl';

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex h-full items-center justify-center gap-4 opacity-50">
    <ThemeLogo width={64} height={64} alt="HeyFun" />
    <div className="flex flex-col">
      <div className="text-2xl font-bold">{title}</div>
      <div className="text-muted-foreground text-sm">{description}</div>
    </div>
  </div>
);

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const filePath = searchParams.get('path');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const t = useTranslations('workspace.page.emptyState');

  useEffect(() => {
    setSelectedFile(filePath);
  }, [filePath]);

  if (!selectedFile) {
    return <EmptyState title={t('title')} description={t('description')} />;
  }

  return <WorkspaceFile filePath={selectedFile} />;
}
