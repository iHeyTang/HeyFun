import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';
import { parseNoteMention } from '../chat-input/note-mention-extension';

/**
 * Rehype 插件：将纯文本格式的 note mention 转换为 HTML 元素
 * 格式：@note:{noteId}[line:line][content]
 */
export function rehypeNoteMention() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;

      const text = node.value;
      // 匹配 @note:{noteId}[line:line][content] 格式
      const mentionRegex = /@note:([^[]+)\[(\d+)(?::(\d+))?\](?:\[([^\]]*)\])?/g;
      const matches = Array.from(text.matchAll(mentionRegex));

      if (matches.length === 0) return;

      // 如果有匹配，需要拆分文本并替换 mention
      const newNodes: (Text | Element)[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        const matchStart = match.index!;
        const matchEnd = matchStart + match[0].length;

        // 添加匹配前的文本
        if (matchStart > lastIndex) {
          newNodes.push({
            type: 'text',
            value: text.slice(lastIndex, matchStart),
          });
        }

        // 解析 mention
        const mentionText = match[0];
        const parsed = parseNoteMention(mentionText);

        if (parsed) {
          const { noteId, startLine, endLine, content } = parsed;
          let positionText = `${startLine}`;
          if (endLine && endLine !== startLine) {
            positionText = `${startLine}:${endLine}`;
          }

          // 创建 HTML span 元素
          const mentionElement: Element = {
            type: 'element',
            tagName: 'span',
            properties: {
              'data-type': 'note-mention',
              'data-note-mention': mentionText,
              'data-note-id': noteId || '',
              'data-line': startLine,
              className: ['mention', 'note-mention'],
            },
            children: [
              {
                type: 'text',
                value: mentionText, // 显示文本，后续会被组件替换
              },
            ],
          };

          newNodes.push(mentionElement);
        } else {
          // 如果解析失败，保留原始文本
          newNodes.push({
            type: 'text',
            value: mentionText,
          });
        }

        lastIndex = matchEnd;
      }

      // 添加剩余的文本
      if (lastIndex < text.length) {
        newNodes.push({
          type: 'text',
          value: text.slice(lastIndex),
        });
      }

      // 替换原节点
      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
      }
    });
  };
}

