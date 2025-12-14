import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

/**
 * Rehype 插件：识别 mermaid 代码块并转换为自定义元素
 */
export function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || index === undefined) return;

      // 查找 <pre><code class="language-mermaid">...</code></pre>
      if (node.tagName === 'pre' && node.children && node.children.length > 0 && node.children[0]?.type === 'element') {
        const codeNode = node.children[0] as Element;

        if (codeNode.tagName === 'code' && codeNode.properties && codeNode.properties.className && Array.isArray(codeNode.properties.className)) {
          const classNames = codeNode.properties.className as string[];

          if (classNames.includes('language-mermaid')) {
            // 提取 mermaid 代码
            let mermaidCode = '';

            // 遍历所有子节点获取文本内容
            const extractText = (node: any): string => {
              if (node.type === 'text') {
                return node.value;
              }
              if (node.children && Array.isArray(node.children)) {
                return node.children.map(extractText).join('');
              }
              return '';
            };

            mermaidCode = codeNode.children.map(extractText).join('');

            if (mermaidCode.trim()) {
              // 创建自定义的 mermaid-container 元素
              const mermaidElement: Element = {
                type: 'element',
                tagName: 'mermaid-container',
                properties: {
                  'data-mermaid': mermaidCode,
                },
                children: [],
              };

              // 替换原节点
              parent.children[index] = mermaidElement;
            }
          }
        }
      }
    });
  };
}
