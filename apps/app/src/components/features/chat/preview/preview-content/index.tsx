import { FilePreviewContainer } from '@/components/features/chat/preview/preview-content/file-preview-container';
import { FilePreviewPluginManager } from '@/components/features/chat/preview/preview-content/file-preview-plugin-manager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAsync } from '@/hooks/use-async';
import useAgentTools from '@/hooks/use-tools';
import { Message } from '@/lib/browser/chat-messages/types';
import { getImageUrl } from '@/lib/browser/image';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, DownloadIcon, FileIcon, FolderIcon, GlobeIcon, HomeIcon, LoaderIcon, PackageIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { usePreviewData } from '../store';
import { ToolResult } from '@repo/agent';
import { Markdown } from '@/components/block/markdown/markdown';

const pluginManager = new FilePreviewPluginManager();

export const PreviewContent = ({ messages }: { messages: Message[] }) => {
  const { data } = usePreviewData();
  const { getToolByPrefix } = useAgentTools();

  useEffect(() => {
    const pluginPaths = ['markdown-viewer', 'csv-viewer', 'video-viewer'];
    pluginManager.loadAllPlugins(pluginPaths);
  }, []);

  if (data?.type === 'tool') {
    const executionStart = messages.find(m => m.type === 'agent:lifecycle:step:act:tool:execute:start' && m.content.id === data.executionId);
    const executionComplete = messages.find(m => m.type === 'agent:lifecycle:step:act:tool:execute:complete' && m.content.id === data.executionId);

    const tool = getToolByPrefix(executionStart?.content.name || '');
    const args = executionStart?.content.args;
    // result should be ToolResult[]. ToolResult is for deprecated data
    const result = executionComplete?.content.result as ToolResult | undefined;
    const executionId = data.executionId;
    const isExecuting = executionStart && !executionComplete;

    return (
      <div className="h-full flex-col overflow-auto">
        <Popover>
          <PopoverTrigger>
            <Badge className="cursor-pointer font-mono text-xs">
              <div className="flex items-center gap-1">
                <PackageIcon className="h-3.5 w-3.5" />
                {tool.toolName} {tool.functionName}
              </div>
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-full">
            <code className="text-xs whitespace-nowrap">ID: {executionId}</code>
          </PopoverContent>
        </Popover>
        <div className="flex-1 space-y-4 p-2">
          {args && Object.keys(args).length > 0 && (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm font-medium">Parameters</div>
              <div className="bg-silver-gradient space-y-2 rounded-md p-3">
                {Object.entries(args).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="text-muted-foreground text-xs font-medium">{key}</div>
                    <Badge variant="outline" className="font-mono break-all whitespace-normal">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result?.content) ? (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm font-medium">Result</div>
              <div className={cn('bg-silver-gradient text-foreground overflow-hidden rounded-md p-2')}>
                <Markdown className="bg-transparent">
                  {result.content
                    .map((r, index) => {
                      if (r.type === 'text') {
                        return r.text;
                      }
                      if (r.type === 'image') {
                        return `![${tool.toolName} ${tool.functionName} Image ${index}](${getImageUrl(r.data)})`;
                      }
                      if (r.type === 'resource') {
                        return `[${r.resource.uri}](${r.resource.uri})`;
                      }
                      if (r.type === 'resource_link') {
                        return `[${r.uri}](${r.uri})`;
                      }
                      if (r.type === 'audio') {
                        return <audio src={r.data} controls />;
                      }
                    })
                    .join('\n')}
                </Markdown>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm font-medium">Result</div>
              <div className={cn('bg-silver-gradient text-foreground overflow-hidden rounded-md')}>
                <SyntaxHighlighter
                  language="json"
                  showLineNumbers
                  style={githubGist}
                  customStyle={{
                    color: 'inherit',
                    backgroundColor: 'inherit',
                    fontSize: '0.75rem',
                    lineHeight: '1.5',
                    margin: 0,
                    borderRadius: 0,
                    padding: '1rem 0.8rem',
                  }}
                >
                  {typeof result === 'object' ? JSON.stringify(result, null, 2) : result}
                </SyntaxHighlighter>
              </div>
            </div>
          ) : (
            isExecuting && (
              <div className="space-y-2">
                <div className="text-muted-foreground text-sm font-medium">Result</div>
                <div className="bg-muted/40 flex items-center justify-center rounded-md p-6">
                  <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <LoaderIcon className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Processing...</span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  if (data?.type === 'browser') {
    return (
      <div className="h-full w-full overflow-hidden">
        <Link href={data.url} target="_blank" rel="noopener noreferrer" className="mb-2 block w-fit max-w-full">
          <Badge className="max-w-full cursor-pointer font-mono text-xs">
            <div className="flex items-center justify-start gap-1 overflow-hidden">
              <GlobeIcon className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">{data.title}</span>
            </div>
          </Badge>
        </Link>
        <div className="h-full rounded-2xl border p-1">
          <div className="h-full w-full overflow-auto rounded-2xl">
            <Image
              src={getImageUrl(data.screenshot)}
              alt="FunMax's Computer Screen"
              width={1920}
              height={1080}
              className="h-auto w-full"
              sizes="(max-width: 1920px) 100vw, 1920px"
              priority
            />
          </div>
        </div>
      </div>
    );
  }

  if (data?.type === 'workspace') {
    return <WorkspacePreview />;
  }

  return <NotPreview />;
};

const WorkspacePreview = () => {
  const pathname = usePathname();
  const { data, setData } = usePreviewData();
  const [isDownloading, setIsDownloading] = useState(false);

  const workspacePath = data?.type === 'workspace' ? data.path || '' : '';

  const isShare = pathname.startsWith('/share');

  // Helper to check if we're in root directory
  const isRootDirectory = !workspacePath || workspacePath.split('/').length <= 1;

  // Handle back button click - navigate to parent directory
  const handleBackClick = () => {
    if (isRootDirectory) return;

    const pathParts = workspacePath.split('/');
    pathParts.pop(); // Remove the last path segment
    const parentPath = pathParts.join('/');

    setData({
      type: 'workspace',
      path: parentPath,
    });
  };

  const handleItemClick = (item: { name: string; type: 'file' | 'directory' }) => {
    setData({
      type: 'workspace',
      path: `${workspacePath}/${item.name}`,
    });
  };

  const handleDownload = async () => {
    if (data?.type !== 'workspace') return;
    setIsDownloading(true);
    try {
      const downloadUrl = isShare ? `/api/share/download/${workspacePath}` : `/api/workspace/download/${workspacePath}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = workspacePath.split('/').pop() || 'workspace';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      // Add a small delay to show loading state
      setTimeout(() => {
        setIsDownloading(false);
      }, 1000);
    }
  };

  const { data: workspace, isLoading } = useAsync(
    async () => {
      if (data?.type !== 'workspace') return;
      const workspaceRes = await fetch(isShare ? `/api/share/workspace/${workspacePath}` : `/api/workspace/${workspacePath}`);
      if (!workspaceRes.ok) return;
      if (workspaceRes.headers.get('content-type')?.includes('application/json')) {
        return (await workspaceRes.json()) as {
          name: string;
          type: 'file' | 'directory';
          size: number;
          modifiedTime: string;
        }[];
      }
      return workspaceRes.blob();
    },
    [],
    {
      deps: [workspacePath, data?.type],
    },
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <LoaderIcon className="text-primary h-5 w-5 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-muted-foreground">Could not load workspace content</div>
      </div>
    );
  }

  if (Array.isArray(workspace)) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRootDirectory ? (
                  <HomeIcon className="text-muted-foreground h-4 w-4" />
                ) : (
                  <Button variant="ghost" size="icon" onClick={handleBackClick} className="h-6 w-6" title="Return to parent directory">
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                )}
                <CardTitle className="text-base">Workspace: {data?.type === 'workspace' && data.path ? data.path : 'Root Directory'}</CardTitle>
              </div>
              <Button onClick={handleDownload} variant="outline" size="sm" disabled={isDownloading} title="Download current directory">
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
          <CardContent>
            <div className="space-y-1">
              {workspace.length === 0 ? (
                <div className="text-muted-foreground py-4 text-center">This directory is empty</div>
              ) : (
                workspace.map(item => (
                  <div
                    key={item.name}
                    className="hover:bg-muted/40 flex cursor-pointer items-center justify-between rounded-md border p-2"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-center gap-2">
                      {item.type === 'directory' ? <FolderIcon className="h-4 w-4 text-blue-500" /> : <FileIcon className="h-4 w-4 text-gray-500" />}
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground text-xs">{formatFileSize(item.size)}</span>
                      <span className="text-muted-foreground text-xs">{new Date(item.modifiedTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRootDirectory ? (
                <HomeIcon className="text-muted-foreground h-5 w-5" />
              ) : (
                <Button variant="ghost" size="icon" onClick={handleBackClick} className="h-6 w-6" title="Return to parent directory">
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
              )}
              <CardTitle className="text-base">File: {data?.type === 'workspace' ? data.path : ''}</CardTitle>
            </div>
            <Button onClick={handleDownload} variant="outline" size="sm" disabled={isDownloading} title="Download file">
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
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            {workspace instanceof Blob &&
            (workspace.type.includes('image') || (data?.type === 'workspace' && data.path?.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i))) ? (
              <Image
                src={URL.createObjectURL(workspace)}
                alt={data?.type === 'workspace' ? data.path || 'File preview' : 'File preview'}
                width={800}
                height={600}
                className="h-auto w-full object-contain"
              />
            ) : workspace instanceof Blob ? (
              <FileContent blob={workspace} path={data?.type === 'workspace' ? data.path : ''} />
            ) : (
              <div className="text-muted-foreground p-4 text-center">This file type cannot be previewed</div>
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

  // File download function
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
      // Add a small delay to show loading state
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

  // For binary files or very large files, show a simplified view
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
        maxHeight: '500px',
      }}
    >
      {content}
    </SyntaxHighlighter>
  );
};

// Format file size helper function
const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  const kbSize = size / 1024;
  if (kbSize < 1024) return `${Math.round(kbSize)} KB`;
  const mbSize = kbSize / 1024;
  return `${mbSize.toFixed(1)} MB`;
};

const NotPreview = () => {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-pulse text-gray-500">FunMax is not using the computer right now...</div>
    </div>
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
