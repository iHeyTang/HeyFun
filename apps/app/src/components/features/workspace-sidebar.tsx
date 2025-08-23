'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAsync } from '@/hooks/use-async';
import { WorkspaceItem } from '@/components/features/chat/preview/preview-content/workspace-preview/types';
import { FileIcon, FolderIcon, ChevronRightIcon, ChevronDownIcon, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface TreeNode extends WorkspaceItem {
  path: string;
  children?: TreeNode[];
  expanded?: boolean;
  level: number;
}

export function WorkspaceSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '';
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']));

  const { data: rootItems, isLoading } = useAsync(
    async () => {
      const response = await fetch('/api/workspace/');
      if (!response.ok) {
        throw new Error('Failed to fetch workspace items');
      }
      return response.json() as Promise<WorkspaceItem[]>;
    },
    [],
    {},
  );

  const loadDirectoryChildren = async (path: string): Promise<WorkspaceItem[]> => {
    const response = await fetch(`/api/workspace/${path}`);
    if (!response.ok) {
      throw new Error('Failed to fetch directory items');
    }
    return response.json();
  };

  const buildTreeData = (items: WorkspaceItem[], basePath: string, level: number): TreeNode[] => {
    return items.map(item => ({
      ...item,
      path: basePath ? `${basePath}/${item.name}` : item.name,
      level,
      expanded: expandedPaths.has(basePath ? `${basePath}/${item.name}` : item.name),
      children: item.isDirectory ? [] : undefined,
    }));
  };

  useEffect(() => {
    if (rootItems) {
      setTreeData(buildTreeData(rootItems, '', 0));
    }
  }, [rootItems, expandedPaths]);

  const toggleDirectory = async (node: TreeNode) => {
    if (!node.isDirectory) return;

    const newExpandedPaths = new Set(expandedPaths);

    if (expandedPaths.has(node.path)) {
      newExpandedPaths.delete(node.path);
      setExpandedPaths(newExpandedPaths);
    } else {
      newExpandedPaths.add(node.path);
      setExpandedPaths(newExpandedPaths);

      // Load children if not already loaded
      if (!node.children || node.children.length === 0) {
        try {
          const children = await loadDirectoryChildren(node.path);
          const newTreeData = updateTreeNodeChildren(treeData, node.path, children);
          setTreeData(newTreeData);
        } catch (error) {
          console.error('Failed to load directory children:', error);
        }
      }
    }
  };

  const updateTreeNodeChildren = (nodes: TreeNode[], targetPath: string, children: WorkspaceItem[]): TreeNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return {
          ...node,
          children: buildTreeData(children, node.path, node.level + 1),
        };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeNodeChildren(node.children, targetPath, children),
        };
      }
      return node;
    });
  };

  const renderTreeNodes = (nodes: TreeNode[]): React.ReactNode => {
    return nodes.map(node => {
      const isSelected = node.path === currentPath;
      const isExpanded = node.isDirectory && expandedPaths.has(node.path);

      return (
        <div key={node.path}>
          <div
            className={cn(
              'hover:bg-muted/50 flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm',
              isSelected && 'bg-muted',
              'transition-colors',
            )}
            style={{ paddingLeft: `${node.level * 12 + 8}px` }}
            onClick={() => {
              if (node.isDirectory) {
                toggleDirectory(node);
              } else {
                router.push(`/workspace?path=${encodeURIComponent(node.path)}`);
              }
            }}
          >
            {node.isDirectory && (
              <div className="mr-1 flex h-4 w-4 items-center justify-center">
                {isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              </div>
            )}
            {!node.isDirectory && <div className="w-5" />}

            {node.isDirectory ? <FolderIcon className="mr-2 h-4 w-4 text-blue-500" /> : <FileIcon className="text-muted-foreground mr-2 h-4 w-4" />}

            <span className="flex-1 truncate">{node.name}</span>
          </div>

          {node.isDirectory && isExpanded && node.children && <div>{renderTreeNodes(node.children)}</div>}
        </div>
      );
    });
  };

  return (
    <div className="bg-muted/20 flex h-full flex-col">
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-1">{renderTreeNodes(treeData)}</div>
        )}
      </div>
    </div>
  );
}
