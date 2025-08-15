import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/server/auth';
import fs from 'fs';
import { prisma } from '@/lib/server/prisma';
import archiver from 'archiver';
import sandboxManager from '@/lib/server/sandbox';

/**
 * This route is used to download workspace files or directories as zip archives
 * @param request
 * @param params
 * @returns
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path = [] } = await params;
    const user = await verifyToken();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const organizationUser = await prisma.organizationUsers.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!organizationUser) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const sandbox = await sandboxManager.findOneById(`daytona-${organizationUser.organizationId}`);
    if (!sandbox) {
      return new NextResponse('Sandbox not found', { status: 404 });
    }
    const filePath = path.join('/');
    const fileInfo = await sandbox.fs.getFileDetails(filePath);

    // If it's a single file, simply return it for download
    if (!fileInfo.isDir) {
      const fileBuffer = await sandbox.fs.downloadFile(filePath);
      const fileName = filePath.split('/').pop() || 'download';

      // Encode the filename for Content-Disposition header
      const encodedFileName = encodeURIComponent(fileName);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        },
      });
    }

    // For directories, create a zip archive
    const directoryName = filePath.split('/').pop() || 'workspace';
    const zipFileName = `${directoryName}.zip`;

    // Encode the zip filename for Content-Disposition header
    const encodedZipFileName = encodeURIComponent(zipFileName);

    // Create zip archive in memory
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Compression level
    });

    // Collect the chunks of the zip file
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: any) => {
      chunks.push(Buffer.from(chunk));
    });

    // Handle archive warnings
    archive.on('warning', (err: any) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        console.error('Archive error:', err);
      }
    });

    // Handle archive errors
    archive.on('error', (err: any) => {
      console.error('Archive error:', err);
    });

    // Function to recursively add files to the zip
    const addFilesToArchive = (currentPath: string, relativePath = '') => {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const itemPath = `${currentPath}/${item}`;
        const itemRelativePath = relativePath ? `${relativePath}/${item}` : item;
        const itemStat = fs.statSync(itemPath);

        if (itemStat.isDirectory()) {
          // Recursively add directory contents
          addFilesToArchive(itemPath, itemRelativePath);
        } else {
          // Add file to archive
          archive.file(itemPath, { name: itemRelativePath });
        }
      }
    };

    // Add files to the archive
    addFilesToArchive(filePath);

    // Finalize the archive
    await archive.finalize();

    // Combine all chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

    // Return the zip file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedZipFileName}`,
      },
    });
  } catch (error) {
    console.error('Error creating download:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
