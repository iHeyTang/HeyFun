import { useAsync } from '@/hooks/use-async';
import { LoaderIcon } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark, a11yLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useTheme } from 'next-themes';

export const Syntax = ({ language, content, src }: { language?: string; content?: string; src?: string }) => {
  const theme = useTheme();
  const { data, isLoading } = useAsync(
    async () => {
      if (src) {
        const response = await fetch(src);
        const language = getFileLanguage(src);
        const content = await response.text();
        return { content, language };
      }
      return { content, language };
    },
    [],
    { deps: [src, content, language] },
  );

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderIcon className="text-primary h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <SyntaxHighlighter
      language={data?.language}
      showLineNumbers
      style={theme.theme === 'dark' ? a11yDark : a11yLight}
      customStyle={{ margin: 0 }}
      lineNumberStyle={{
        paddingLeft: '0.5em',
        fontSize: '0.8125rem',
        userSelect: 'none',
        opacity: 0.4,
      }}
    >
      {data?.content || ''}
    </SyntaxHighlighter>
  );
};

const getFileLanguage = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    rs: 'rust',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    md: 'markdown',
    txt: 'text',
    log: 'text',
    ini: 'ini',
    toml: 'toml',
    conf: 'conf',
    env: 'env',
    dockerfile: 'dockerfile',
    'docker-compose': 'yaml',
    csv: 'csv',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    svg: 'image',
    webp: 'image',
    bmp: 'image',
    webm: 'video',
    mp4: 'video',
    avi: 'video',
    mkv: 'video',
    wmv: 'video',
    mov: 'video',
    m4v: 'video',
    mpg: 'video',
    mpeg: 'video',
    mp3: 'audio',
    wav: 'audio',
    aac: 'audio',
    flac: 'audio',
    m4a: 'audio',
    ogg: 'audio',
    wma: 'audio',
  };
  return languageMap[ext || ''] || 'text';
};
