import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { createAssetFromTool } from '@/agents/utils/asset-helper';
import { downloadFile } from '@/lib/server/storage';
import { imageSearchParamsSchema } from './schema';

interface ImageResult {
  title: string;
  thumbnail: string;
  image: string;
  url: string;
  source: string;
  width?: number;
  height?: number;
  type: 'image';
  author?: string;
  authorUrl?: string;
}

/**
 * 使用 Unsplash API 搜索图片
 */
async function searchImagesUnsplash(query: string, maxResults: number = 10, apiKey?: string): Promise<ImageResult[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(maxResults, 30)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error! status: ${response.status}`);
    }

    const data = await response.json();
    const results: ImageResult[] = [];

    if (data.results && Array.isArray(data.results)) {
      for (const photo of data.results.slice(0, maxResults)) {
        results.push({
          title: photo.description || photo.alt_description || query,
          thumbnail: photo.urls?.thumb || photo.urls?.small,
          image: photo.urls?.regular || photo.urls?.small,
          url: photo.links?.html || photo.urls?.full,
          source: 'Unsplash',
          width: photo.width,
          height: photo.height,
          type: 'image',
          author: photo.user?.name,
          authorUrl: photo.user?.links?.html,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[ImageSearch] Unsplash image search error:', error);
    return [];
  }
}

/**
 * 使用 Pixabay API 搜索图片
 */
async function searchImagesPixabay(query: string, maxResults: number = 10, apiKey?: string): Promise<ImageResult[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${Math.min(maxResults, 200)}&safesearch=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Pixabay API error! status: ${response.status}`);
    }

    const data = await response.json();
    const results: ImageResult[] = [];

    if (data.hits && Array.isArray(data.hits)) {
      for (const hit of data.hits.slice(0, maxResults)) {
        results.push({
          title: hit.tags || query,
          thumbnail: hit.previewURL || hit.webformatURL,
          image: hit.webformatURL || hit.largeImageURL,
          url: hit.pageURL,
          source: 'Pixabay',
          width: hit.imageWidth,
          height: hit.imageHeight,
          type: 'image',
          author: hit.user,
          authorUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[ImageSearch] Pixabay image search error:', error);
    return [];
  }
}

/**
 * 使用 Pexels API 搜索图片
 */
async function searchImagesPexels(query: string, maxResults: number = 10, apiKey?: string): Promise<ImageResult[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(maxResults, 80)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API error! status: ${response.status}`);
    }

    const data = await response.json();
    const results: ImageResult[] = [];

    if (data.photos && Array.isArray(data.photos)) {
      for (const photo of data.photos.slice(0, maxResults)) {
        results.push({
          title: photo.alt || query,
          thumbnail: photo.src?.small || photo.src?.medium,
          image: photo.src?.medium || photo.src?.large,
          url: photo.url,
          source: 'Pexels',
          width: photo.width,
          height: photo.height,
          type: 'image',
          author: photo.photographer,
          authorUrl: photo.photographer_url,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[ImageSearch] Pexels image search error:', error);
    return [];
  }
}

/**
 * 合并多个图库的搜索结果
 */
async function searchImagesFromMultipleSources(query: string, maxResults: number = 10): Promise<ImageResult[]> {
  const results: ImageResult[] = [];
  const perSource = Math.ceil(maxResults / 3);

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pixabayKey = process.env.PIXABAY_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  const searchPromises: Promise<ImageResult[]>[] = [];

  if (unsplashKey) {
    searchPromises.push(searchImagesUnsplash(query, perSource, unsplashKey));
  }

  if (pixabayKey) {
    searchPromises.push(searchImagesPixabay(query, perSource, pixabayKey));
  }

  if (pexelsKey) {
    searchPromises.push(searchImagesPexels(query, perSource, pexelsKey));
  }

  const allResults = await Promise.allSettled(searchPromises);

  for (const result of allResults) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }

  const uniqueResults = Array.from(new Map(results.map(item => [item.image, item])).values()).slice(0, maxResults);

  return uniqueResults;
}

export const imageSearchExecutor = definitionToolExecutor(imageSearchParamsSchema, async (args, context) => {
  try {
    const { query, maxResults = 10, imageType = 'all', size = 'all' } = args;
    const max = maxResults;

    const hasAnyApiKey = process.env.UNSPLASH_ACCESS_KEY || process.env.PIXABAY_API_KEY || process.env.PEXELS_API_KEY;

    if (!hasAnyApiKey) {
      return {
        success: false,
        error:
          'No image search API keys configured. Please configure at least one of: UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY, or PEXELS_API_KEY environment variables.',
      };
    }

    const results = await searchImagesFromMultipleSources(query, max);

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No image results found. Please check your API keys configuration or try a different query.',
      };
    }

    // 异步保存图片到 session assets（不阻塞工具返回结果）
    // 使用 Promise 来异步执行，不阻塞主流程返回结果
    Promise.resolve().then(async () => {
      try {
        // 批量下载图片并创建 assets
        const assetPromises = results.map(async (imageResult, index) => {
          try {
            const imageUrl = imageResult.image || imageResult.thumbnail;
            if (!imageUrl) {
              return null;
            }

            // 下载图片
            const { buffer, mimeType } = await downloadFile(imageUrl);

            // 从 URL 中提取文件名，如果没有则生成一个
            let fileName = `image-${index + 1}`;
            try {
              const urlObj = new URL(imageUrl);
              const pathname = urlObj.pathname;
              const urlFileName = pathname.split('/').pop();
              if (urlFileName) {
                fileName = urlFileName;
              }
            } catch {
              // 如果不是有效的 URL，使用默认文件名
            }

            // 如果文件名没有扩展名，尝试从 mimeType 推断
            if (!fileName.includes('.')) {
              const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
              fileName = `${fileName}.${ext}`;
            }

            // 创建 asset，在 metadata 中记录原始 URL 等信息
            const asset = await createAssetFromTool({
              context,
              fileContent: buffer,
              fileName,
              mimeType,
              type: 'image',
              title: imageResult.title || `Image ${index + 1}`,
              description: imageResult.source ? `From ${imageResult.source}` : undefined,
              metadata: {
                originalUrl: imageUrl,
                sourceUrl: imageResult.url,
                source: imageResult.source,
                width: imageResult.width,
                height: imageResult.height,
                author: imageResult.author,
                authorUrl: imageResult.authorUrl,
              },
            });

            return asset;
          } catch (error) {
            // 单个图片下载失败不影响其他图片的保存
            console.error(`[ImageSearch] Failed to save image asset ${index + 1}:`, error);
            return null;
          }
        });

        await Promise.allSettled(assetPromises);
      } catch (error) {
        // 保存 assets 失败不影响工具返回结果
        console.error('[ImageSearch] Asset saving workflow error:', error);
      }
    });

    return {
      success: true,
      data: {
        query,
        results,
        count: results.length,
        type: 'images',
        filters: {
          imageType,
          size,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
});
