import { FileIcon, FolderIcon } from 'lucide-react';
import { WorkspaceItem } from './types';

interface WorkspaceDirectoryProps {
  items: WorkspaceItem[];
  currentPath: string;
  onItemClick: (item: string) => void;
}

export const WorkspaceDirectory = ({ items, currentPath, onItemClick }: WorkspaceDirectoryProps) => {
  return (
    <div className="h-full">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderIcon className="text-muted-foreground/40 mb-3 h-12 w-12" />
          <p className="text-muted-foreground/60 text-sm font-light">暂无文件</p>
          <p className="text-muted-foreground/40 mt-1 text-xs">目录为空</p>
        </div>
      ) : (
        items.map(item => (
          <div
            key={item.name}
            className="hover:bg-muted/40 flex cursor-pointer items-center justify-between rounded-md p-2"
            onClick={() => onItemClick(item.name)}
          >
            <div className="flex items-center gap-2">
              {item.isDirectory ? <FolderIcon className="h-4 w-4 text-theme-tertiary" /> : <FileIcon className="h-4 w-4 text-theme-tertiary" />}
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
  );
};

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  const kbSize = size / 1024;
  if (kbSize < 1024) return `${Math.round(kbSize)} KB`;
  const mbSize = kbSize / 1024;
  return `${mbSize.toFixed(1)} MB`;
};
