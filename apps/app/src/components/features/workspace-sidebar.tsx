'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn, formatFileSize } from '@/lib/utils';
import { useAsync } from '@/hooks/use-async';
import { WorkspaceItem } from '@/components/features/chat/preview/preview-content/workspace-preview/types';
import {
  FileIcon,
  FolderIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Loader2,
  AlertCircle,
  FolderOpen,
  Download,
  Menu,
  MoreHorizontal,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import Link from 'next/link';
import { confirm } from '../block/confirm';

interface TreeNode extends WorkspaceItem {
  path: string;
  children?: TreeNode[];
  level: number;
  isLoaded?: boolean;
  isLoading?: boolean;
  loadError?: boolean;
}

interface TreeState {
  nodes: Map<string, TreeNode>;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  errorPaths: Set<string>;
  cache: Map<string, WorkspaceItem[]>;
}

export function WorkspaceSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '';

  const [treeState, setTreeState] = useState<TreeState>({
    nodes: new Map(),
    expandedPaths: new Set(['/']),
    loadingPaths: new Set(),
    errorPaths: new Set(),
    cache: new Map(),
  });

  const { data: rootItems, isLoading: isRootLoading } = useAsync(
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

  const loadDirectoryChildren = useCallback(
    async (path: string): Promise<WorkspaceItem[]> => {
      if (treeState.cache.has(path)) {
        return treeState.cache.get(path)!;
      }

      const searchParams = new URLSearchParams();
      searchParams.set('path', path);
      const response = await fetch(`/api/workspace?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch directory items');
      }
      const items = await response.json();

      setTreeState(prev => ({
        ...prev,
        cache: new Map(prev.cache).set(path, items),
      }));

      return items;
    },
    [treeState.cache],
  );

  const createTreeNode = useCallback((item: WorkspaceItem, basePath: string, level: number): TreeNode => {
    const path = basePath ? `${basePath}/${item.name}` : item.name;
    return {
      ...item,
      path,
      level,
      children: item.isDirectory ? [] : undefined,
      isLoaded: false,
      isLoading: false,
      loadError: false,
    };
  }, []);

  useEffect(() => {
    if (rootItems) {
      const rootNodes = new Map<string, TreeNode>();
      rootItems.forEach(item => {
        const node = createTreeNode(item, '', 0);
        rootNodes.set(node.path, node);
      });

      setTreeState(prev => ({
        ...prev,
        nodes: rootNodes,
        cache: new Map(prev.cache).set('', rootItems),
      }));
    }
  }, [rootItems, createTreeNode]);

  const toggleDirectory = async (nodePath: string) => {
    const node = treeState.nodes.get(nodePath);
    if (!node?.isDirectory) return;

    const wasExpanded = treeState.expandedPaths.has(nodePath);

    setTreeState(prev => {
      const newExpandedPaths = new Set(prev.expandedPaths);
      if (wasExpanded) {
        newExpandedPaths.delete(nodePath);
      } else {
        newExpandedPaths.add(nodePath);
      }
      return { ...prev, expandedPaths: newExpandedPaths };
    });

    if (!wasExpanded && (!node.isLoaded || node.loadError) && !treeState.loadingPaths.has(nodePath)) {
      setTreeState(prev => {
        const newErrorPaths = new Set(prev.errorPaths);
        newErrorPaths.delete(nodePath);
        return {
          ...prev,
          loadingPaths: new Set(prev.loadingPaths).add(nodePath),
          errorPaths: newErrorPaths,
          nodes: new Map(prev.nodes).set(nodePath, { ...node, isLoading: true, loadError: false }),
        };
      });

      try {
        const children = await loadDirectoryChildren(nodePath);
        const childNodes = new Map<string, TreeNode>();

        children.forEach(child => {
          const childNode = createTreeNode(child, nodePath, node.level + 1);
          childNodes.set(childNode.path, childNode);
        });

        setTreeState(prev => {
          const newNodes = new Map(prev.nodes);
          const newLoadingPaths = new Set(prev.loadingPaths);
          newLoadingPaths.delete(nodePath);

          childNodes.forEach((childNode, path) => {
            newNodes.set(path, childNode);
          });

          newNodes.set(nodePath, {
            ...node,
            isLoaded: true,
            isLoading: false,
            loadError: false,
            children: Array.from(childNodes.values()),
          });

          return {
            ...prev,
            nodes: newNodes,
            loadingPaths: newLoadingPaths,
          };
        });
      } catch (error) {
        console.error('Failed to load directory children:', error);
        setTreeState(prev => {
          const newLoadingPaths = new Set(prev.loadingPaths);
          const newExpandedPaths = new Set(prev.expandedPaths);
          const newErrorPaths = new Set(prev.errorPaths);

          newLoadingPaths.delete(nodePath);
          newExpandedPaths.delete(nodePath);
          newErrorPaths.add(nodePath);

          return {
            ...prev,
            loadingPaths: newLoadingPaths,
            expandedPaths: newExpandedPaths,
            errorPaths: newErrorPaths,
            nodes: new Map(prev.nodes).set(nodePath, {
              ...node,
              isLoading: false,
              loadError: true,
            }),
          };
        });
      }
    }
  };

  const buildTreeStructure = useMemo(() => {
    const { nodes, expandedPaths } = treeState;

    const nodeArray = Array.from(nodes.values());

    const buildChildren = (parentPath: string): TreeNode[] => {
      const children: TreeNode[] = [];
      for (const node of nodeArray) {
        const expectedParentPath = node.path.substring(0, node.path.lastIndexOf('/')) || '';
        if (expectedParentPath === parentPath && node.level === (parentPath ? parentPath.split('/').length : 0)) {
          const nodeWithChildren = { ...node };
          if (node.isDirectory && expandedPaths.has(node.path) && node.isLoaded) {
            nodeWithChildren.children = buildChildren(node.path);
          }
          children.push(nodeWithChildren);
        }
      }
      return children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    };

    return buildChildren('');
  }, [treeState]);

  const removeFile = useCallback(async (path: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set('path', path);
    const response = await fetch(`/api/workspace?${searchParams.toString()}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to remove file');
    }
    router.refresh();
  }, []);

  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const isSelected = node.path === currentPath;
    const isExpanded = node.isDirectory && treeState.expandedPaths.has(node.path);
    const isLoading = node.isLoading;
    const hasError = node.loadError;

    return (
      <div key={node.path}>
        <div
          className={cn(
            'hover:bg-muted/50 group flex cursor-pointer items-center gap-1 px-2 py-1.5 text-sm',
            isSelected && 'bg-muted',
            hasError && 'text-destructive',
            'transition-colors',
          )}
          style={{ paddingLeft: `${node.level * 12 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleDirectory(node.path);
            } else {
              router.push(`/workspace?path=${encodeURIComponent(node.path)}`);
            }
          }}
          title={hasError ? 'Failed to load directory. Click to retry.' : undefined}
        >
          {node.isDirectory && (
            <div className="mr-1 flex h-4 w-4 items-center justify-center">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : hasError ? (
                <AlertCircle className="text-destructive h-3 w-3" />
              ) : isExpanded ? (
                <ChevronDownIcon className="h-3 w-3" />
              ) : (
                <ChevronRightIcon className="h-3 w-3" />
              )}
            </div>
          )}
          {!node.isDirectory && <div className="w-5" />}

          {node.isDirectory ? (
            <FolderIcon className={cn('mr-2 h-4 w-4', hasError ? 'text-destructive' : 'text-muted-foreground')} />
          ) : (
            <FileIcon className="text-muted-foreground mr-2 h-4 w-4" />
          )}

          <span className="flex-1 truncate">{node.name}</span>
          {!node.isDirectory && (
            <span className="text-muted-foreground text-xs opacity-0 transition-all group-hover:opacity-100">{formatFileSize(node.size)}</span>
          )}
          {!node.isDirectory && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <MoreVertical className="text-muted-foreground h-4 w-4 opacity-0 transition-all group-hover:opacity-100" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem className="cursor-pointer">
                  <Link href={`/api/workspace/download?path=${node.path}`} download={node.name} className="flex cursor-pointer gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    confirm({
                      content: 'Are you sure you want to remove this file?',
                      onConfirm: async () => await removeFile(node.path),
                      buttonText: {
                        confirm: 'Remove',
                        cancel: 'Cancel',
                      },
                    });
                  }}
                >
                  <div className="text-destructive/80 flex items-center gap-2">
                    <Trash2 className="text-currentColor h-4 w-4" />
                    Remove
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {node.isDirectory && isExpanded && node.children && <div>{node.children.map(child => renderTreeNode(child))}</div>}
      </div>
    );
  };

  const TreeSkeleton = () => (
    <div className="space-y-1 py-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center px-2 py-1.5">
          <div className="bg-muted mr-1 h-3 w-3 animate-pulse rounded-sm" style={{ marginLeft: `${(i % 3) * 12 + 8}px` }} />
          <div className="bg-muted mr-2 h-4 w-4 animate-pulse rounded-sm" />
          <div className="bg-muted h-4 animate-pulse rounded" style={{ width: `${60 + Math.random() * 80}px` }} />
        </div>
      ))}
    </div>
  );

  const EmptyState = () => (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <FolderOpen className="text-muted-foreground/50 mb-4 h-8 w-8" />
      <h3 className="text-muted-foreground mb-1 text-sm font-medium">No files found</h3>
      <p className="text-muted-foreground/70 text-xs">Workspace is empty</p>
    </div>
  );

  return (
    <div className="bg-muted/20 flex h-full flex-col">
      <div className="flex-1 overflow-y-auto py-2">
        {isRootLoading ? (
          <TreeSkeleton />
        ) : buildTreeStructure.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1">{buildTreeStructure.map(node => renderTreeNode(node))}</div>
        )}
      </div>
    </div>
  );
}
