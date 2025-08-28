import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { sandboxManager } from '@repo/agent';
import archiver from 'archiver';
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
export const GET = withUserAuthApi<{ path?: string[] }, {}, {}>(async (request: NextRequest, ctx) => {
  try {
    const { path: pathSegments = [] } = ctx.params;
    const sandbox = await sandboxManager.getOrCreateOneById(ctx.orgId);
    if (!sandbox) {
      return new NextResponse('Sandbox not found', { status: 404 });
    }
    const resolvedPath = await sandbox.fs.resolvePath(pathSegments.join('/'));
    const fileInfo = await sandbox.fs.getFileDetails(resolvedPath);

    // If it's a single file, simply return it for download
    if (!fileInfo.isDir) {
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

    // For directories, create a zip archive
    const directoryName = resolvedPath.split('/').pop() || 'workspace';
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

    // Function to recursively add files to the zip using sandbox FS
    const addFilesToArchive = async (currentPath: string, relativePath = '') => {
      const items = await sandbox.fs.listFiles(currentPath);

      for (const item of items) {
        const itemPath = `${currentPath}/${item.name}`;
        const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;

        if (item.isDir) {
          // Recursively add directory contents
          await addFilesToArchive(itemPath, itemRelativePath);
        } else {
          // Download file content and add to archive
          const fileBuffer = await sandbox.fs.downloadFile(itemPath);
          archive.append(fileBuffer, { name: itemRelativePath });
        }
      }
    };

    // Add files to the archive
    await addFilesToArchive(resolvedPath);

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
});
