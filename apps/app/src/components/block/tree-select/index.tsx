'use client';

import { TreeView, type TreeOption, type TreeViewProps } from '@/components/block/tree-view';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface TreeSelectProps extends Omit<TreeViewProps, 'options' | 'value' | 'onSelect'> {
  options: TreeOption[];
  value: string;
  onValueChange: (value: string) => void;
  rootValue?: string;
  rootLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  showRootOption?: boolean;
}

export function TreeSelect({
  options,
  value,
  onValueChange,
  rootValue = '__root__',
  rootLabel = '根目录',
  placeholder = '选择...',
  disabled,
  triggerClassName,
  contentClassName,
  showRootOption = true,
  expanded: controlledExpanded,
  onExpandedChange,
  autoExpandSelected = true,
  renderNode,
  renderIcon,
  className,
}: TreeSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());

  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = onExpandedChange ?? setInternalExpanded;

  const label = useMemo(() => {
    if (!value) return '';
    if (value === rootValue) return rootLabel;
    return options.find(f => f.id === value)?.name || '';
  }, [options, rootLabel, rootValue, value]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || contentRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (id: string) => {
    onValueChange(id);
    setOpen(false);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className={cn('w-full justify-between', triggerClassName)}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className={cn('min-w-0 truncate text-left', !label && 'text-muted-foreground')}>{label || placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
      </Button>
      <div
        ref={contentRef}
        className={cn(
          'bg-popover text-popover-foreground absolute left-0 top-full z-50 mt-1 w-full rounded-md border p-2 shadow-lg transition-all duration-200',
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none invisible -translate-y-2 opacity-0',
          contentClassName,
        )}
      >
        <div className="max-h-72 overflow-y-auto">
          {showRootOption && (
            <div
              className={cn(
                'group flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1 text-sm transition-all',
                value === rootValue ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground',
              )}
              onClick={() => handleSelect(rootValue)}
            >
              <span className="text-muted-foreground flex h-4 w-4 items-center justify-center" />
              <span className="min-w-0 flex-1 truncate">{rootLabel}</span>
            </div>
          )}
          <div className={showRootOption ? 'mt-1' : ''}>
            <TreeView
              options={options}
              value={value}
              onSelect={handleSelect}
              expanded={expanded}
              onExpandedChange={setExpanded}
              autoExpandSelected={autoExpandSelected}
              renderNode={renderNode}
              renderIcon={renderIcon}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
