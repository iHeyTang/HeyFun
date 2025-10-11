'use client';

import Mention, { MentionOptions } from '@tiptap/extension-mention';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { MentionItem } from './MentionList';
import { suggestion } from './sugesstion';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';

export interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  autoFocus?: boolean;
  mentionSuggestionItems?: MentionOptions<MentionItem>['suggestion']['items'];
  onMentionClick?: (mentionId: string) => void;
}

export interface TiptapEditorRef {
  focus: () => void;
  blur: () => void;
  getText: () => string | undefined;
}

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(function TiptapEditor(
  {
    value,
    onChange,
    placeholder = 'Input content...',
    className,
    editable = true,
    autoFocus = false,
    mentionSuggestionItems = () => [],
    onMentionClick,
  },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty',
        showOnlyWhenEditable: false,
      }),
      Mention.configure({
        renderText: ({ node }) => {
          return `@${node.attrs.id}`;
        },
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: { items: mentionSuggestionItems, ...suggestion },
      }),
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

    // 添加点击事件监听器
    editor.view.dom.addEventListener('click', handleClick);

    // 清理函数
    return () => {
      editor.view.dom.removeEventListener('click', handleClick);
    };
  }, [editor, onMentionClick]);

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

  return <EditorContent editor={editor} className={cn('h-full overflow-auto rounded-md', className)} />;
});
