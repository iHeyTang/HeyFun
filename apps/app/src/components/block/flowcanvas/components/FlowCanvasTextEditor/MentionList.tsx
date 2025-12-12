import { SuggestionKeyDownProps } from '@tiptap/suggestion';
import { Panel } from '@xyflow/react';

import React, { useEffect, useImperativeHandle, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

// 基础接口
interface BaseMentionItem {
  id: string;
  description?: string;
  metadata?: Record<string, any>;
}

// 图片类型
interface ImageMentionItem extends BaseMentionItem {
  type: 'image';
  label?: string;
  imageUrl: string;
  imageAlt?: string;
}

// 文件类型
interface FileMentionItem extends BaseMentionItem {
  type: 'file';
  fileName: string;
  fileSize?: number;
  fileExtension?: string;
}

// 文字片段类型
interface TextMentionItem extends BaseMentionItem {
  type: 'text';
  label?: string;
  textLength?: number;
}

// 视频类型
interface VideoMentionItem extends BaseMentionItem {
  type: 'video';
  label?: string;
  imageUrl?: string; // 视频缩略图
  videoUrl?: string; // 视频URL
  duration?: number; // 视频时长（秒）
}

// 音频类型
interface AudioMentionItem extends BaseMentionItem {
  type: 'audio';
  label?: string;
  audioUrl?: string; // 音频URL
  duration?: number; // 音频时长（秒）
}

// 其他类型
interface OtherMentionItem extends BaseMentionItem {
  type: 'other';
}

// 联合类型
export type MentionItem = ImageMentionItem | FileMentionItem | TextMentionItem | VideoMentionItem | AudioMentionItem | OtherMentionItem;

export interface MentionListProps<T extends MentionItem = MentionItem> {
  items: T[];
  command: (item: T) => void;
  event: React.KeyboardEvent<HTMLButtonElement>;
}

export interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

// 类型分组配置
const TYPE_GROUPS = {
  image: { label: 'Image', order: 1 },
  video: { label: 'Video', order: 2 },
  audio: { label: 'Audio', order: 3 },
  file: { label: 'File', order: 4 },
  text: { label: 'Text', order: 5 },
  other: { label: 'Other', order: 6 },
} as const;

// 分组后的数据结构
interface GroupedItems {
  [key: string]: MentionItem[];
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// 图片预览组件 - 横向排列
const ImagePreview: React.FC<{ item: ImageMentionItem }> = ({ item }) => (
  <div className="flex items-center gap-3">
    <div className="bg-muted relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md">
      <img src={item.imageUrl} alt={item.imageAlt || item.id} className="h-full w-full object-cover" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-foreground truncate text-sm font-medium">{item.label}</div>
    </div>
  </div>
);

// 文件预览组件
const FilePreview: React.FC<{ item: FileMentionItem }> = ({ item }) => (
  <div className="flex items-center gap-3">
    <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
      <svg className="text-muted-foreground h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-foreground truncate text-sm font-medium">{item.fileName}</div>
      <div className="text-muted-foreground text-xs">
        {item.fileExtension && item.fileExtension.toUpperCase()}
        {item.fileSize && ` • ${formatFileSize(item.fileSize)}`}
      </div>
    </div>
  </div>
);

// 文字片段预览组件
const TextPreview: React.FC<{ item: TextMentionItem }> = ({ item }) => (
  <div className="flex items-center gap-3">
    <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
      <svg className="text-muted-foreground h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
          clipRule="evenodd"
        />
      </svg>
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-foreground truncate text-sm font-medium">{item.id}</div>
      {item.label && <div className="text-muted-foreground truncate text-xs">{item.label}</div>}
      {item.textLength && <div className="text-muted-foreground/70 text-xs">{item.textLength} 字符</div>}
    </div>
  </div>
);

// 格式化时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 视频预览组件
const VideoPreview: React.FC<{ item: VideoMentionItem }> = ({ item }) => (
  <div className="flex items-center gap-3">
    <div className="bg-muted relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-md">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.id} className="h-full w-full object-cover" />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-foreground/50 flex h-4 w-4 items-center justify-center rounded-full">
          <svg className="text-background ml-0.5 h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </div>
      </div>
      {item.duration && (
        <div className="bg-foreground/75 text-background absolute bottom-1 right-1 rounded px-1 py-0.5 text-xs">{formatDuration(item.duration)}</div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-foreground truncate text-sm font-medium">{item.label || item.id}</div>
      {item.description && <div className="text-muted-foreground truncate text-xs">{item.description}</div>}
    </div>
  </div>
);

// 音频预览组件
const AudioPreview: React.FC<{ item: AudioMentionItem }> = ({ item }) => (
  <div className="flex items-center gap-3">
    <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
      <svg className="text-muted-foreground h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
          clipRule="evenodd"
        />
      </svg>
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-foreground truncate text-sm font-medium">{item.label || item.id}</div>
      <div className="text-muted-foreground text-xs">
        {item.description && <span className="truncate">{item.description}</span>}
        {item.duration && (
          <span className="ml-1">
            {item.description && ' • '}
            {formatDuration(item.duration)}
          </span>
        )}
      </div>
    </div>
  </div>
);

// 默认预览组件
const DefaultPreview: React.FC<{ item: OtherMentionItem }> = ({ item }) => (
  <div className="flex items-center gap-3">
    <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
      <svg className="text-muted-foreground h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
          clipRule="evenodd"
        />
      </svg>
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-foreground truncate text-sm font-medium">{item.id}</div>
      {item.description && <div className="text-muted-foreground truncate text-xs">{item.description}</div>}
    </div>
  </div>
);

// 根据类型渲染对应的预览组件
const renderItemPreview = (item: MentionItem) => {
  switch (item.type) {
    case 'image':
      return <ImagePreview item={item} />;
    case 'file':
      return <FilePreview item={item} />;
    case 'text':
      return <TextPreview item={item} />;
    case 'video':
      return <VideoPreview item={item} />;
    case 'audio':
      return <AudioPreview item={item} />;
    case 'other':
      return <DefaultPreview item={item} />;
    default:
      // 类型守卫，确保所有情况都被处理
      const _exhaustiveCheck: never = item;
      return <DefaultPreview item={item as OtherMentionItem} />;
  }
};

const MentionListInner = <T extends MentionItem>(props: MentionListProps<T>, ref: React.ForwardedRef<MentionListRef>) => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 按类型分组项目
  const groupedItems = useMemo(() => {
    const groups: GroupedItems = {};

    // 使用 items 数组而不是通过 props.items.forEach 来避免在渲染期间访问 ref
    const items = props.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const type = item.type || 'other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
    }

    // 按配置的顺序排序分组
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
      const orderA = TYPE_GROUPS[a as keyof typeof TYPE_GROUPS]?.order || 999;
      const orderB = TYPE_GROUPS[b as keyof typeof TYPE_GROUPS]?.order || 999;
      return orderA - orderB;
    });

    return sortedGroups;
  }, [props.items]);

  // 获取当前选中类型的项目
  const currentTypeItems = useMemo(() => {
    if (!selectedType) return [];
    const group = groupedItems.find(([type]) => type === selectedType);
    return group ? group[1] : [];
  }, [selectedType, groupedItems]);

  // 初始化选中类型
  useEffect(() => {
    if (groupedItems.length > 0 && !selectedType) {
      const firstGroup = groupedItems[0];
      if (firstGroup) {
        // 使用 requestAnimationFrame 避免在 effect 中直接调用 setState
        requestAnimationFrame(() => {
          setSelectedType(firstGroup[0]);
        });
      }
    }
  }, [groupedItems, selectedType]);

  const selectItem = (index: number, event?: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发编辑器的 blur 事件
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const item = currentTypeItems[index];

    if (item) {
      props.command(item as T);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + currentTypeItems.length - 1) % currentTypeItems.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % currentTypeItems.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  // 当切换类型时重置选中索引
  useEffect(() => {
    // 使用 requestAnimationFrame 避免在 effect 中直接调用 setState
    requestAnimationFrame(() => {
      setSelectedIndex(0);
    });
  }, [selectedType]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <Panel position="bottom-center">
      <div className="bg-popover text-popover-foreground animate-in slide-in-from-bottom-2 min-w-[400px] overflow-hidden rounded-md border shadow-lg duration-200" data-mention-list="true">
        {groupedItems.length ? (
          <div className="flex h-[300px]">
            {/* 左侧类型选择 */}
            <div className="border-accent w-24 border-r">
              <div className="p-2">
                <div className="space-y-1">
                  {groupedItems.map(([type, items]) => (
                    <div
                      key={type}
                      className={cn(
                        'text-muted-foreground flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs transition-colors',
                        selectedType === type ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-muted',
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedType(type);
                      }}
                      onMouseDown={(e) => {
                        // 阻止 mousedown 事件，避免触发 blur
                        e.preventDefault();
                      }}
                    >
                      <div className="truncate">{TYPE_GROUPS[type as keyof typeof TYPE_GROUPS]?.label || type}</div>
                      <div className="text-muted-foreground/70 mt-0.5 text-xs">{items.length}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 右侧项目列表 */}
            <div className="flex-1 overflow-hidden">
              {currentTypeItems.length > 0 ? (
                <div className="h-full overflow-y-auto p-2">
                  <div className="space-y-1">
                    {currentTypeItems.map((item, index) => (
                      <div
                        key={`${selectedType}-${index}`}
                        className={cn(
                          'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-hidden relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm transition-colors',
                          index === selectedIndex && 'bg-accent text-accent-foreground',
                        )}
                        onClick={(e) => selectItem(index, e)}
                        onMouseDown={(e) => {
                          // 阻止 mousedown 事件，避免触发 blur
                          e.preventDefault();
                        }}
                      >
                        {renderItemPreview(item)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">该类型下没有项目</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground flex h-[100px] items-center justify-center text-sm">没有找到相关内容</div>
        )}
      </div>
    </Panel>
  );
};

const MentionList = React.forwardRef(MentionListInner) as <T extends MentionItem>(
  props: MentionListProps<T> & React.RefAttributes<MentionListRef>,
) => React.ReactElement;

export default MentionList;
