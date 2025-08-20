import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeftIcon, DownloadIcon, FileIcon, FolderIcon, HomeIcon, LoaderIcon } from 'lucide-react';
import { WorkspaceItem } from './types';

interface WorkspaceDirectoryProps {
  items: WorkspaceItem[];
  currentPath: string;
  isRootDirectory: boolean;
  onItemClick: (item: WorkspaceItem) => void;
  onBackClick: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}

export const WorkspaceDirectory = ({
  items,
  currentPath,
  isRootDirectory,
  onItemClick,
  onBackClick,
  onDownload,
  isDownloading,
}: WorkspaceDirectoryProps) => {
  console.log('items', items);
  return (
    <div className="h-full p-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRootDirectory ? (
                <HomeIcon className="text-muted-foreground h-4 w-4" />
              ) : (
                <Button variant="ghost" size="icon" onClick={onBackClick} className="h-6 w-6" title="Return to parent directory">
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
              )}
              <CardTitle className="text-base">Workspace: {currentPath || 'Root Directory'}</CardTitle>
            </div>
            <Button onClick={onDownload} variant="outline" size="sm" disabled={isDownloading} title="Download current directory">
              {isDownloading ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {items.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center">This directory is empty</div>
            ) : (
              items.map(item => (
                <div
                  key={item.name}
                  className="hover:bg-muted/40 flex cursor-pointer items-center justify-between rounded-md p-2"
                  onClick={() => onItemClick(item)}
                >
                  <div className="flex items-center gap-2">
                    {item.isDirectory ? <FolderIcon className="h-4 w-4 text-gray-500" /> : <FileIcon className="h-4 w-4 text-gray-500" />}
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-xs">{formatFileSize(item.size)}</span>
                    <span className="text-muted-foreground text-xs">{new Date(item.modifiedTime).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  const kbSize = size / 1024;
  if (kbSize < 1024) return `${Math.round(kbSize)} KB`;
  const mbSize = kbSize / 1024;
  return `${mbSize.toFixed(1)} MB`;
};
