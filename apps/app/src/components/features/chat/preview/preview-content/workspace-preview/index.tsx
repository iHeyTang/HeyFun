import { useAsync } from '@/hooks/use-async';
import { ChevronRight, FolderOpen, LoaderIcon } from 'lucide-react';
import { Fragment } from 'react';
import { usePreviewData } from './store';
import { WorkspaceItem } from './types';
import { WorkspaceDirectory } from './workspace-directory';
import { WorkspaceFile } from './workspace-file';
import { Badge } from '@/components/ui/badge';
export { usePreviewData } from './store';

export const WorkspacePreview = () => {
  const { data, setData } = usePreviewData();

  const workspacePath = data?.type === 'workspace' ? data.path || '' : '';

  const handleItemClick = (item: string) => {
    setData({
      type: 'workspace',
      path: `${workspacePath}/${item}`,
    });
  };

  const { data: workspace, isLoading } = useAsync(
    async () => {
      if (data?.type !== 'workspace') return;
      const searchParams = new URLSearchParams();
      searchParams.set('path', workspacePath);
      const workspaceRes = await fetch(`/api/workspace?${searchParams.toString()}`);
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Badge className="mb-2 font-mono text-xs">
        <FolderOpen className="h-3.5 w-3.5" />
        {workspacePath.split('/').map((item, index) => {
          const path = workspacePath
            .split('/')
            .slice(0, index + 1)
            .join('/');
          return (
            <Fragment key={index}>
              <div className="flex cursor-pointer items-center gap-1" onClick={() => setData({ type: 'workspace', path: path })}>
                {item}
              </div>
              {index !== workspacePath.split('/').length - 1 && <ChevronRight />}
            </Fragment>
          );
        })}
      </Badge>
      <div className="flex-1 overflow-auto">
        {Array.isArray(workspace) ? (
          <WorkspaceDirectory
            items={workspace}
            currentPath={data?.type === 'workspace' && data.path ? data.path : ''}
            onItemClick={handleItemClick}
          />
        ) : (
          <WorkspaceFile filePath={data?.type === 'workspace' ? data.path || '' : ''} />
        )}
      </div>
    </div>
  );
};
