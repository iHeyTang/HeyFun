import sandboxManager from '@/lib/server/sandbox';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

/**
 * This route is used to serve assets for a task.
 * @param request
 * @param params
 * @returns
 */
export async function GET(request: NextRequest, { params, orgId }: { params: Promise<{ path?: string[] }>; orgId: string }) {
  try {
    const { path: pathSegments = [] } = await params;
    const sandboxes = await sandboxManager.list();
    let sandbox = sandboxes.find(s => s.id === orgId);

    if (!sandbox) {
      sandbox = await sandboxManager.create({ user: orgId });
      await sandboxManager.start(sandbox.id);
    }

    if (!sandbox) {
      return new NextResponse('Sandbox not found', { status: 404 });
    }

    const fileInfo = await sandbox.fs.getFileDetails(pathSegments.join('/'));

    if (fileInfo.isDir) {
      const files = await sandbox.fs.listFiles(pathSegments.join('/'));
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

    // calculate ETag
    const fileBuffer = await sandbox.fs.downloadFile(pathSegments.join('/'));
    const etag = crypto.createHash('md5').update(fileBuffer).digest('hex');

    // check If-None-Match header
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // check If-Modified-Since header
    const ifModifiedSince = request.headers.get('if-modified-since');
    if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(fileInfo.modTime)) {
      return new NextResponse(null, { status: 304 });
    }

    const contentType = getContentType(pathSegments.join('/'));
    const fileName = path.basename(pathSegments.join('/'));
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFileName}`,
        ETag: etag,
        'Last-Modified': fileInfo.modTime,
        'Cache-Control': 'private, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error serving protected asset:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

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
