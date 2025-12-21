'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { WysiwygEditorToolbar } from './toolbar';
import { uploadFile, validateFile } from '@/lib/browser/file';
import { toast } from 'sonner';
import { ResizableImage } from './image-extension';
import { CodeBlockWithSyntax } from './code-block-extension';
import { SelectionToolbar, type SelectionInfo } from './selection-toolbar';
import { type NoteMentionData, parseNoteMention } from '@/components/block/chat-input/note-mention-extension';
import { useNoteAgentPanel } from '@/components/features/notes/note-agent-panel-context';

export interface WysiwygEditorTitleProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface WysiwygEditorProps {
  value: string; // Markdown 格式的字符串
  onChange?: (value: string) => void; // 返回 Markdown 格式的字符串（只读模式下可选）
  placeholder?: string;
  className?: string;
  editorClassName?: string; // 编辑器内容区域类名
  autoFocus?: boolean;
  showToolbar?: boolean; // 控制工具栏显示/隐藏
  title?: WysiwygEditorTitleProps; // 标题配置对象
  toolbarRightSlot?: React.ReactNode; // 工具栏右侧自定义插槽
  noteId?: string; // 笔记ID，用于AI助手
  onNoteUpdate?: () => void; // 笔记更新回调，用于刷新内容
  readOnly?: boolean; // 只读模式，用于渲染显示
  isStreaming?: boolean; // 是否正在流式输出（用于显示光标动画）
}

