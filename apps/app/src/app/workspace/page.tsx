'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { WorkspaceFile } from '@/components/features/chat/preview/preview-content/workspace-preview/workspace-file';
import logo from '@/assets/logo.png';
import Image from 'next/image';

const EmptyState = () => (
  <div className="flex h-full items-center justify-center gap-4 opacity-50">
    <Image src={logo} alt="HeyFun" width={64} height={64} />
    <div className="flex flex-col">
      <div className="text-2xl font-bold">Workspace</div>
      <div className="text-muted-foreground text-sm">Select a file from the sidebar to view its contents.</div>
    </div>
  </div>
);

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const filePath = searchParams.get('path');
  const [selectedFile, setSelectedFile] = useState<{ blob: Blob; path: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    } else {
      setSelectedFile(null);
    }
  }, [filePath]);

  const loadFile = async (path: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspace/${path}`);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      const blob = await response.blob();
      setSelectedFile({ blob, path });
    } catch (error) {
      console.error('Error fetching file:', error);
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-2">Loading file...</p>
        </div>
      </div>
    );
  }

  if (!selectedFile) {
    return <EmptyState />;
  }

  return <WorkspaceFile filePath={selectedFile.path} />;
}
