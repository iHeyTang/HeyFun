import { useAsync } from '@/hooks/use-async';
import { LoaderIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { usePreviewData } from './store';
import { WorkspaceDirectory } from './workspace-directory';
import { WorkspaceFile } from './workspace-file';
import { WorkspaceItem } from './types';

export { usePreviewData } from './store';

export const WorkspacePreview = () => {
  const pathname = usePathname();
  const { data, setData } = usePreviewData();
  const [isDownloading, setIsDownloading] = useState(false);

  const workspacePath = data?.type === 'workspace' ? data.path || '' : '';
  const isShare = pathname.startsWith('/share');
  const isRootDirectory = !workspacePath || workspacePath.split('/').length <= 1;

  const handleBackClick = () => {
    if (isRootDirectory) return;

    const pathParts = workspacePath.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/');

    setData({
      type: 'workspace',
      path: parentPath,
    });
  };

  const handleItemClick = (item: WorkspaceItem) => {
    setData({
      type: 'workspace',
      path: `${workspacePath}/${item.name}`,
    });
  };

  const handleDownload = async () => {
    if (data?.type !== 'workspace') return;
    setIsDownloading(true);
    try {
      const downloadUrl = isShare ? `/api/share/download/${workspacePath}` : `/api/workspace/download/${workspacePath}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = workspacePath.split('/').pop() || 'workspace';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
      }, 1000);
    }
  };

  const { data: workspace, isLoading } = useAsync(
    async () => {
      if (data?.type !== 'workspace') return;
      const workspaceRes = await fetch(isShare ? `/api/share/workspace/${workspacePath}` : `/api/workspace/${workspacePath}`);
      if (!workspaceRes.ok) return;
      if (workspaceRes.headers.get('content-type')?.includes('application/json')) {
        return (await workspaceRes.json()) as WorkspaceItem[];
      }
      return workspaceRes.blob();
    },
    [],
    {
      deps: [workspacePath, data?.type],
    },
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <LoaderIcon className="text-primary h-5 w-5 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-muted-foreground">Could not load workspace content</div>
      </div>
    );
  }

  if (Array.isArray(workspace)) {
    return (
      <WorkspaceDirectory
        items={workspace}
        currentPath={data?.type === 'workspace' && data.path ? data.path : ''}
        isRootDirectory={isRootDirectory}
        onItemClick={handleItemClick}
        onBackClick={handleBackClick}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />
    );
  }

  if (workspace instanceof Blob) {
    return (
      <WorkspaceFile
        blob={workspace}
        filePath={data?.type === 'workspace' ? data.path || '' : ''}
        isRootDirectory={isRootDirectory}
        onBackClick={handleBackClick}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-muted-foreground">This file type cannot be previewed</div>
    </div>
  );
};
