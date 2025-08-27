'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { WorkspaceFile } from '@/components/features/chat/preview/preview-content/workspace-preview/workspace-file';
import Image from 'next/image';

const EmptyState = () => (
  <div className="flex h-full items-center justify-center gap-4 opacity-50">
    <Image src="/logo.png" alt="HeyFun" width={64} height={64} />
    <div className="flex flex-col">
      <div className="text-2xl font-bold">Workspace</div>
      <div className="text-muted-foreground text-sm">Select a file from the sidebar to view its contents.</div>
    </div>
  </div>
);

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const filePath = searchParams.get('path');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFile(filePath);
  }, [filePath]);

  if (!selectedFile) {
    return <EmptyState />;
  }

  return <WorkspaceFile filePath={selectedFile} />;
}
