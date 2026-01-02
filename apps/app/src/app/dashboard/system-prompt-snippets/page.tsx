'use client';

import { getAllSystemPromptSnippets, searchSnippetsByRAG } from '@/actions/system-prompt-snippets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SystemPromptSnippet } from '@/actions/system-prompt-snippets';
import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, string> = {
  syntax: '语法',
  guideline: '指导',
  rule: '规则',
  example: '示例',
  knowledge: '知识',
  format: '格式',
  other: '其他',
};

const categoryColors: Record<string, string> = {
  syntax: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  guideline: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  rule: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  example: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  knowledge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  format: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  other: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

export default function SystemPromptSnippetsPage() {
  const [snippets, setSnippets] = useState<SystemPromptSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState<SystemPromptSnippet | null>(null);
  const [ragSearchQuery, setRagSearchQuery] = useState('');
  const [ragSearchResults, setRagSearchResults] = useState<(SystemPromptSnippet & { similarityScore?: number })[]>([]);
  const [ragSearching, setRagSearching] = useState(false);
  const [isRagSearchMode, setIsRagSearchMode] = useState(false);

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        const result = await getAllSystemPromptSnippets({});
        if (result.data) {
          setSnippets(result.data);
        } else {
          console.error('Failed to fetch snippets:', result.error);
        }
      } catch (error) {
        console.error('Error fetching snippets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSnippets();
  }, []);

  const handleRagSearch = async () => {
    if (!ragSearchQuery.trim()) {
      setIsRagSearchMode(false);
      setRagSearchResults([]);
      return;
    }

    setRagSearching(true);
    setIsRagSearchMode(true);
    try {
      const result = await searchSnippetsByRAG({ query: ragSearchQuery.trim(), topK: 20 });
      if (result.data) {
        setRagSearchResults(result.data);
      } else {
        console.error('RAG搜索失败:', result.error);
        setRagSearchResults([]);
      }
    } catch (error) {
      console.error('RAG搜索错误:', error);
      setRagSearchResults([]);
    } finally {
      setRagSearching(false);
    }
  };

  const handleClearRagSearch = () => {
    setRagSearchQuery('');
    setIsRagSearchMode(false);
    setRagSearchResults([]);
  };

  const categories = Array.from(new Set(snippets.map(s => s.category).filter(Boolean))) as string[];
  const sections = Array.from(new Set(snippets.map(s => s.section).filter(Boolean))) as string[];

  const filteredSnippets = isRagSearchMode
    ? Array.isArray(ragSearchResults)
      ? ragSearchResults
      : []
    : snippets.filter(snippet => {
        if (selectedCategory && snippet.category !== selectedCategory) return false;
        if (selectedSection && snippet.section !== selectedSection) return false;
        return true;
      });

  // 只在非RAG搜索模式下计算分组
  const groupedBySection = isRagSearchMode
    ? {}
    : filteredSnippets.reduce(
        (acc, snippet) => {
          const section = snippet.section || '其他';
          if (!acc[section]) {
            acc[section] = [];
          }
          acc[section].push(snippet);
          return acc;
        },
        {} as Record<string, SystemPromptSnippet[]>,
      );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="mb-4 shrink-0">
        <h1 className="text-lg font-bold">提示词片段</h1>
        <p className="text-muted-foreground text-sm">查看所有 AI 可用的系统提示词片段</p>
      </div>

      {/* RAG搜索框 */}
      <div className="mb-4 shrink-0">
        <div className="relative">
          <Search className="text-muted-foreground/50 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="使用RAG搜索提示词片段（输入自然语言描述）..."
            value={ragSearchQuery}
            onChange={e => setRagSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !ragSearching) {
                handleRagSearch();
              }
            }}
            className="border-border/50 bg-background/50 focus:ring-ring/20 pl-10 pr-20"
            disabled={ragSearching}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {!ragSearching && !!ragSearchQuery && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClearRagSearch} disabled={ragSearching}>
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleRagSearch} disabled={ragSearching || !ragSearchQuery.trim()} className="h-7">
              {ragSearching ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  搜索中
                </>
              ) : (
                <>搜索</>
              )}
            </Button>
          </div>
        </div>
        {isRagSearchMode && <div className="text-muted-foreground mt-2 text-xs">正在显示RAG搜索结果（{ragSearchResults.length} 个相关片段）</div>}
      </div>

      {/* 筛选器 */}
      {!isRagSearchMode && (
        <div className="mb-4 flex shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">分类：</span>
            <Badge variant={selectedCategory === null ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedCategory(null)}>
              全部
            </Badge>
            {categories.map(category => (
              <Badge
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                className={cn('cursor-pointer', selectedCategory === category && categoryColors[category])}
                onClick={() => setSelectedCategory(category)}
              >
                {categoryLabels[category] || category}
              </Badge>
            ))}
          </div>
          {sections.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">章节：</span>
              <Badge variant={selectedSection === null ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedSection(null)}>
                全部
              </Badge>
              {sections.map(section => (
                <Badge
                  key={section}
                  variant={selectedSection === section ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedSection(section)}
                >
                  {section}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 统计信息 */}
      <div className="text-muted-foreground mb-4 shrink-0 text-sm">
        共 {filteredSnippets.length} 个片段
        {filteredSnippets.filter(s => s.enabled).length > 0 && (
          <span className="ml-2">（{filteredSnippets.filter(s => s.enabled).length} 个已启用）</span>
        )}
      </div>

      {/* 片段列表 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          {isRagSearchMode ? (
            // RAG搜索结果模式
            <div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {ragSearchResults.map(snippet => (
                  <Card
                    key={snippet.id}
                    className={cn('cursor-pointer gap-0 p-3 transition-all hover:shadow-md', !snippet.enabled && 'opacity-60')}
                    onClick={() => setSelectedSnippet(snippet)}
                  >
                    {/* 相似度分数 */}
                    {snippet.similarityScore !== undefined && (
                      <div className="text-muted-foreground mb-2 text-xs">相似度: {(snippet.similarityScore * 100).toFixed(1)}%</div>
                    )}
                    {/* 标题和标签在同一行 */}
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 min-w-0 flex-1 pr-2 text-sm leading-tight">{snippet.name}</CardTitle>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        {snippet.enabled ? (
                          <Badge
                            variant="default"
                            className="h-4 border-slate-500/20 bg-slate-500/10 px-1 py-0 text-[10px] leading-4 text-slate-600 dark:text-slate-400"
                          >
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-4 px-1 py-0 text-[10px] leading-4">
                            未启用
                          </Badge>
                        )}
                        {snippet.category && (
                          <Badge variant="outline" className={cn('h-4 px-1 py-0 text-[10px] leading-4', categoryColors[snippet.category])}>
                            {categoryLabels[snippet.category] || snippet.category}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 描述 */}
                    {snippet.description && (
                      <CardDescription className="text-muted-foreground/80 mb-2 line-clamp-1 text-xs leading-snug">
                        {snippet.description}
                      </CardDescription>
                    )}

                    {/* 内容预览 */}
                    <div className="bg-muted/30 mb-1.5 rounded p-1.5">
                      <pre className="text-muted-foreground m-0 line-clamp-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
                        {snippet.content}
                      </pre>
                    </div>

                    {/* 底部元信息 */}
                    <div className="text-muted-foreground/70 flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        {snippet.version && <span className="shrink-0">v{snippet.version}</span>}
                        {snippet.author && <span className="truncate">by {snippet.author}</span>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {ragSearchResults.length === 0 && !ragSearching && (
                <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">没有找到相关的片段</div>
              )}
            </div>
          ) : (
            // 正常列表模式
            Object.entries(groupedBySection).map(([section, sectionSnippets]) => (
              <div key={section}>
                <h2 className="text-muted-foreground mb-3 text-sm font-medium">{section}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {sectionSnippets.map(snippet => (
                    <Card
                      key={snippet.id}
                      className={cn('cursor-pointer gap-0 p-3 transition-all hover:shadow-md', !snippet.enabled && 'opacity-60')}
                      onClick={() => setSelectedSnippet(snippet)}
                    >
                      {/* 标题和标签在同一行 */}
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2 min-w-0 flex-1 pr-2 text-sm leading-tight">{snippet.name}</CardTitle>
                        <div className="flex shrink-0 flex-wrap gap-1">
                          {snippet.enabled ? (
                            <Badge
                              variant="default"
                              className="h-4 border-slate-500/20 bg-slate-500/10 px-1 py-0 text-[10px] leading-4 text-slate-600 dark:text-slate-400"
                            >
                              启用
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-4 px-1 py-0 text-[10px] leading-4">
                              未启用
                            </Badge>
                          )}
                          {snippet.category && (
                            <Badge variant="outline" className={cn('h-4 px-1 py-0 text-[10px] leading-4', categoryColors[snippet.category])}>
                              {categoryLabels[snippet.category] || snippet.category}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* 描述 */}
                      {snippet.description && (
                        <CardDescription className="text-muted-foreground/80 mb-2 line-clamp-1 text-xs leading-snug">
                          {snippet.description}
                        </CardDescription>
                      )}

                      {/* 内容预览 */}
                      <div className="bg-muted/30 mb-1.5 rounded p-1.5">
                        <pre className="text-muted-foreground m-0 line-clamp-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
                          {snippet.content}
                        </pre>
                      </div>

                      {/* 底部元信息 */}
                      <div className="text-muted-foreground/70 flex items-center justify-between gap-2 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          {snippet.version && <span className="shrink-0">v{snippet.version}</span>}
                          {snippet.author && <span className="truncate">by {snippet.author}</span>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
          {!isRagSearchMode && filteredSnippets.length === 0 && (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">没有找到匹配的片段</div>
          )}
        </div>
      </ScrollArea>

      {/* 详情模态框 */}
      <Dialog open={!!selectedSnippet} onOpenChange={open => !open && setSelectedSnippet(null)}>
        <DialogContent className="max-w-[90vw]! w-7xl max-h-[85vh]">
          {selectedSnippet && (
            <>
              <DialogHeader className="pr-8">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="pr-2 text-xl">{selectedSnippet.name}</DialogTitle>
                    {selectedSnippet.description && <DialogDescription className="mt-2">{selectedSnippet.description}</DialogDescription>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {selectedSnippet.enabled ? (
                      <Badge variant="default" className="border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400">
                        已启用
                      </Badge>
                    ) : (
                      <Badge variant="outline">未启用</Badge>
                    )}
                    {selectedSnippet.category && (
                      <Badge variant="outline" className={categoryColors[selectedSnippet.category]}>
                        {categoryLabels[selectedSnippet.category] || selectedSnippet.category}
                      </Badge>
                    )}
                  </div>
                </div>
                {(selectedSnippet.version || selectedSnippet.author || selectedSnippet.section) && (
                  <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-sm">
                    {selectedSnippet.section && <span>章节: {selectedSnippet.section}</span>}
                    {selectedSnippet.version && <span>版本: {selectedSnippet.version}</span>}
                    {selectedSnippet.author && <span>作者: {selectedSnippet.author}</span>}
                  </div>
                )}
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="bg-muted/30 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">{selectedSnippet.content}</pre>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
