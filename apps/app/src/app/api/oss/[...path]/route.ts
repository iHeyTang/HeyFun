import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import storage from '@/lib/server/storage';
import { identifyFileTypeFromBuffer } from '@/lib/shared/file-type';
import { NextResponse } from 'next/server';

/**
 * OSS 资源代理接口
 *
 * 用于安全地访问存储在 OSS 中的资源，提供权限控制
 * - 验证用户身份和组织
 * - 确保用户只能访问自己组织的资源或系统资源
 * - 返回实际的文件内容
 *
 * @example
 * GET /api/oss?fileKey=org_xxx/path/to/file.png
 */
export const GET = withUserAuthApi<{ path: string[] }, {}, {}, ArrayBuffer>(async (_request, { orgId, params }) => {
  const { path } = params;
  const fileKey = path.join('/');

  // 验证必需参数
  if (!fileKey) {
    return new NextResponse('Missing fileKey parameter', { status: 400 });
  }

  // 权限验证：确保用户只能访问自己组织的资源或系统资源
  const isSystemFile = fileKey.startsWith('system/');
  const isOrgFile = fileKey.startsWith(`${orgId}/`);

  if (!isSystemFile && !isOrgFile) {
    return new NextResponse('Access denied: You can only access files within your organization', { status: 403 });
  }

  try {
    // 从 storage 获取文件内容
    const fileData = await storage.getBytes(fileKey);

    if (!fileData) {
      return new NextResponse('File not found', { status: 404 });
    }

    // 将 Uint8Array 转换为 Buffer
    const fileBuffer = Buffer.from(fileData);

    // 识别文件类型
    const mimeType = identifyFileTypeFromBuffer(fileBuffer);

    // 返回文件内容，设置正确的 Content-Type
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    console.error('Failed to fetch file from storage:', error);
    return new NextResponse('Failed to fetch file from storage', { status: 500 });
  }
});
