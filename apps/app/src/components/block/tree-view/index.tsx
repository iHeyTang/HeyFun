'use client';

import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type TreeOption = {
  id: string;
  name: string;
  depth: number;
  disabled?: boolean;
};

type TreeNode = {
  id: string;
  name: string;
  disabled?: boolean;
  children?: TreeNode[];
};

function buildTreeFromPreorder(options: TreeOption[]) {
  const root: TreeNode[] = [];
  const stack: Array<{ depth: number; node: TreeNode }> = [];
  const parentMap = new Map<string, string | null>();

  for (const f of options) {
    const node: TreeNode = { id: f.id, name: f.name, disabled: f.disabled, children: [] };

    while (stack.length && stack[stack.length - 1]!.depth >= f.depth) stack.pop();

    if (!stack.length) {
      root.push(node);
      parentMap.set(node.id, null);
    } else {
      const parent = stack[stack.length - 1]!.node;
      parent.children = parent.children || [];
      parent.children.push(node);
      parentMap.set(node.id, parent.id);
    }

    stack.push({ depth: f.depth, node });
  }

  // 清理空 children
  const clean = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (!n.children?.length) {
        delete n.children;
      } else {
        clean(n.children);
      }
    }
  };
  clean(root);

  return { root, parentMap };
}

function getAncestors(id: string, parentMap: Map<string, string | null>) {
  const out: string[] = [];
  let cur: string | null | undefined = id;
  while (cur) {
    const p = parentMap.get(cur);
    if (!p) break;
    out.push(p);
    cur = p;
  }
  return out;
}

export interface TreeViewProps {
  options: TreeOption[];
  value?: string;
  onSelect?: (id: string) => void;
  expanded?: Set<string>;
  onExpandedChange?: (expanded: Set<string>) => void;
  autoExpandSelected?: boolean;
  renderNode?: (
    node: { id: string; name: string; depth: number; disabled?: boolean },
    props: { isActive: boolean; isExpanded: boolean; hasChildren: boolean },
  ) => React.ReactNode;
  renderIcon?: (props: { isExpanded: boolean; hasChildren: boolean }) => React.ReactNode;
  className?: string;
}

export function TreeView({
  options,
  value,
  onSelect,
  expanded: controlledExpanded,
  onExpandedChange,
  autoExpandSelected = false,
  renderNode,
  renderIcon,
  className,
}: TreeViewProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());
  const { root, parentMap } = useMemo(() => buildTreeFromPreorder(options), [options]);

  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = useMemo(
    () =>
      onExpandedChange
        ? (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
            if (typeof updater === 'function') {
              onExpandedChange(updater(expanded));
            } else {
              onExpandedChange(updater);
            }
          }
        : setInternalExpanded,
    [onExpandedChange, expanded],
  );

  // 自动展开选中项的父链
  useEffect(() => {
    if (!autoExpandSelected || !value) return;
    const ancestors = getAncestors(value, parentMap);
    if (!ancestors.length) return;
    // 使用 setTimeout 避免在 effect 中同步 setState
    setTimeout(() => {
      setExpanded((prev: Set<string>) => {
        const next = new Set(prev);
        for (const a of ancestors) next.add(a);
        return next;
      });
    }, 0);
  }, [value, parentMap, autoExpandSelected, setExpanded]);

  const toggle = (id: string) => {
    setExpanded((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTreeNode = (node: TreeNode, depth: number) => {
    const hasChildren = !!node.children?.length;
    const isExpanded = expanded.has(node.id);
    const isActive = value === node.id;
    const isDisabled = !!node.disabled;

    if (renderNode) {
      return (
        <div key={node.id}>
          {renderNode({ id: node.id, name: node.name, depth, disabled: node.disabled }, { isActive, isExpanded, hasChildren })}
          {hasChildren && isExpanded && <div>{node.children!.map(c => renderTreeNode(c, depth + 1))}</div>}
        </div>
      );
    }

    return (
      <div key={node.id}>
        <div
          className={cn(
            'group relative flex cursor-pointer select-none items-center gap-1 rounded-md px-2 py-1 pr-2 transition-all',
            isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground',
            isDisabled && 'pointer-events-none opacity-50',
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (isDisabled) return;
            onSelect?.(node.id);
          }}
        >
          <button
            type="button"
            className={cn('flex h-4 w-4 items-center justify-center rounded-sm', hasChildren ? 'hover:bg-muted/60' : 'opacity-0')}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (!hasChildren) return;
              toggle(node.id);
            }}
            aria-label={hasChildren ? (isExpanded ? 'collapse' : 'expand') : undefined}
          >
            {hasChildren ? isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" /> : null}
          </button>
          {renderIcon && renderIcon({ isExpanded, hasChildren })}
          <span className="min-w-0 flex-1 truncate text-sm">{node.name}</span>
        </div>
        {hasChildren && isExpanded && <div>{node.children!.map(c => renderTreeNode(c, depth + 1))}</div>}
      </div>
    );
  };

  return <div className={cn('', className)}>{root.map(n => renderTreeNode(n, 0))}</div>;
}
