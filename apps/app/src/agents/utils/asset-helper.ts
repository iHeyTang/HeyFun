import { ToolContext } from '@/agents/tools/context';
import { AssetManager, type AssetType, type CreateAssetParams } from '@/lib/server/asset-manager';
import { identifyFileTypeFromBuffer } from '@/lib/shared/file-type';

/**
 * 工具辅助函数：在工具中使用 AssetManager
 * 提供便捷的方法帮助工具创建和管理素材
 */

/**
 * 为已存在的文件创建 Assets 记录（不重新上传）
 *
 * 适用于文件已经存储在 OSS 中的情况（如 AIGC 工具生成的结果）
 *
 * 使用示例：
 * ```typescript
 * const asset = await createAssetFromExistingFile({
 *   context,
 *   fileKey: 'org_xxx/paintboard/xxx.png',
 *   fileName: 'generated-image.png',
 *   mimeType: 'image/png',
 *   type: 'image',
 *   title: 'Generated Image',
 * });
 * ```
 */
export async function createAssetFromExistingFile(params: {
  context: ToolContext;
  fileKey: string;
  fileName: string;
  mimeType?: string;
  title?: string;
  description?: string;
  type?: AssetType;
  tags?: string[];
  fileSize?: number;
  metadata?: Record<string, any>;
}): Promise<{
  id: string;
  fileKey: string;
  fileUrl: string;
  type: AssetType;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  const { context, fileKey, fileName, title, description, type, tags, mimeType, fileSize, metadata } = params;

  if (!context.organizationId || !context.sessionId) {
    throw new Error('Organization ID and Session ID are required in ToolContext');
  }

  // 从文件名和 fileKey 中提取信息
  const detectedMimeType = mimeType || 'application/octet-stream';

  // 如果没有提供类型，自动推断
  let detectedType = type;
  if (!detectedType) {
    detectedType = AssetManager.inferAssetType(fileName, detectedMimeType);
  }

  return await AssetManager.createAssetFromExistingFile({
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    fileKey,
    fileName,
    mimeType: detectedMimeType,
    type: detectedType,
    title,
    description,
    tags,
    metadata,
    toolCallId: context.toolCallId,
    messageId: context.messageId,
    fileSize,
  });
}

/**
 * 批量为已存在的文件创建 Assets 记录
 */
export async function createAssetsFromExistingFiles(params: {
  context: ToolContext;
  files: Array<{
    fileKey: string;
    fileName: string;
    mimeType?: string;
    title?: string;
    description?: string;
    type?: AssetType;
    tags?: string[];
    fileSize?: number;
    metadata?: Record<string, any>;
  }>;
}): Promise<
  Array<{
    id: string;
    fileKey: string;
    fileUrl: string;
    type: AssetType;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>
> {
  const { context, files } = params;

  if (!context.organizationId || !context.sessionId) {
    throw new Error('Organization ID and Session ID are required in ToolContext');
  }

  const results = await Promise.all(
    files.map(file =>
      createAssetFromExistingFile({
        context,
        fileKey: file.fileKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        title: file.title,
        description: file.description,
        type: file.type,
        tags: file.tags,
        fileSize: file.fileSize,
        metadata: file.metadata,
      }),
    ),
  );

  return results;
}

/**
 * 在工具中创建素材的便捷函数
 *
 * 使用示例：
 * ```typescript
 * const asset = await createAssetFromTool({
 *   context,
 *   fileContent: Buffer.from(content, 'utf-8'),
 *   fileName: 'example.html',
 *   title: 'Example Document',
 *   description: 'This is an example document',
 * });
 * ```
 */
export async function createAssetFromTool(params: {
  context: ToolContext;
  fileContent: Buffer;
  fileName: string;
  title?: string;
  description?: string;
  type?: AssetType;
  tags?: string[];
  mimeType?: string;
  metadata?: Record<string, any>;
}): Promise<{
  id: string;
  fileKey: string;
  fileUrl: string;
  type: AssetType;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  const { context, fileContent, fileName, title, description, type, tags, mimeType, metadata } = params;

  if (!context.organizationId || !context.sessionId) {
    throw new Error('Organization ID and Session ID are required in ToolContext');
  }

  // 如果没有提供 MIME 类型，尝试从文件内容识别
  const detectedMimeType = mimeType || identifyFileTypeFromBuffer(fileContent);

  // 如果没有提供类型，自动推断
  let detectedType = type;
  if (!detectedType) {
    detectedType = AssetManager.inferAssetType(fileName, detectedMimeType);
  }

  return await AssetManager.createAsset({
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    fileContent,
    fileName,
    mimeType: detectedMimeType,
    type: detectedType,
    title,
    description,
    tags,
    metadata,
    toolCallId: context.toolCallId,
    messageId: context.messageId,
  });
}

/**
 * 批量创建素材
 */
export async function createAssetsFromTool(params: {
  context: ToolContext;
  files: Array<{
    fileContent: Buffer;
    fileName: string;
    title?: string;
    description?: string;
    type?: AssetType;
    tags?: string[];
    mimeType?: string;
    metadata?: Record<string, any>;
  }>;
}): Promise<
  Array<{
    id: string;
    fileKey: string;
    fileUrl: string;
    type: AssetType;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>
> {
  const { context, files } = params;

  if (!context.organizationId || !context.sessionId) {
    throw new Error('Organization ID and Session ID are required in ToolContext');
  }

  const createParams: CreateAssetParams[] = files.map(file => {
    // 如果没有提供 MIME 类型，尝试从文件内容识别
    const detectedMimeType = file.mimeType || identifyFileTypeFromBuffer(file.fileContent);

    // 如果没有提供类型，自动推断
    let detectedType = file.type;
    if (!detectedType) {
      detectedType = AssetManager.inferAssetType(file.fileName, detectedMimeType);
    }

    return {
      organizationId: context.organizationId!,
      sessionId: context.sessionId!,
      fileContent: file.fileContent,
      fileName: file.fileName,
      mimeType: detectedMimeType,
      type: detectedType,
      title: file.title,
      description: file.description,
      tags: file.tags,
      metadata: file.metadata,
      toolCallId: context.toolCallId,
      messageId: context.messageId,
    };
  });

  return await AssetManager.createAssets(createParams);
}
