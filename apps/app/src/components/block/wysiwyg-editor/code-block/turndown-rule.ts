/**
 * Turndown 规则
 * 用于将代码块转换为 Markdown 格式（HTML → Markdown）
 */

import type { Rule } from 'turndown';

/**
 * 创建代码块的 Turndown 规则
 */
export function codeBlockTurndownRule(): Rule {
  return {
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
  };
}

