import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { sandboxManager } from '@repo/agent';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

/**
 * This route is used to serve assets for a task.
 *
 * ATTENTION:
 * 文件路径的处理不得使用任何 node 环境的接口，而是全部通过 sandbox 的接口来处理。 sandbox 的接口会提供相应的
 * 路径转换功能，确保在不同的沙盒环境（如本地、云端）中都能正确处理路径。
 * @param request
 * @param params
 * @returns
 */
export const GET = withUserAuthApi<{}, { path: string }, {}>(async (request: NextRequest, ctx) => {
  try {
    const sandbox = await sandboxManager.getOrCreateOneById(ctx.orgId);
    const p = await sandbox.fs.resolvePath(ctx.query.path || '');
    const fileInfo = await sandbox.fs.getFileDetails(p);

    if (fileInfo.isDir) {
      const files = await sandbox.fs.listFiles(p);
      const fileDetails = await Promise.all(
        files
          .sort((a, b) => {
            // First sort by type: directories first, then files
            if (a.isDir !== b.isDir) {
              return a.isDir ? -1 : 1;
            }
            // Within same type, sort by name
            return a.name.localeCompare(b.name);
          })
          .map(async file => {
            return {
              name: file.name,
              isDirectory: file.isDir,
              size: file.size,
              modifiedTime: file.modTime,
            };
          }),
      );

      return NextResponse.json(fileDetails);
    }

    const fileBuffer = await sandbox.fs.downloadFile(p);

    const contentType = getContentType(fileInfo.name);
    const encodedFileName = encodeURIComponent(fileInfo.name);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=5',
      },
    });
  } catch (error) {
    console.error('Error serving protected asset:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
});

export const DELETE = withUserAuthApi<{}, { path: string }, {}>(async (request: NextRequest, ctx) => {
  try {
    const sandbox = await sandboxManager.getOrCreateOneById(ctx.orgId);
    await sandbox.fs.deleteFile(await sandbox.fs.resolvePath(ctx.query.path));
    return new NextResponse('File deleted', { status: 200 });
  } catch (error) {
    console.error('Error deleting file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
});

/**
 * Create a file or directory
 * @param request
 * @param ctx
 * @returns
 */
export const POST = withUserAuthApi<{}, {}, { directory: boolean; path: string; name: string }>(async (request: NextRequest, ctx) => {
  try {
    const sandbox = await sandboxManager.getOrCreateOneById(ctx.orgId);
    const currentPath = await sandbox.fs.resolvePath(ctx.body.path);
    if (ctx.body.directory) {
      await sandbox.fs.createFolder(currentPath);
    } else {
      await sandbox.fs.uploadFileFromBuffer(Buffer.from(''), currentPath);
    }
    return new NextResponse('Directory created', { status: 200 });
  } catch (error) {
    console.error('Error creating directory:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
});

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.md': 'text/markdown',
  };
  return contentTypes[ext] || 'application/octet-stream';
}
