'use client';

import { useSessionAssets } from '@/hooks/use-session-assets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, File, Wrench, ChevronRight, Circle, CheckCircle2, XCircle, ChevronLeft, Globe, Clock } from 'lucide-react';
import { ChatMessages } from '@prisma/client';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { ImagePreview } from '@/components/block/preview/image-preview';
import { VideoPreview } from '@/components/block/preview/video-preview';
import { PresentationPreview } from '@/components/block/preview/presentation-preview';
import { NoteContentPreview } from '@/components/block/preview/note-preview';
import { AudioPlayer } from '@/components/block/audio-player';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useBuiltinTools } from '@/hooks/use-builtin-tools';
import { WebSearchResult } from './tool-renderers/web-search-result';
import { ImageSearchResult } from './tool-renderers/image-search-result';
import { AigcModelsResult } from './tool-renderers/aigc-models-result';
import { InitializeAgentResult } from './tool-renderers/initialize-agent-result';
import { PresentationResult } from './tool-renderers/presentation-result';
import { BrowserNavigateResult } from './tool-renderers/browser-navigate-result';
import { BrowserClickResult } from './tool-renderers/browser-click-result';
import { BrowserExtractContentResult } from './tool-renderers/browser-extract-content-result';
import { BrowserDownloadResult } from './tool-renderers/browser-download-result';
import { ConfigureEnvironmentVariableResult } from './tool-renderers/configure-environment-variable-result';
import { NoteCreateResult } from './tool-renderers/note-create-result';
import { NoteEditResult } from './tool-renderers/note-edit-result';
import { NoteReadResult } from './tool-renderers/note-read-result';
import { Badge } from '@/components/ui/badge';

interface AgentsComputerProps {
  sessionId: string;
  messages: ChatMessages[];
  onCollapse?: () => void;
  selectedToolCallIdRef?: React.MutableRefObject<string | null>;
  toolSelectTrigger?: number; // 用于触发工具选择更新
}

type ViewMode = 'stages' | 'assets';
type SelectedItem = { type: 'stage'; stageIndex: number } | { type: 'asset'; asset: any } | null;

// 判断文件是否为 PDF
function isPdfFile(fileName?: string, mimeType?: string): boolean {
  if (!fileName && !mimeType) return false;
  const name = fileName || '';
  const mime = mimeType || '';
  return name.toLowerCase().endsWith('.pdf') || mime.toLowerCase().includes('application/pdf');
}

// 判断是否为笔记类型
function isNoteAsset(metadata?: any): boolean {
  return !!(metadata && typeof metadata === 'object' && 'noteId' in metadata && metadata.noteId);
}

function getAssetTypeLabel(type: string, metadata?: any) {
  if (metadata?.noteId) {
    return '笔记';
  }
  switch (type) {
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'audio':
      return '音频';
    case 'document':
      return '文档';
    case 'code':
      return '代码';
    case 'presentation':
      return '演示文稿';
    default:
      return '其他';
  }
}

