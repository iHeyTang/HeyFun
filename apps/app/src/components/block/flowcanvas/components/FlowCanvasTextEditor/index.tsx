'use client';

import Mention, { MentionOptions } from '@tiptap/extension-mention';
import { EditorContent, useEditor, Editor, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ListItem } from '@tiptap/extension-list-item';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, createContext, useContext } from 'react';
import { suggestion } from './sugesstion';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { useFlowGraph } from '../../hooks/useFlowGraph';
import { MentionTooltip, TooltipState } from './MentionTooltip';
import { MentionItem } from './MentionList';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useNodesData, useEdges } from '@xyflow/react';

// 创建Context来共享mention数据
interface MentionContextValue {
  mentionItemsMap: Map<string, MentionItem>;
  nodeId: string;
}

const MentionContext = createContext<MentionContextValue | null>(null);

// 自定义MentionNodeView组件
const MentionNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const context = useContext(MentionContext);
  const id = node.attrs.id;

  // 从context中实时获取item数据
  const item = context?.mentionItemsMap.get(id);

  // 根据不同类型获取显示文本
  let label = id;
  if (item) {
    switch (item.type) {
      case 'file':
        label = item.fileName;
        break;
      case 'image':
      case 'text':
      case 'video':
      case 'audio':
        label = item.label || id;
        break;
      default:
        label = id;
    }
  }

  // 根据资源是否存在决定样式
  const className = item ? 'mention' : 'mention mention-warning';

  return (
    <NodeViewWrapper as="span" className={cn(className, 'px-[1px]')} data-type="mention" data-id={id}>
      @{label}
    </NodeViewWrapper>
  );
};

export interface FlowCanvasTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  autoFocus?: boolean;
  nodeId: string;
  onMentionClick?: (mentionId: string) => void;
}

export interface FlowCanvasTextEditorRef {
  focus: () => void;
  blur: () => void;
  getText: () => string | undefined;
}

