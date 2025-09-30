'use client';

import { cn } from '@/lib/utils';
import Mention, { MentionOptions } from '@tiptap/extension-mention';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { MentionItem } from './MentionList';
import { suggestion } from './sugesstion';

export interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  mentionSuggestionItems?: MentionOptions<MentionItem>['suggestion']['items'];
}

export interface TiptapEditorRef {
  focus: () => void;
  blur: () => void;
  getText: () => string | undefined;
}

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(function TiptapEditor(
  { value, onChange, placeholder = '输入内容...', className, editable = true, mentionSuggestionItems = () => [] },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit,
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
    if (editable && editor) {
      // 使用 setTimeout 确保 DOM 已经更新
      setTimeout(() => {
        editor.commands.focus();
      }, 0);
    }
  }, [editable, editor]);

  return (
    <div className={cn('relative flex h-full flex-col', className)}>
      <EditorContent editor={editor} className="flex-1 overflow-auto rounded-md" />
    </div>
  );
});