// 素材卡片组件
function AssetCard({ asset, onClick }: { asset: any; onClick: () => void }) {
  const { getSignedUrl } = useSignedUrl();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const typeLabel = getAssetTypeLabel(asset.type, asset.metadata);
  const isPdf = asset.type === 'document' && isPdfFile(asset.fileName, asset.mimeType);
  const isNote = isNoteAsset(asset.metadata);
  const noteId = asset.metadata?.noteId;

  useEffect(() => {
    if (!fileUrl) {
      getSignedUrl(asset.fileKey)
        .then(url => setFileUrl(url || null))
        .catch(() => {
          // 忽略错误
        });
    }
  }, [asset.fileKey, fileUrl, getSignedUrl]);

  return (
    <button
      onClick={onClick}
      className="hover:border-primary/50 border-border/40 bg-card group relative flex flex-col overflow-hidden rounded-lg border transition-all hover:shadow-md"
    >
      {/* 预览区域 */}
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        {!fileUrl ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-muted-foreground/50 h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {asset.type === 'image' && <ImagePreview src={fileUrl} alt={asset.title || asset.fileName} className="h-full w-full object-cover" />}
            {asset.type === 'video' && <VideoPreview src={fileUrl} className="h-full w-full object-cover" autoPlayOnHover={false} />}
            {asset.type === 'presentation' && (
              <div className="relative h-full w-full overflow-hidden" style={{ pointerEvents: 'auto' }}>
                <PresentationPreview
                  htmlUrl={fileUrl}
                  title={asset.title || asset.fileName}
                  className="h-full w-full border-0 bg-transparent p-0"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            )}
            {asset.type === 'audio' && (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                <div className="text-center">
                  <File className="text-primary mx-auto h-12 w-12" />
                  <div className="text-muted-foreground mt-2 text-xs">音频文件</div>
                </div>
              </div>
            )}
            {isPdf && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <File className="text-primary mx-auto h-12 w-12" />
                  <div className="text-muted-foreground mt-2 text-xs">PDF 文档</div>
                </div>
              </div>
            )}
            {isNote && (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <div className="text-center">
                  <File className="text-primary mx-auto h-12 w-12" />
                  <div className="text-muted-foreground mt-2 text-xs">笔记</div>
                </div>
              </div>
            )}
            {!['image', 'video', 'presentation', 'audio'].includes(asset.type) && !isPdf && !isNote && (
              <div className="flex h-full items-center justify-center">
                <File className="text-muted-foreground/50 h-12 w-12" />
              </div>
            )}
          </>
        )}

        {/* 类型标签 */}
        <div className="absolute left-2 top-2 z-10">
          <span className="rounded bg-black/60 px-2 py-1 text-xs text-white">{typeLabel}</span>
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-3">
        <div className="truncate text-sm font-medium">{asset.title || asset.fileName}</div>
        {asset.description && <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{asset.description}</div>}
        <div className="text-muted-foreground mt-1 text-xs">{(asset.fileSize / 1024).toFixed(1)} KB</div>
      </div>
    </button>
  );
}

// 工具渲染器映射（移到组件外部）
const TOOL_RENDERERS: Record<
  string,
  React.ComponentType<{
    args?: Record<string, any>;
    result?: any;
    status: 'pending' | 'running' | 'success' | 'error';
    error?: string;
    messageId?: string;
    toolCallId?: string;
    sessionId?: string;
  }>
> = {
  web_search: WebSearchResult,
  image_search: ImageSearchResult,
  get_aigc_models: AigcModelsResult,
  initialize_agent: InitializeAgentResult,
  generate_presentation: PresentationResult,
  browser_navigate: BrowserNavigateResult,
  browser_click: BrowserClickResult,
  browser_extract_content: BrowserExtractContentResult,
  browser_download: BrowserDownloadResult,
  configure_environment_variable: ConfigureEnvironmentVariableResult,
  note_create: NoteCreateResult,
  note_edit: NoteEditResult,
  note_read: NoteReadResult,
};

/**
 * Agent's Computer 组件
 * 展示 Agent 的工具调用详情和产出的素材详情
 */
