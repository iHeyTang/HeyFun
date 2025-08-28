import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { sandboxManager } from '@repo/agent';
import { NextRequest, NextResponse } from 'next/server';

/**
 * This route is used to download workspace files or directories as zip archives
 *
 * ATTENTION:
 * 文件路径的处理不得使用任何 node 环境的接口，而是全部通过 sandbox 的接口来处理。 sandbox 的接口会提供相应的
 * 路径转换功能，确保在不同的沙盒环境（如本地、云端）中都能正确处理路径。
 * @param request
 * @param params
 * @returns
 */
export const GET = withUserAuthApi<{}, { path: string }, {}>(async (_request: NextRequest, ctx) => {
  try {
    const sandbox = await sandboxManager.getOrCreateOneById(ctx.orgId);
    if (!sandbox) {
      return new NextResponse('Sandbox not found', { status: 404 });
    }
    const resolvedPath = await sandbox.fs.resolvePath(ctx.query.path || '');
    const fileInfo = await sandbox.fs.getFileDetails(resolvedPath);

    // If it's a single file, simply return it for download
    if (!fileInfo?.isDir) {
      const fileBuffer = await sandbox.fs.downloadFile(resolvedPath);
      const fileName = resolvedPath.split('/').pop() || 'download';

      // Encode the filename for Content-Disposition header
      const encodedFileName = encodeURIComponent(fileName);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        },
      });
    }
    return new NextResponse('Not implemented', { status: 501 });
  } catch (error) {
    console.error('Error creating download:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
});
