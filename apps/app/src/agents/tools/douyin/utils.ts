/**
 * 抖音工具包共享工具函数
 */

/**
 * 解析抖音分享链接，提取视频 ID
 * 支持格式：
 * - https://v.douyin.com/xxxxx/ (短链接)
 * - https://www.douyin.com/video/xxxxx (完整链接)
 */
export function parseDouyinUrl(url: string): { videoId: string | null; isValid: boolean } {
  try {
    // 处理短链接 v.douyin.com
    if (url.includes('v.douyin.com')) {
      // 短链接需要先解析，这里先返回标记，实际解析在获取信息时进行
      const match = url.match(/v\.douyin\.com\/([^/?]+)/);
      if (match && match[1]) {
        return { videoId: match[1], isValid: true };
      }
    }

    // 处理完整链接
    const fullMatch = url.match(/douyin\.com\/video\/(\d+)/);
    if (fullMatch && fullMatch[1]) {
      return { videoId: fullMatch[1], isValid: true };
    }

    // 直接是视频 ID
    if (/^\d+$/.test(url.trim())) {
      return { videoId: url.trim(), isValid: true };
    }

    return { videoId: null, isValid: false };
  } catch {
    return { videoId: null, isValid: false };
  }
}

/**
 * 使用 yt-dlp 或解析 API 获取抖音视频信息
 * 这里提供一个通用的解析接口
 */
export interface DouyinVideoInfo {
  videoId: string;
  title: string;
  author: {
    name: string;
    id: string;
    avatar?: string;
  };
  videoUrl: string;
  coverUrl?: string;
  duration?: number;
  description?: string;
  stats: {
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    viewCount?: number;
  };
  publishTime?: string;
}

/**
 * 解析抖音视频信息
 * 使用 TikHub.io API 服务
 */
export async function parseDouyinVideo(url: string): Promise<DouyinVideoInfo> {
  // 使用 TikHub.io API
  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) {
    throw new Error('TIKHUB_API_KEY environment variable is not set. Please configure it in your environment.');
  }

  // 根据地理位置选择 API 域名
  // 中国大陆用户使用 api.tikhub.dev，其他地区使用 api.tikhub.io
  const apiBaseUrl = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io';

  try {
    // 调用 TikHub API 获取视频信息
    // TikHub API 端点格式可能因版本而异，如果此端点不工作，请参考最新文档调整
    // 常见端点格式：
    // - /api/v1/douyin/web/fetch_one_video
    // - /api/v1/douyin/video/info
    // - /api/v1/douyin/fetch_one_video
    const apiEndpoint = process.env.TIKHUB_API_ENDPOINT || '/api/v1/douyin/web/fetch_one_video';
    const response = await fetch(`${apiBaseUrl}${apiEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        video_url: url,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TikHub API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // 解析 TikHub API 返回的数据结构
    // TikHub 返回格式：{ status: 'success', data: {...} } 或 { status: 'error', message: '...' }
    if (data.status === 'error' || !data.data) {
      throw new Error(data.message || data.error || 'Failed to parse video info');
    }

    const videoData = data.data;

    // 提取视频信息（根据 TikHub API 实际返回格式调整）
    return {
      videoId: videoData.aweme_id || videoData.video_id || videoData.id || '',
      title: videoData.desc || videoData.title || videoData.description || '无标题',
      author: {
        name: videoData.author?.nickname || videoData.author?.name || videoData.nickname || '未知作者',
        id: videoData.author?.uid || videoData.author?.unique_id || videoData.author_id || '',
        avatar: videoData.author?.avatar || videoData.author?.avatar_url || videoData.avatar,
      },
      videoUrl: videoData.video?.play_addr?.url_list?.[0] || videoData.video?.play_url || videoData.video_url || '',
      coverUrl: videoData.video?.cover?.url_list?.[0] || videoData.video?.cover?.url || videoData.cover || videoData.thumbnail || '',
      duration: videoData.video?.duration || videoData.duration,
      description: videoData.desc || videoData.description || '',
      stats: {
        likeCount: videoData.statistics?.digg_count || videoData.digg_count || videoData.like_count,
        commentCount: videoData.statistics?.comment_count || videoData.comment_count,
        shareCount: videoData.statistics?.share_count || videoData.share_count,
        viewCount: videoData.statistics?.play_count || videoData.play_count || videoData.view_count,
      },
      publishTime: videoData.create_time
        ? new Date(videoData.create_time * 1000).toISOString()
        : videoData.timestamp
          ? new Date(videoData.timestamp * 1000).toISOString()
          : undefined,
    };
  } catch (error) {
    throw new Error(`Failed to parse Douyin video: ${error instanceof Error ? error.message : String(error)}`);
  }
}