export function WysiwygEditor({
  value,
  onChange,
  placeholder = '开始记录你的想法...',
  className,
  editorClassName,
  autoFocus = false,
  showToolbar = true,
  title,
  toolbarRightSlot,
  noteId,
  onNoteUpdate,
  readOnly = false,
  isStreaming = false,
}: WysiwygEditorProps) {
  // 记录最近一次从编辑器内部触发的 markdown，避免父组件回填 value 时触发 setContent 导致光标跳到末尾
  const lastEmittedMarkdownRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement | null>(null);

  // 选择工具栏状态
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false);
  const isMouseDownRef = useRef(false); // 跟踪鼠标是否按下
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null); // 保存选区位置
  const rafRef = useRef<number | null>(null); // requestAnimationFrame ID

  // useNoteAgentPanel 现在会返回默认值，即使没有 Provider 也不会报错
  const { isOpen, openPanel, setInputValue, inputValue } = useNoteAgentPanel();

  // 创建 Turndown 服务用于 HTML 转 Markdown
  const turndownService = useMemo(() => {
    const service = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    // 添加图片规则，将 <img> 转换为 Markdown 格式
    service.addRule('image', {
      filter: 'img',
      replacement: (content, node) => {
        const img = node as HTMLImageElement;
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        const title = img.getAttribute('title') || '';
        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        // 如果图片有尺寸信息，在 Markdown 中保留（使用 HTML 格式）
        if (width || height) {
          return `<img src="${src}" alt="${alt}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}${title ? ` title="${title}"` : ''} />`;
        }
        return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
      },
    });
    // 优化代码块转换，保留语言信息
    service.addRule('codeBlock', {
      filter: (node: any) => {
        return node.nodeName === 'PRE' && node.querySelector('code');
      },
      replacement: (content: string, node: any) => {
        const code = node.querySelector('code');
        const className = code?.getAttribute('class') || '';
        const languageMatch = className.match(/language-(\w+)/);
        const language = languageMatch ? languageMatch[1] : '';
        const codeContent = code?.textContent || content;
        return `\n\n\`\`\`${language}\n${codeContent}\n\`\`\`\n\n`;
      },
    });
    return service;
  }, []);

  // 上传图片并插入到编辑器
  const handleImageUpload = async (file: File) => {
    // 验证文件
    const error = validateFile(file, 'image/*', 10 * 1024 * 1024); // 10MB
    if (error) {
      toast.error(error);
      return;
    }

    if (!editor) return;

    // 创建占位符图片（使用 base64 的 SVG 占位符）
    // 使用 URL 编码的 SVG，确保正确显示"上传中..."
    const placeholderSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f3f4f6"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">上传中...</text></svg>`;
    const placeholderDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg)}`;
    const placeholderId = `placeholder-${Date.now()}-${Math.random()}`;

    // 先插入占位符，设置默认高度为 200px
    editor
      .chain()
      .focus()
      .insertContent(
        `<img src="${placeholderDataUrl}" alt="上传中..." data-placeholder-id="${placeholderId}" style="opacity: 0.6; max-height: 200px;" height="200" />`,
      )
      .run();

    setUploading(true);
    try {
      // 上传到 S3
      const fileKey = await uploadFile(file, 'notes');

      // 使用服务器代理 URL，而不是签名 URL（签名会过期）
      const proxyUrl = `/api/oss/${fileKey}`;

      // 查找并替换占位符 - 使用 updateAttributes 命令
      const { tr } = editor.state;
      let found = false;
      let nodePos: number | null = null;

      tr.doc.descendants((node, pos) => {
        if (found) return false;
        if (node.type.name === 'image' && node.attrs['data-placeholder-id'] === placeholderId) {
          nodePos = pos;
          found = true;
          return false;
        }
        return true;
      });

      if (found && nodePos !== null) {
        // 使用 command 直接更新节点属性
        editor.commands.command(({ tr }) => {
          const node = tr.doc.nodeAt(nodePos!);
          if (node && node.type.name === 'image') {
            // 创建新的属性对象，明确移除 data-placeholder-id
            const newAttrs: Record<string, any> = {
              src: proxyUrl,
              alt: '',
              height: 200,
            };
            // 保留宽度（如果有）
            if (node.attrs.width) {
              newAttrs.width = node.attrs.width;
            }
            // 不包含 data-placeholder-id，这样它就会被移除
            tr.setNodeMarkup(nodePos!, undefined, newAttrs);
          }
          return true;
        });
      } else {
        // 如果找不到占位符，直接插入新图片，设置默认高度为 200px
        editor.chain().focus().insertContent(`<img src="${proxyUrl}" alt="" height="200" />`).run();
      }

      toast.success('图片上传成功');
    } catch (error: any) {
      console.error('图片上传失败:', error);
      toast.error(error.message || '图片上传失败');

      // 删除占位符
      const { tr } = editor.state;
      tr.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && node.attrs['data-placeholder-id'] === placeholderId) {
          tr.delete(pos, pos + node.nodeSize);
          return false;
        }
        return true;
      });
      editor.view.dispatch(tr);
    } finally {
      setUploading(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleImageUpload(file);
    }
    // 重置 input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 处理粘贴事件
  const handlePaste = (view: any, event: ClipboardEvent, slice: any) => {
    const items = event.clipboardData?.items;
    if (!items) return false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.indexOf('image') !== -1) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageUpload(file).catch(error => {
            console.error('粘贴图片上传失败:', error);
          });
          return true;
        }
      }
    }
    return false;
  };

  // 处理拖拽上传
  const handleDrop = (view: any, event: DragEvent, slice: any, moved: boolean) => {
    if (moved) return false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return false;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return false;

    event.preventDefault();
    for (const file of imageFiles) {
      handleImageUpload(file).catch(error => {
        console.error('拖拽图片上传失败:', error);
      });
    }
    return true;
  };

  // 将 Markdown 转换为 HTML（用于编辑器显示）
  const htmlContent = useMemo(() => {
    if (!value) return '';
    try {
      // marked 默认支持 HTML，直接使用同步解析
      // breaks: true 支持换行转换为 <br>
      // gfm: true 启用 GitHub Flavored Markdown
      let html = marked(value, { breaks: true, gfm: true });
      html = typeof html === 'string' ? html : '';

      // 处理 note mention：将纯文本格式 @note:{noteId}[line:line][content] 转换为 HTML
      // 使用正则表达式匹配并替换
      const mentionRegex = /@note:([^[]+)\[(\d+)(?::(\d+))?\](?:\[([^\]]*)\])?/g;
      html = html.replace(mentionRegex, (match, noteId, startLine, endLine, content) => {
        const parsed = parseNoteMention(match);
        if (parsed) {
          const { startLine: sl, endLine: el } = parsed;
          let positionText = `${sl}`;
          if (el && el !== sl) {
            positionText = `${sl}:${el}`;
          }
          // 转义 HTML 属性值
          const escapedNoteId = noteId.replace(/"/g, '&quot;');
          const escapedMention = match.replace(/"/g, '&quot;');
          return `<span data-type="note-mention" class="mention note-mention" data-note-mention="${escapedMention}" data-note-id="${escapedNoteId}">${match}</span>`;
        }
        return match;
      });

      return html;
    } catch {
      // 如果解析失败，可能是纯 HTML 或格式错误
      // 检查是否包含 HTML 标签，如果是则直接返回（TipTap 可以直接渲染 HTML）
      if (value.includes('<') && value.includes('>')) {
        return value;
      }
      // 否则返回原始值（可能是纯文本）
      return value;
    }
  }, [value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 配置 StarterKit
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // 禁用默认的 codeBlock，使用自定义的 CodeBlockWithSyntax
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      CodeBlockWithSyntax,
      ResizableImage,
    ],
    content: htmlContent, // 使用 HTML 内容
    immediatelyRender: false, // 避免 SSR 水合不匹配
    editable: !readOnly, // 只读模式下不可编辑
    onUpdate: ({ editor }) => {
      if (readOnly || !onChange) return;
      // 获取 HTML 并转换为 Markdown
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      lastEmittedMarkdownRef.current = markdown;
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'h-full w-full resize-none border-none bg-transparent text-sm outline-none',
          readOnly ? 'cursor-default' : 'focus:outline-none',
          readOnly ? '' : 'placeholder:text-muted-foreground',
          isStreaming ? 'streaming-cursor' : '',
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4',
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-3',
          '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2',
          '[&_p]:my-2',
          '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6',
          '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
          '[&_li]:my-1',
          // 行内代码样式 - 参考 Notion/Obsidian 设计
          '[&_code]:bg-muted/60 [&_code]:text-foreground [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[0.9em] [&_code]:font-mono [&_code]:border [&_code]:border-border/40 [&_code]:font-medium',
          // 代码块样式 - 更优雅的设计
          '[&_pre]:bg-muted/50 [&_pre]:border [&_pre]:border-border/50 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:shadow-sm',
          '[&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0 [&_pre_code]:text-sm [&_pre_code]:font-mono [&_pre_code]:leading-relaxed',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4',
          '[&_strong]:font-bold',
          '[&_em]:italic',
          '[&_a]:text-primary [&_a]:underline',
          '[&_hr]:my-6 [&_hr]:border-t [&_hr]:border-border',
          '[&_img]:max-w-full [&_img]:rounded [&_img]:object-contain',
          '[&_.image-wrapper]:inline-block [&_.image-wrapper]:max-w-full [&_.image-wrapper]:relative',
        ),
      },
      handlePaste: readOnly ? undefined : handlePaste,
      handleDrop: readOnly ? undefined : handleDrop,
    },
  });

  // 同步外部 value 变化到编辑器
  useEffect(() => {
    if (!editor) return;

    // 只读模式下，直接同步内容，不需要检查 lastEmittedMarkdownRef
    if (readOnly) {
      if (htmlContent !== editor.getHTML()) {
        editor.commands.setContent(htmlContent, { emitUpdate: false });
      }
      return;
    }

    // 如果这次 value 变化是由编辑器内部 onUpdate 触发（受控回填），不要再 setContent
    // 否则会重置 selection，导致光标总是跳到最后
    if (lastEmittedMarkdownRef.current !== null && value === lastEmittedMarkdownRef.current) {
      return;
    }

    // 外部真正变更（切换笔记/重置内容等）才同步到编辑器
    if (htmlContent !== editor.getHTML()) {
      editor.commands.setContent(htmlContent, { emitUpdate: false });
      // 设置内容后，将光标移到开头
      editor.commands.setTextSelection(0);
    }
  }, [editor, htmlContent, value, readOnly]);

  // 自动聚焦
  useEffect(() => {
    if (autoFocus && editor) {
      // 聚焦并将光标设置到开头
      editor.commands.focus('start');
    }
  }, [autoFocus, editor]);

  // 计算选区位置（返回视口坐标）
  const calculatePosition = useCallback(
    (from: number, to: number) => {
      if (!editor || !editorContainerRef.current) return null;

      const { view } = editor;
      const startCoords = view.coordsAtPos(from);
      const endCoords = view.coordsAtPos(to);

      // 处理异常坐标情况（如选中换行符等）
      const isAbnormalCoords =
        endCoords.bottom < startCoords.top ||
        endCoords.right < startCoords.left - 100 ||
        (endCoords.left === 0 && endCoords.top === 0) ||
        (startCoords.left === 0 && startCoords.top === 0);

      let centerX: number;
      let topY: number;

      if (isAbnormalCoords) {
        // 使用浏览器原生 Selection API 获取更准确的位置
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rects = range.getClientRects();
          const firstRect = rects[0];
          if (firstRect) {
            centerX = firstRect.left + firstRect.width / 2;
            topY = firstRect.top - 48;
          } else {
            centerX = startCoords.left;
            topY = startCoords.top - 48;
          }
        } else {
          centerX = startCoords.left;
          topY = startCoords.top - 48;
        }
      } else {
        // 正常情况：计算工具栏位置（选中文本的上方居中）
        centerX = (startCoords.left + endCoords.right) / 2;
        topY = Math.min(startCoords.top, endCoords.top) - 48;
      }

      return { x: centerX, y: topY };
    },
    [editor],
  );

  // 检查选区是否在容器可见区域内
  const isSelectionVisible = useCallback(
    (from: number, to: number) => {
      if (!editor || !editorContainerRef.current) return false;

      const { view } = editor;
      const startCoords = view.coordsAtPos(from);
      const endCoords = view.coordsAtPos(to);
      const containerRect = editorContainerRef.current.getBoundingClientRect();

      const top = Math.min(startCoords.top, endCoords.top);
      const bottom = Math.max(startCoords.bottom, endCoords.bottom);

      return top < containerRect.bottom && bottom > containerRect.top;
    },
    [editor],
  );

  // 处理鼠标释放事件（选择结束）
  const handleMouseUp = useCallback(() => {
    if (!editor || readOnly) return;

    isMouseDownRef.current = false;

    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');

    if (text && text.trim().length > 0) {
      // 保存选区位置
      savedSelectionRef.current = { from, to };

      // 计算位置
      const position = calculatePosition(from, to);
      if (position) {
        // 先显示工具栏，然后在下一帧设置位置
        setShowSelectionToolbar(true);
        requestAnimationFrame(() => {
          if (selectionToolbarRef.current) {
            selectionToolbarRef.current.style.transform = `translate(calc(${position.x}px - 50%), ${position.y}px)`;
          }
        });
      }
    } else {
      savedSelectionRef.current = null;
      setShowSelectionToolbar(false);
    }
  }, [editor, readOnly, calculatePosition]);

  // 监听鼠标事件
  useEffect(() => {
    if (readOnly || !editorContainerRef.current) return;

    const container = editorContainerRef.current;
    const editorElement = container.querySelector('.ProseMirror');
    if (!editorElement) return;

    const handleMouseDown = () => {
      isMouseDownRef.current = true;
      // 选择开始时隐藏工具栏
      setShowSelectionToolbar(false);
    };

    editorElement.addEventListener('mousedown', handleMouseDown);
    editorElement.addEventListener('mouseup', handleMouseUp);

    return () => {
      editorElement.removeEventListener('mousedown', handleMouseDown);
      editorElement.removeEventListener('mouseup', handleMouseUp);
    };
  }, [readOnly, handleMouseUp]);

  // 监听编辑器选择变化（处理键盘选择等情况）
  useEffect(() => {
    if (!editor || readOnly) return;

    const handleSelectionUpdate = () => {
      // 只有在鼠标没有按下时才处理
      if (isMouseDownRef.current) return;

      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');

      if (text && text.trim().length > 0) {
        savedSelectionRef.current = { from, to };
        const position = calculatePosition(from, to);
        if (position) {
          setShowSelectionToolbar(true);
          requestAnimationFrame(() => {
            if (selectionToolbarRef.current) {
              selectionToolbarRef.current.style.transform = `translate(calc(${position.x}px - 50%), ${position.y}px)`;
            }
          });
        }
      } else {
        savedSelectionRef.current = null;
        setShowSelectionToolbar(false);
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, readOnly, calculatePosition]);

  // 绑定滚动监听和位置更新
  useEffect(() => {
    if (!showSelectionToolbar || !editorContainerRef.current || !editor) return;

    const container = editorContainerRef.current;
    // 尝试找到实际的滚动容器（可能是 .ProseMirror 或其父元素）
    const proseMirror = container.querySelector('.ProseMirror');
    const scrollContainer = proseMirror || container;

    // 更新位置的函数（在 useEffect 内部定义，确保总是访问最新的值）
    const updatePosition = () => {
      const selection = savedSelectionRef.current;
      const toolbar = selectionToolbarRef.current;

      if (!selection || !toolbar || !editorContainerRef.current || !editor) {
        return;
      }

      const { from, to } = selection;

      try {
        // 使用 editor.view.coordsAtPos 获取最新位置（视口坐标）
        const { view } = editor;
        const startCoords = view.coordsAtPos(from);
        const endCoords = view.coordsAtPos(to);
        const containerRect = editorContainerRef.current.getBoundingClientRect();

        const top = Math.min(startCoords.top, endCoords.top);
        const bottom = Math.max(startCoords.bottom, endCoords.bottom);
        const left = Math.min(startCoords.left, endCoords.left);
        const right = Math.max(startCoords.right, endCoords.right);

        // 检查是否在容器可见区域内（需要同时检查上下左右边界）
        const isVisible = top < containerRect.bottom && bottom > containerRect.top && left < containerRect.right && right > containerRect.left;

        setShowSelectionToolbar(isVisible);

        if (!isVisible) {
          setShowSelectionToolbar(false);
          return;
        }

        // 计算位置（使用视口坐标，因为工具栏是 fixed 定位）
        const centerX = (startCoords.left + endCoords.right) / 2;
        const topY = top - 48;

        // 直接更新 DOM
        toolbar.style.transform = `translate(calc(${centerX}px - 50%), ${topY}px)`;
      } catch (error) {
        console.error('[SelectionToolbar] 更新位置时出错:', error);
      }
    };

    const handleScroll = () => {
      // 取消之前的 RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // 使用 RAF 确保在下一帧更新
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updatePosition();
      });
    };

    // 监听多个可能的滚动容器
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 初始更新一次位置
    requestAnimationFrame(() => {
      updatePosition();
    });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      // 清理 RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [showSelectionToolbar, editor]);

  // 处理添加到agent - 将文本添加到输入框（使用自定义mention格式）
  const handleAddToAgent = useCallback(
    (selectionInfo: SelectionInfo) => {
      if (!noteId) {
        toast.error('笔记ID不存在，无法使用AI助手');
        return;
      }

      // 如果AI面板未打开，先打开它（同步操作，不需要等待）
      if (!isOpen) {
        openPanel(noteId);
      }

      // 直接从 title prop 获取笔记标题（本地数据，无需异步请求）
      const noteTitle = title?.value || '笔记';

      // 构建位置信息（使用新格式：line:line）
      const { startLine, endLine, text: content } = selectionInfo;
      let positionInfo = `${startLine}`;
      if (endLine && endLine !== startLine) {
        // 如果跨行，显示行范围
        positionInfo = `${startLine}:${endLine}`;
      }

      // 创建 mention 文本（新格式：@note:{noteId}[line:line][content]）
      // content 不需要转义，直接使用原始文本
      const mentionText = `@note:${noteId}[${positionInfo}]${content ? `[${content}]` : ''}`;

      // 创建 mention HTML（保留所有信息用于显示）
      // HTML 属性值需要转义特殊字符
      const escapedMentionText = mentionText.replace(/"/g, '&quot;');
      const escapedNoteTitle = noteTitle.replace(/"/g, '&quot;');
      const escapedContent = content ? content.replace(/"/g, '&quot;') : '';
      const mentionHTML = `<span data-type="note-mention" class="mention note-mention" data-note-mention="${escapedMentionText}" data-note-id="${noteId}" data-note-title="${escapedNoteTitle}"${content ? ` data-note-content="${escapedContent}"` : ''}>${mentionText}</span>`;

      // 将 mention 添加到输入框（通过 HTML，不创建新段落）
      if (inputValue && inputValue.trim()) {
        // 如果输入框已有内容，在同一段落中追加 mention（使用空格分隔）
        const prev = inputValue;
        // 如果 prev 是 HTML，检查最后一个段落
        const isHTML = prev.includes('<');
        if (isHTML) {
          // 移除最后一个 </p> 标签，添加空格和 mention，然后重新添加 </p>
          if (prev.endsWith('</p>')) {
            const withoutLastP = prev.slice(0, -4);
            setInputValue(`${withoutLastP} ${mentionHTML}</p>`);
          } else {
            // 如果没有 </p>，直接追加
            setInputValue(`${prev} ${mentionHTML}`);
          }
        } else {
          // 如果是纯文本，转换为 HTML 后追加
          setInputValue(`<p>${prev} ${mentionHTML}</p>`);
        }
      } else {
        // 如果输入框为空，直接设置（不创建空段落）
        setInputValue(`<p>${mentionHTML}</p>`);
      }
    },
    [noteId, isOpen, openPanel, inputValue, setInputValue, title?.value],
  );

  if (!editor) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-muted-foreground">加载编辑器...</div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full w-full flex-col', className)}>
      {/* 隐藏的文件输入 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploading} />
      {/* 工具栏 */}
      {showToolbar && (
        <WysiwygEditorToolbar
          editor={editor}
          rightSlot={toolbarRightSlot}
          onImageUploadClick={() => {
            fileInputRef.current?.click();
          }}
          uploading={uploading}
          noteId={noteId}
        />
      )}
      {/* 标题 */}
      {title && (
        <div className="border-border/40 border-b px-6 py-3">
          <input
            type="text"
            value={title.value}
            onChange={e => title.onChange(e.target.value)}
            placeholder={title.placeholder || '输入标题...'}
            className="text-foreground/80 placeholder:text-muted-foreground/70 w-full border-none bg-transparent text-lg font-semibold focus:outline-none focus:ring-0"
          />
        </div>
      )}
      {/* 编辑器内容 */}
      <div ref={editorContainerRef} className="relative flex-1 overflow-y-auto">
        <EditorContent editor={editor} className={cn('h-full', editorClassName)} />
      </div>
      {/* 选择工具栏 - fixed 定位，使用 transform 定位 */}
      {!readOnly && showSelectionToolbar && (
        <div ref={selectionToolbarRef} className="fixed" style={{ left: 0, top: 0, willChange: 'transform' }} onMouseDown={e => e.preventDefault()}>
          <SelectionToolbar editor={editor} onAddToAgent={handleAddToAgent} />
        </div>
      )}
    </div>
  );
}
