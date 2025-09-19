// 主题化的代码高亮样式
export const createThemeCodeStyle: () => Record<string, React.CSSProperties> = () => ({
  hljs: {
    display: 'block',
    overflowX: 'auto',
    padding: '0.5em',
    background: 'var(--theme-code-bg)',
    color: 'var(--theme-code-text)',
    borderRadius: '0.375rem',
    border: '1px solid var(--theme-code-border)',
  },
  'hljs-comment': {
    color: 'var(--theme-code-comment)',
    fontStyle: 'italic',
  },
  'hljs-quote': {
    color: 'var(--theme-code-comment)',
    fontStyle: 'italic',
  },
  'hljs-keyword': {
    color: 'var(--theme-code-keyword)',
    fontWeight: 'bold',
  },
  'hljs-selector-tag': {
    color: 'var(--theme-code-keyword)',
    fontWeight: 'bold',
  },
  'hljs-subst': {
    color: 'var(--theme-code-keyword)',
    fontWeight: 'bold',
  },
  'hljs-number': {
    color: 'var(--theme-code-number)',
  },
  'hljs-literal': {
    color: 'var(--theme-code-number)',
  },
  'hljs-variable': {
    color: 'var(--theme-code-variable)',
  },
  'hljs-template-variable': {
    color: 'var(--theme-code-variable)',
  },
  'hljs-tag': {
    color: 'var(--theme-code-keyword)',
  },
  'hljs-name': {
    color: 'var(--theme-code-keyword)',
  },
  'hljs-selector-id': {
    color: 'var(--theme-code-keyword)',
  },
  'hljs-selector-class': {
    color: 'var(--theme-code-keyword)',
  },
  'hljs-regexp': {
    color: 'var(--theme-code-string)',
  },
  'hljs-link': {
    color: 'var(--theme-code-string)',
  },
  'hljs-string': {
    color: 'var(--theme-code-string)',
  },
  'hljs-bullet': {
    color: 'var(--theme-code-string)',
  },
  'hljs-type': {
    color: 'var(--theme-code-type)',
  },
  'hljs-title': {
    color: 'var(--theme-code-type)',
  },
  'hljs-section': {
    color: 'var(--theme-code-type)',
  },
  'hljs-attribute': {
    color: 'var(--theme-code-type)',
  },
  'hljs-built_in': {
    color: 'var(--theme-code-function)',
  },
  'hljs-builtin-name': {
    color: 'var(--theme-code-function)',
  },
  'hljs-params': {
    color: 'var(--theme-code-text)',
  },
  'hljs-class': {
    color: 'var(--theme-code-type)',
  },
  'hljs-function': {
    color: 'var(--theme-code-function)',
  },
  'hljs-meta': {
    color: 'var(--theme-code-constant)',
  },
  'hljs-symbol': {
    color: 'var(--theme-code-constant)',
  },
  'hljs-deletion': {
    background: 'var(--theme-destructive)',
    color: 'var(--theme-destructive-foreground)',
  },
  'hljs-addition': {
    background: 'var(--theme-success-bg)',
    color: 'var(--theme-success)',
  },
  'hljs-emphasis': {
    fontStyle: 'italic',
  },
  'hljs-strong': {
    fontWeight: 'bold',
  },
});
