/**
 * Douyin Get Video Info 工具结果展示组件
 */

'use client';

import { Loader2, User, Calendar, Eye, Heart, MessageCircle, Share2, Video, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DouyinGetVideoInfoResultProps {
  args?: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  sessionId?: string;
}

interface VideoInfo {
  videoId?: string;
  title?: string;
  author?: {
    name?: string;
    id?: string;
    avatar?: string;
  };
  videoUrl?: string;
  coverUrl?: string;
  duration?: number;
  description?: string;
  stats?: {
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    viewCount?: number;
  };
  publishTime?: string;
}

// 格式化数字
function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return num.toString();
}

// 格式化时长
function formatDuration(seconds?: number): string {
  if (!seconds) return '未知';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DouyinGetVideoInfoResult({ args, result, status, error }: DouyinGetVideoInfoResultProps) {
  const url = args?.url;
  const videoInfo: VideoInfo | null = result && status === 'success' ? result : null;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {url && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Video className="h-3 w-3" />
            <span>
              视频链接: <span className="text-foreground/80 break-all font-mono text-xs">{url}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '获取视频信息失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>
          正在获取视频信息: <span className="text-foreground/80 break-all font-medium">{url || '...'}</span>
        </span>
      </div>
    );
  }

  // 成功状态但没有数据
  if (!videoInfo) {
    return (
      <div className="space-y-2">
        {url && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Video className="h-3 w-3" />
            <span>
              视频链接: <span className="text-foreground/80 break-all font-mono text-xs">{url}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">获取完成，但未获取到视频信息</div>
      </div>
    );
  }

  // 成功状态 - 显示视频信息
  return (
    <div className="space-y-3">
      {/* 封面和基本信息 */}
      <div className="flex gap-3">
        {videoInfo.coverUrl && (
          <div className="relative flex-shrink-0 overflow-hidden rounded-lg border border-gray-200/50 dark:border-gray-800/50">
            <img
              src={videoInfo.coverUrl}
              alt={videoInfo.title || '视频封面'}
              className="h-32 w-32 object-cover"
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h4 className="text-sm font-medium text-foreground line-clamp-2">{videoInfo.title || '无标题'}</h4>
            {videoInfo.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{videoInfo.description}</p>
            )}
          </div>
          {videoInfo.author && (
            <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
              <User className="h-3 w-3" />
              <span>{videoInfo.author.name || '未知作者'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 统计数据 */}
      {videoInfo.stats && (
        <div className="grid grid-cols-2 gap-2">
          {videoInfo.stats.likeCount !== undefined && (
            <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
              <Heart className="h-3 w-3" />
              <span>点赞: {formatNumber(videoInfo.stats.likeCount)}</span>
            </div>
          )}
          {videoInfo.stats.commentCount !== undefined && (
            <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
              <MessageCircle className="h-3 w-3" />
              <span>评论: {formatNumber(videoInfo.stats.commentCount)}</span>
            </div>
          )}
          {videoInfo.stats.shareCount !== undefined && (
            <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
              <Share2 className="h-3 w-3" />
              <span>分享: {formatNumber(videoInfo.stats.shareCount)}</span>
            </div>
          )}
          {videoInfo.stats.viewCount !== undefined && (
            <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
              <Eye className="h-3 w-3" />
              <span>播放: {formatNumber(videoInfo.stats.viewCount)}</span>
            </div>
          )}
        </div>
      )}

      {/* 其他信息 */}
      <div className="space-y-1 border-t border-gray-200/50 pt-2 dark:border-gray-800/50">
        {videoInfo.duration !== undefined && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Video className="h-3 w-3" />
            <span>时长: {formatDuration(videoInfo.duration)}</span>
          </div>
        )}
        {videoInfo.publishTime && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Calendar className="h-3 w-3" />
            <span>发布时间: {new Date(videoInfo.publishTime).toLocaleString('zh-CN')}</span>
          </div>
        )}
        {videoInfo.videoId && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <span>
              视频 ID: <span className="text-foreground/80 font-mono">{videoInfo.videoId}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
