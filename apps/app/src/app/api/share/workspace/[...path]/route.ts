import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/server/prisma';

/**
 * This route is used to serve assets for a task.
 * such like /workspace/[task_id]/[screenshot.png]
 * @param request
 * @param params
 * @returns
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await params;
    const taskId = pathSegments[0];

    const task = await prisma.tasks.findUnique({
      where: { id: taskId, shareExpiresAt: { gt: new Date() } },
    });

    if (!task) {
      return new NextResponse('Task not found', { status: 404 });
    }

    const filePath = `${process.env.WORKSPACE_ROOT_PATH}/${task.organizationId}/${pathSegments.join('/')}`;
    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      const files = await fs.promises.readdir(filePath);
      const fileDetails = await Promise.all(
        files.map(async file => {
          const fullPath = `${filePath}/${file}`;
          const fileStat = await fs.promises.stat(fullPath);
          return {
            name: file,
            isDirectory: fileStat.isDirectory(),
            size: fileStat.size,
            modifiedTime: fileStat.mtime.toISOString(),
          };
        }),
      );

      return NextResponse.json(fileDetails);
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const contentType = getContentType(filePath);
    const fileName = path.basename(filePath);
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'public, max-age=31536000',
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
