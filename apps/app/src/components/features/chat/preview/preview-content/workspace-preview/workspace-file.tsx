import { Markdown } from '@/components/block/markdown/markdown';
import { Syntax } from '@/components/block/syntax';
interface WorkspaceFileProps {
  filePath: string;
}

export const WorkspaceFile = ({ filePath }: WorkspaceFileProps) => {
  const src = filePath.startsWith('/') ? `/api/workspace${filePath}` : `/api/workspace/${filePath}`;
  return (
    <div className="h-full overflow-auto">
      <FileContent path={src} />
    </div>
  );
};

const FileContent = ({ path }: { path: string }) => {
  const language = getFileLanguage(path);

  if (language === 'markdown') {
    return <Markdown src={path} />;
  }

  if (language === 'image') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <img src={path} alt={path} className="h-auto max-h-[80%] w-auto max-w-[80%] rounded-md object-contain" />
      </div>
    );
  }

  if (language === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <video src={path} className="h-auto max-h-[80%] w-auto max-w-[80%] rounded-md object-contain" controls />
      </div>
    );
  }

  if (language === 'audio') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <audio src={path} className="h-20 max-h-[80%] w-full max-w-[80%] rounded-md object-contain" controls />
      </div>
    );
  }

  return <Syntax src={path} />;
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