export function AgentsComputer({ sessionId, messages, onCollapse, selectedToolCallIdRef, toolSelectTrigger }: AgentsComputerProps) {
  // 获取素材数据
  const { data: assetsData, isLoading: assetsLoading, error: assetsError } = useSessionAssets(sessionId, { enabled: true });
  const assets = assetsData?.assets || [];

  // 当前视图模式：阶段或素材库
  const [viewMode, setViewMode] = useState<ViewMode>('stages');
  // 选中的项目：阶段索引或素材
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  // 当前选中的工具（全局索引，跨所有阶段）
  const [selectedToolIndex, setSelectedToolIndex] = useState<number>(0);
  // 当前选中的素材（用于素材详情视图）
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // 提取所有阶段（按消息分组，每个有工具调用的 assistant 消息是一个阶段）
  const stages = useMemo(() => {
    const stagesList: Array<{ toolCalls: PrismaJson.ToolCall[]; toolResults?: PrismaJson.ToolResult[]; messageId: string; index: number }> = [];

    let stageIndex = 0;
    messages.forEach(message => {
      if (message.role === 'assistant' && message.toolCalls) {
        const toolCalls = message.toolCalls as PrismaJson.ToolCall[];
        const toolResults = message.toolResults as PrismaJson.ToolResult[] | undefined;

        // 为每条有工具调用的消息创建一个阶段
        if (toolCalls.length > 0) {
          stagesList.push({
            toolCalls: toolCalls,
            toolResults,
            messageId: message.id,
            index: stageIndex++,
          });
        }
      }
    });

    return stagesList;
  }, [messages]);

  // 提取所有工具（按调用顺序，跨所有阶段）
  const allTools = useMemo(() => {
    const toolsList: Array<{
      toolCall: PrismaJson.ToolCall;
      toolResult?: PrismaJson.ToolResult;
      messageId: string;
      stageIndex: number;
      toolIndex: number;
      globalIndex: number;
    }> = [];

    let globalIndex = 0;
    stages.forEach((stage, stageIdx) => {
      stage.toolCalls.forEach((toolCall, toolIdx) => {
        // 尝试通过 toolCallId 匹配（优先）
        let toolResult = stage.toolResults?.find(r => {
          // 确保 toolCallId 存在且匹配
          if (r.toolCallId && toolCall.id) {
            return r.toolCallId === toolCall.id;
          }
          return false;
        });

        // 如果通过 toolCallId 没找到，尝试通过 toolName 匹配
        if (!toolResult && stage.toolResults) {
          toolResult = stage.toolResults.find(r => r.toolName === toolCall.function.name);
        }

        // 如果还是没找到，且工具结果数量等于工具调用数量，按索引匹配
        if (!toolResult && stage.toolResults && stage.toolResults.length === stage.toolCalls.length) {
          toolResult = stage.toolResults[toolIdx];
        }

        toolsList.push({
          toolCall,
          toolResult,
          messageId: stage.messageId,
          stageIndex: stageIdx,
          toolIndex: toolIdx,
          globalIndex: globalIndex++,
        });
      });
    });

    return toolsList;
  }, [stages]);

  // 默认选中第一个工具
  useEffect(() => {
    if (viewMode === 'stages' && allTools.length > 0 && selectedToolIndex === 0 && selectedItem === null) {
      setSelectedToolIndex(0);
    }
  }, [allTools, viewMode, selectedToolIndex, selectedItem]);

  // 监听外部工具选择请求
  useEffect(() => {
    if (!selectedToolCallIdRef?.current) return;

    const toolCallId = selectedToolCallIdRef.current;
    const toolIndex = allTools.findIndex(tool => tool.toolCall.id === toolCallId);
    if (toolIndex >= 0) {
      setViewMode('stages');
      setSelectedToolIndex(toolIndex);
      selectedToolCallIdRef.current = null; // 清除请求
    }
  }, [allTools, selectedToolCallIdRef, toolSelectTrigger]); // 使用 toolSelectTrigger 来触发更新

  // 获取当前选中的工具
  const selectedTool = useMemo(() => {
    if (selectedToolIndex >= 0 && selectedToolIndex < allTools.length) {
      return allTools[selectedToolIndex];
    }
    return null;
  }, [selectedToolIndex, allTools]);

  // 计算统计数据
  const stats = useMemo(() => {
    const totalTools = allTools.length;
    const successCount = allTools.filter(tool => tool.toolResult?.success).length;
    const failedCount = allTools.filter(tool => tool.toolResult && !tool.toolResult.success).length;
    return { totalTools, successCount, failedCount };
  }, [allTools]);

  // 处理滑块值变化
  const handleSliderChange = (value: number[]) => {
    const newIndex = (value[0] ?? 1) - 1; // 滑块从1开始，索引从0开始
    if (newIndex >= 0 && newIndex < allTools.length) {
      setSelectedToolIndex(newIndex);
    }
  };

  // 跳转到上一个工具
  const handlePrevious = () => {
    if (selectedToolIndex > 0) {
      setSelectedToolIndex(selectedToolIndex - 1);
    }
  };

  // 跳转到下一个工具
  const handleNext = () => {
    if (selectedToolIndex < allTools.length - 1) {
      setSelectedToolIndex(selectedToolIndex + 1);
    }
  };

  // 跳转到最新工具
  const handleJumpToLatest = () => {
    if (allTools.length > 0) {
      setSelectedToolIndex(allTools.length - 1);
    }
  };

  // 获取当前选中工具的完成时间
  const toolCompletionTime = useMemo(() => {
    if (!selectedTool || !selectedTool.toolResult) {
      return null; // 工具未完成，不显示时间
    }

    // 从消息中获取创建时间作为工具完成时间的近似值
    const message = messages.find(msg => msg.id === selectedTool.messageId);
    if (!message) {
      return null;
    }

    return message.createdAt;
  }, [selectedTool, messages]);

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-3xl py-2 shadow-none">
      <CardHeader className="[.border-b]:pb-2 flex flex-row items-center justify-between space-y-0 border-b">
        {/* 工具/素材切换 */}
        <div className="text-muted-foreground text-sm font-bold">{"HeyFun's Computer"}</div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode('stages');
                setSelectedItem(null);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'stages' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>工具</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode('assets');
                setSelectedItem(null);
                setSelectedAsset(null);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'assets' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <File className="h-3.5 w-3.5" />
              <span>素材</span>
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onCollapse} aria-label="收起侧边栏" title="收起侧边栏">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 px-2">
        {/* 工具调用视图 */}
        {viewMode === 'stages' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 工具详情内容 - 可滚动区域 */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4 p-4">
                  {selectedTool ? (
                    <SingleToolView
                      toolCall={selectedTool.toolCall}
                      toolResult={selectedTool.toolResult}
                      messageId={selectedTool.messageId}
                      sessionId={sessionId}
                    />
                  ) : allTools.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
                      <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                        <Wrench className="h-6 w-6 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">暂无工具调用</p>
                      <p className="text-muted-foreground mt-1 text-xs">工具执行结果将显示在这里</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
                      <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                        <Wrench className="h-6 w-6 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">选择一个工具查看详情</p>
                      <p className="text-muted-foreground mt-1 text-xs">使用底部导航控制选择工具</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* 时间轴导航控制 - 固定在底部 */}
            {allTools.length > 0 && (
              <div className="border-border/30 flex-shrink-0 space-y-2 border-t px-4 pt-2">
                {/* 顶部状态栏 */}
                <div className="border-border/30 flex items-center justify-between border-b px-2 pb-2">
                  {/* 左侧：统计信息 */}
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="font-medium tabular-nums">{stats.totalTools} 个工具</span>
                    {stats.successCount > 0 && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="tabular-nums">{stats.successCount} 成功</span>
                      </>
                    )}
                    {stats.failedCount > 0 && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="tabular-nums">{stats.failedCount} 失败</span>
                      </>
                    )}
                  </div>

                  {/* 右侧：时间戳 */}
                  {toolCompletionTime && (
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="tabular-nums">
                        {toolCompletionTime.toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* 底部导航控制 */}
                <div className="flex items-center gap-3">
                  {/* 左侧：箭头和索引 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevious}
                      disabled={selectedToolIndex === 0}
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-200',
                        selectedToolIndex === 0
                          ? 'text-muted-foreground/30 cursor-not-allowed'
                          : 'text-foreground/70 hover:bg-muted hover:text-foreground cursor-pointer',
                      )}
                      aria-label="上一个工具"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="text-foreground min-w-[2.5rem] text-xs font-medium tabular-nums">
                      {selectedToolIndex + 1}/{allTools.length}
                    </span>

                    <button
                      onClick={handleNext}
                      disabled={selectedToolIndex === allTools.length - 1}
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-200',
                        selectedToolIndex === allTools.length - 1
                          ? 'text-muted-foreground/30 cursor-not-allowed'
                          : 'text-foreground/70 hover:bg-muted hover:text-foreground cursor-pointer',
                      )}
                      aria-label="下一个工具"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 中间：滑块 */}
                  <div className="flex-1">
                    <Slider
                      value={[selectedToolIndex + 1]}
                      onValueChange={handleSliderChange}
                      min={1}
                      max={allTools.length}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* 右侧：跳转到最新 */}
                  <Badge
                    variant="outline"
                    onClick={handleJumpToLatest}
                    className={cn(selectedToolIndex === allTools.length - 1 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer')}
                  >
                    <div className="bg-primary mr-1 size-1.5 rounded-full" />
                    <span>跳转到最新</span>
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 素材库视图 */}
        {viewMode === 'assets' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 面包屑导航 */}
            {selectedAsset && (
              <div className="border-border/40 flex items-center gap-2 border-b px-4 py-2.5">
                <button onClick={() => setSelectedAsset(null)} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  <span>素材库</span>
                </button>
                <ChevronRight className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">{selectedAsset.title || selectedAsset.fileName}</span>
              </div>
            )}

            {/* 内容区域 */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {selectedAsset ? (
                  <div className="h-full p-4">
                    <AssetPreview asset={selectedAsset} />
                  </div>
                ) : (
                  <div className="p-4">
                    {assetsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                      </div>
                    ) : assetsError ? (
                      <div className="text-muted-foreground py-12 text-center">
                        <p className="text-sm">加载素材列表失败</p>
                      </div>
                    ) : assets.length === 0 ? (
                      <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
                        <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                          <File className="h-6 w-6 opacity-50" />
                        </div>
                        <p className="text-sm font-medium">暂无素材</p>
                        <p className="text-muted-foreground mt-1 text-xs">生成的素材将显示在这里</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {assets.map(asset => (
                          <AssetCard key={asset.id} asset={asset} onClick={() => setSelectedAsset(asset)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 单个工具视图组件
function SingleToolView({
  toolCall,
  toolResult,
  messageId,
  sessionId,
}: {
  toolCall?: PrismaJson.ToolCall;
  toolResult?: PrismaJson.ToolResult;
  messageId: string;
  sessionId: string;
}) {
  const { getToolDisplayName } = useBuiltinTools();

  if (!toolCall) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
        <Wrench className="mb-4 h-8 w-8 opacity-50" />
        <p className="text-sm">未找到工具</p>
      </div>
    );
  }

  const parseArguments = (args: string) => {
    try {
      return JSON.parse(args);
    } catch {
      return args;
    }
  };

  const args = parseArguments(toolCall.function.arguments);
  const toolName = toolCall.function.name;
  const CustomRenderer = TOOL_RENDERERS[toolName];
  const status = toolResult ? (toolResult.success ? 'success' : 'error') : 'running';

  // 渲染工具结果内容
  const renderToolContent = () => {
    if (CustomRenderer) {
      return (
        <CustomRenderer
          args={args}
          result={toolResult?.data}
          status={status}
          error={toolResult?.error}
          messageId={messageId}
          toolCallId={toolCall.id}
          sessionId={sessionId}
        />
      );
    }

    if (toolResult) {
      return (
        <pre className="text-muted-foreground bg-background overflow-x-auto rounded-md p-3 text-xs leading-relaxed">
          <code>
            {toolResult.success
              ? typeof toolResult.data === 'object'
                ? JSON.stringify(toolResult.data, null, 2)
                : String(toolResult.data)
              : toolResult.error}
          </code>
        </pre>
      );
    }

    return (
      <div className="text-muted-foreground/70 bg-background flex items-center gap-2 rounded-md p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>正在执行中...</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 工具头部 - 简化设计，与内容合并 */}
      <div className="border-border/40 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded">
            <Wrench className="text-primary h-3.5 w-3.5" />
          </div>
          <div className="text-sm font-medium">{getToolDisplayName(toolCall.function.name)}</div>
        </div>
        <div className="flex-shrink-0">
          {toolResult ? (
            toolResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
            )
          ) : (
            <Loader2 className="text-primary h-4 w-4 animate-spin" />
          )}
        </div>
      </div>

      {/* 工具内容 */}
      <div className="space-y-3">
        {/* 输入参数 - 只有在没有自定义渲染器时才显示 */}
        {!CustomRenderer && (
          <div>
            <div className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wider">输入参数</div>
            <pre className="text-muted-foreground bg-muted/30 border-border/40 overflow-x-auto rounded-md border p-2.5 text-xs leading-relaxed">
              <code>{typeof args === 'object' ? JSON.stringify(args, null, 2) : args}</code>
            </pre>
          </div>
        )}

        {/* 输出结果 - 始终显示 */}
        <div className="min-w-0">{renderToolContent()}</div>
      </div>
    </div>
  );
}

// 素材预览组件
function AssetPreview({ asset }: { asset: any }) {
  const { getSignedUrl } = useSignedUrl();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const isPdf = asset.type === 'document' && isPdfFile(asset.fileName, asset.mimeType);
  const isNote = isNoteAsset(asset.metadata);
  const noteId = asset.metadata?.noteId;
  const typeLabel = getAssetTypeLabel(asset.type, asset.metadata);

  useEffect(() => {
    if (!fileUrl) {
      getSignedUrl(asset.fileKey)
        .then(url => setFileUrl(url || null))
        .catch(() => {
          // 忽略错误
        });
    }
  }, [asset.fileKey, fileUrl, getSignedUrl]);

  if (!fileUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 标题 */}
      <div className="mb-4 border-b pb-3">
        <h3 className="text-lg font-semibold">{asset.title || asset.fileName}</h3>
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
          <span>{typeLabel}</span>
          <span>•</span>
          <span>{(asset.fileSize / 1024).toFixed(1)} KB</span>
        </div>
        {asset.description && <p className="text-muted-foreground mt-2 text-sm">{asset.description}</p>}
      </div>

      {/* 预览内容 */}
      <div className="flex-1 overflow-auto">
        {asset.type === 'image' && (
          <div className="flex items-center justify-center">
            <ImagePreview
              src={fileUrl}
              alt={asset.title || asset.fileName}
              className="max-h-full max-w-full object-contain"
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
        {asset.type === 'video' && (
          <VideoPreview src={fileUrl} className="h-full w-full" autoPlayOnHover={false} onClick={e => e.stopPropagation()} />
        )}
        {asset.type === 'presentation' && (
          <div className="relative h-full w-full overflow-hidden" style={{ pointerEvents: 'auto' }}>
            <PresentationPreview
              htmlUrl={fileUrl}
              title={asset.title || asset.fileName}
              className="h-full w-full border-0 bg-transparent p-0"
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
        {asset.type === 'audio' && (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-4">
            <div className="w-full max-w-md">
              <AudioPlayer src={fileUrl} className="w-full" />
            </div>
          </div>
        )}
        {isPdf && fileUrl && (
          <div className="flex h-full items-center justify-center">
            <iframe src={fileUrl} className="h-full w-full rounded border" title={asset.title || asset.fileName} />
          </div>
        )}
        {isNote && noteId && (
          <div className="relative h-full w-full overflow-hidden" style={{ pointerEvents: 'auto' }}>
            <NoteContentPreview noteId={noteId} className="h-full w-full overflow-auto" />
          </div>
        )}
        {!['image', 'video', 'presentation', 'audio'].includes(asset.type) && !isPdf && !isNote && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <File className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-sm">不支持预览此类型文件</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
