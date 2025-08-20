import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAsync } from '@/hooks/use-async';
import { ChevronLeftIcon, DownloadIcon, HomeIcon, LoaderIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { FilePreviewContainer } from './file-preview-container';
import { FilePreviewPluginManager } from './file-preview-plugin-manager';

const pluginManager = new FilePreviewPluginManager();

interface WorkspaceFileProps {
  blob: Blob;
  filePath: string;
  isRootDirectory: boolean;
  onBackClick: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}

export const WorkspaceFile = ({
  blob,
  filePath,
  isRootDirectory,
  onBackClick,
  onDownload,
  isDownloading,
}: WorkspaceFileProps) => {
  useEffect(() => {
    const pluginPaths = ['markdown-viewer', 'csv-viewer', 'video-viewer', 'audio-viewer', 'html-viewer'];
    pluginManager.loadAllPlugins(pluginPaths);
  }, []);

  return (
    <div className="h-full overflow-auto p-4">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRootDirectory ? (
                <HomeIcon className="text-muted-foreground h-5 w-5" />
              ) : (
                <Button variant="ghost" size="icon" onClick={onBackClick} className="h-6 w-6" title="Return to parent directory">
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
              )}
              <CardTitle className="text-base">File: {filePath}</CardTitle>
            </div>
            <Button onClick={onDownload} variant="outline" size="sm" disabled={isDownloading} title="Download file">
              {isDownloading ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-full overflow-auto">
          <div className="h-full rounded-md border">
            {blob.type.includes('image') || filePath.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i) ? (
              <Image
                src={URL.createObjectURL(blob)}
                alt={filePath || 'File preview'}
                width={800}
                height={600}
                className="h-auto w-full object-contain"
              />
            ) : (
              <FileContent blob={blob} path={filePath} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FileContent = ({ blob, path }: { blob: Blob; path: string }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: content, isLoading } = useAsync(
    async () => {
      return await blob.text();
    },
    [],
    { deps: [blob] },
  );

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
      }, 1000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderIcon className="text-primary h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!content) {
    return <div className="text-muted-foreground p-4 text-center">Could not load file content</div>;
  }

  const fileType = path.split('.').pop()?.toLowerCase() || '';
  const plugin = pluginManager.getPluginForFileType(fileType);
  if (plugin) {
    return (
      <FilePreviewContainer
        fileContent={content}
        fileType={fileType}
        fileName={path}
        fileUrl={`/api/workspace/${path}`}
        pluginManager={pluginManager}
      />
    );
  }

  if (content.length > 100000 || /[\x00-\x08\x0E-\x1F]/.test(content.substring(0, 1000))) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground mb-2">File is too large or contains binary content</p>
        <Button onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <>
              <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              Downloading...
            </>
          ) : (
            'Download'
          )}
        </Button>
      </div>
    );
  }

  const language = getFileLanguage(path);
  return (
    <SyntaxHighlighter
      language={language}
      showLineNumbers
      style={githubGist}
      customStyle={{
        fontSize: '0.875rem',
        lineHeight: '1.5',
        margin: 0,
        borderRadius: 0,
      }}
    >
      {content}
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
  };
  return languageMap[ext || ''] || 'text';
};