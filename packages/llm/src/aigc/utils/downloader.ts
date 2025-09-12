export const downloadFile = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  // 检查响应的Content-Type，确保不是错误响应
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('text/html') || contentType.includes('text/plain')) {
    const text = await response.text();
    throw new Error(`Download failed, received ${contentType} response: ${text.substring(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
};
