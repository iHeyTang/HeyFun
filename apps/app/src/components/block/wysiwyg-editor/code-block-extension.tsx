'use client';

import { CodeBlock } from '@tiptap/extension-code-block';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { Syntax } from '@/components/block/syntax';
import { cn } from '@/lib/utils';

/**
 * 代码块 NodeView 组件
 */
const CodeBlockNodeView = ({ node, updateAttributes }: any) => {
  const language = node.attrs.language || '';
  const content = node.textContent || '';

  return (
    <NodeViewWrapper as="div" className={cn('rounded-md border', 'overflow-hidden')}>
      <Syntax language={language} content={content} />
    </NodeViewWrapper>
  );
};

/**
 * 创建代码块扩展，使用 Syntax 组件渲染
 */
export const CodeBlockWithSyntax = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: null,
        parseHTML: element => {
          // 支持两种格式：
          // 1. <pre><code class="language-xxx">...</code></pre> (marked 生成的格式)
          // 2. <pre class="language-xxx">...</pre> (直接格式)
          const code = element.querySelector('code');
          if (code) {
            const className = code.getAttribute('class') || '';
            const match = className.match(/language-(\w+)/);
            if (match) {
              return match[1];
            }
          }
          // 检查 pre 元素本身的 class
          const preClass = element.getAttribute('class') || '';
          const preMatch = preClass.match(/language-(\w+)/);
          if (preMatch) {
            return preMatch[1];
          }
          return null;
        },
        renderHTML: attributes => {
          if (!attributes.language) {
            return {};
          }
          // 渲染时，将 language 添加到 code 元素上
          return {
            class: `language-${attributes.language}`,
          };
        },
      },
    };
  },
  // 确保能够正确解析 HTML（marked 生成的格式：<pre><code class="language-xxx">...</code></pre>）
  parseHTML() {
    return [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: node => {
          // 检查是否有 code 子元素
          const code = (node as HTMLElement).querySelector('code');
          if (code) {
            return {};
          }
          return false;
        },
      },
    ];
  },
  // 渲染 HTML（保持 marked 兼容的格式）
  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      HTMLAttributes,
      [
        'code',
        {
          class: node.attrs.language ? `language-${node.attrs.language}` : '',
        },
        0,
      ],
    ];
  },
});
