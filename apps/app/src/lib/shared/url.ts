/**
 * 获取应用的 base URL
 * 优先级：NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost:3000
 */
export const getAppBaseUrl = (): string => {
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    // 如果没有设置NEXT_PUBLIC_APP_URL，尝试使用VERCEL_URL
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      // 开发环境默认使用localhost
      baseUrl = 'http://localhost:3000';
    }
  }
  return baseUrl;
};

/**
 * 将相对路径或绝对路径转换为完整的绝对 URL
 * 如果已经是绝对 URL（以 http:// 或 https:// 开头），直接返回
 * 如果是相对路径（以 / 开头），添加 base URL
 * 其他情况也尝试添加 base URL
 */
export const resolveUrl = (url: string): string => {
  // 如果已经是绝对 URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 如果是相对路径，添加 base URL
  if (url.startsWith('/')) {
    return `${getAppBaseUrl()}${url}`;
  }

  // 其他情况也尝试添加 base URL（兼容性处理）
  return `${getAppBaseUrl()}/${url}`;
};