export const FlowCanvasTextEditor = forwardRef<FlowCanvasTextEditorRef, FlowCanvasTextEditorProps>(function TiptapEditor(
  { value, onChange, placeholder = 'Input content...', className, editable = true, autoFocus = false, nodeId, onMentionClick },
  ref,
) {
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, item: null });
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);

  // 使用useEdges订阅edges变化
  const edges = useEdges();

  // 获取前置节点的ID列表
  const preNodeIds = useMemo(() => {
    return edges.filter(edge => edge.target === nodeId).map(edge => edge.source);
  }, [edges, nodeId]);

  // 使用useNodesData订阅这些节点的数据变化
  const preNodesData = useNodesData(preNodeIds);

  // 获取前置节点数据 - 会在节点数据变化时自动更新
  const nodeInputs = useMemo(() => {
    return preNodesData.filter((node): node is NonNullable<typeof node> => node !== null).map(node => node as any); // 类型转换为兼容之前的FlowGraphNode
  }, [preNodesData]);

  // 创建插入项配置（基于 flowcanvas 的节点数据）
  const insertItems: MentionOptions<MentionItem>['suggestion']['items'] = useCallback(
    (props: { query: string; editor: Editor }) => {
      const list: MentionItem[] = [];
      nodeInputs.forEach(input => {
        // 处理图片输出
        if (input.data.output?.images?.list) {
          input.data.output.images.list.forEach((imageKey: string, index: number) => {
            list.push({
              type: 'image' as const,
              id: `image:${input.id}:${imageKey}`,
              imageAlt: imageKey,
              label: `${input.data.label} ${index + 1}`,
              imageUrl: `/api/oss/${imageKey}`,
            });
          });
        }
        // 处理文本输出
        if (input.data.output?.texts?.list) {
          input.data.output.texts.list.forEach((text: string) => {
            list.push({
              type: 'text' as const,
              id: `text:${input.id}`,
              label: `${input.data.label}`,
              textLength: text.length,
            });
          });
        }
        // 处理视频输出
        if (input.data.output?.videos?.list) {
          input.data.output.videos.list.forEach((videoKey: string, index: number) => {
            list.push({
              type: 'video' as const,
              id: `video:${videoKey}`,
              label: `${input.data.label} Video ${index + 1}`,
              videoUrl: `/api/oss/${videoKey}`,
            });
          });
        }
        // 处理音频输出
        if (input.data.output?.audios?.list) {
          input.data.output.audios.list.forEach((audioKey: string, index: number) => {
            list.push({
              type: 'audio' as const,
              id: `audio:${audioKey}`,
              label: `${input.data.label} Audio ${index + 1}`,
              audioUrl: `/api/oss/${audioKey}`,
            });
          });
        }
      });
      return list;
    },
    [nodeInputs],
  );

  // 创建资源映射表，方便根据 id 查找
  const mentionItemsMap = useMemo(() => {
    const map = new Map<string, MentionItem>();
    const list = insertItems({ query: '', editor: null as any });

    if (Array.isArray(list)) {
      list.forEach((item: MentionItem) => {
        map.set(item.id, item);
      });
    }

    return map;
  }, [insertItems]);

  // 创建自定义的Mention扩展
  const CustomMention = useMemo(() => {
    return Mention.extend({
      addNodeView() {
        return ReactNodeViewRenderer(MentionNodeView);
      },
    }).configure({
      renderText: ({ node }) => {
        return `@${node.attrs.id}`;
      },
      HTMLAttributes: {
        class: 'mention',
      },
      suggestion: {
        items: insertItems,
        ...suggestion,
        // 自定义command，只存储id
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: 'mention',
                attrs: { id: props.id }, // 只存储id
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();
        },
      },
    });
  }, [insertItems]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        listItem: false, // 禁用默认的 ListItem，使用自定义配置
      }),
      // 扩展 ListItem 以允许段落内容，这样可以在列表项中使用 markdown 格式
      ListItem.extend({
        content: 'paragraph+', // 允许一个或多个段落，这样可以在列表项中使用 markdown 格式（如加粗）
      }),
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty',
        showOnlyWhenEditable: false,
      }),
      CustomMention,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
          'h-full w-full resize-none border-none bg-transparent px-3 py-2 text-sm outline-none',
          'placeholder:text-muted-foreground',
        ),
        'data-placeholder': placeholder,
      },
    },
  });

  // 暴露 focus 和 blur 方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editor?.commands.focus();
      },
      blur: () => {
        editor?.commands.blur();
      },
      getText: () => {
        return editor?.getText();
      },
    }),
    [editor],
  );

  // 同步外部 value 变化到编辑器
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  // 同步 editable 状态到编辑器
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // 当 editable 变为 true 时自动聚焦
  useEffect(() => {
    if (editable && editor && autoFocus) {
      // 使用 setTimeout 确保 DOM 已经更新
      setTimeout(() => {
        editor.commands.focus();
      }, 0);
    }
  }, [editable, editor, autoFocus]);

  // 监听mention点击事件
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.attributes.getNamedItem('data-type')?.value === 'mention') {
        const id = target.attributes.getNamedItem('data-id')?.value || '';
        onMentionClick?.(id);
      }
    };

    editor.view.dom.addEventListener('click', handleClick);

    return () => {
      editor.view.dom.removeEventListener('click', handleClick);
    };
  }, [editor, onMentionClick]);

  // 监听mention悬停事件
  useEffect(() => {
    if (!editor) return;

    let hideTimeout: NodeJS.Timeout | null = null;

    const handleMouseOver = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.attributes.getNamedItem('data-type')?.value === 'mention') {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }

        const id = target.attributes.getNamedItem('data-id')?.value || '';
        const item = mentionItemsMap.get(id);

        if (item) {
          setHoveredElement(target);
          setTooltip(prev => ({
            ...prev,
            visible: true,
            item,
          }));
        }
      }
    };

    const handleMouseOut = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.attributes.getNamedItem('data-type')?.value === 'mention') {
        hideTimeout = setTimeout(() => {
          setHoveredElement(null);
          setTooltip(prev => ({ ...prev, visible: false }));
        }, 100);
      }
    };

    editor.view.dom.addEventListener('mouseover', handleMouseOver, true);
    editor.view.dom.addEventListener('mouseout', handleMouseOut, true);

    return () => {
      editor.view.dom.removeEventListener('mouseover', handleMouseOver, true);
      editor.view.dom.removeEventListener('mouseout', handleMouseOut, true);
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [editor, mentionItemsMap]);

  // 实时更新tooltip位置
  useEffect(() => {
    if (!hoveredElement) return;

    const updatePosition = () => {
      const rect = hoveredElement.getBoundingClientRect();
      setTooltip(prev => ({
        ...prev,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      }));
    };

    // 初始位置
    updatePosition();

    // 使用 requestAnimationFrame 持续更新位置
    let rafId: number;
    const updateLoop = () => {
      updatePosition();
      rafId = requestAnimationFrame(updateLoop);
    };
    rafId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [hoveredElement]);

  // 阻止滚动事件冒泡
  useEffect(() => {
    if (!editor) return;
    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
    };
    editor.view.dom.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      editor.view.dom.removeEventListener('wheel', handleWheel);
    };
  }, [editor]);

  // 阻止键盘事件冒泡
  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
    };
    editor.view.dom.addEventListener('keydown', handleKeyDown);
    return () => {
      editor.view.dom.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);

  // TipTap 编辑器在非编辑模式下也会正常渲染内容，只是不可编辑
  // 这样可以利用 TipTap 的原生渲染能力，包括 markdown 语法转换后的 HTML
  if (!editor) {
    return null;
  }

  return (
    <MentionContext.Provider value={{ mentionItemsMap, nodeId }}>
      <EditorContent editor={editor} className={cn('h-full overflow-auto rounded-md', className)} />
      <MentionTooltip tooltip={tooltip} />
    </MentionContext.Provider>
  );
});
