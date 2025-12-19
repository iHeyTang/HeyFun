'use client';

import { TreeSelect } from '@/components/block/tree-select';
import { TreeOption } from '@/components/block/tree-view';
import { Folder, FolderOpen } from 'lucide-react';

export type FolderTreeOption = TreeOption;

export function FolderTreeDropdown({
  value,
  onValueChange,
  folders,
  rootValue = '__root__',
  rootLabel = '根目录',
  placeholder = '选择目标文件夹',
  disabled,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  folders: FolderTreeOption[];
  rootValue?: string;
  rootLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <TreeSelect
      options={folders}
      value={value}
      onValueChange={onValueChange}
      rootValue={rootValue}
      rootLabel={rootLabel}
      placeholder={placeholder}
      disabled={disabled}
      triggerClassName={className}
      renderIcon={({ isExpanded, hasChildren }) =>
        hasChildren ? isExpanded ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0" /> : null
      }
    />
  );
}
