import { prisma } from './prisma';
import storage from './storage';
import { nanoid } from 'nanoid';
import { getFileExtension } from '../shared/file-type';

export type AssetType = 'image' | 'video' | 'document' | 'presentation' | 'audio' | 'code' | 'other';

export interface CreateAssetParams {
  /** 组织ID（必须） */
  organizationId: string;
  /** 会话ID（必须） */
  sessionId: string;
  /** 文件内容（Buffer） */
  fileContent: Buffer;
  /** 原始文件名 */
  fileName: string;
  /** MIME类型 */
  mimeType: string;
  /** 素材类型 */
  type: AssetType;
  /** 素材标题（可选） */
  title?: string;
  /** 素材描述（可选） */
  description?: string;
  /** 标签数组（可选） */
  tags?: string[];
  /** 元数据（可选，JSON格式，可用于存储外部资源的原始URL等信息） */
  metadata?: Record<string, any>;
  /** 工具调用ID（可选，用于追踪素材来源） */
  toolCallId?: string;
  /** 消息ID（可选，用于追踪素材来源） */
  messageId?: string;
}

export interface AssetResult {
  id: string;
  fileKey: string;
  fileUrl: string;
  type: AssetType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sessionId: string;
  sessionType: 'chat' | 'flowcanvas';
}

/**
 * 素材管理器
 * 确保 agent 只能将素材存储到正确的位置，防止存错位置或 session
 */
export class AssetManager {
  /**
   * 创建素材并上传到 OSS
   *
   * 安全保证：
   * 1. 自动验证 session 存在且属于正确的 organization
   * 2. 自动确定 session 类型（chat 或 flowcanvas）
   * 3. 自动生成正确的存储路径
   * 4. 在数据库中创建记录，确保关联关系正确
   *
   * @param params 创建素材的参数
   * @returns 创建的素材信息
   */
  static async createAsset(params: CreateAssetParams): Promise<AssetResult> {
    const {
      organizationId,
      sessionId,
      fileContent,
      fileName,
      mimeType,
      type,
      title,
      description,
      tags = [],
      metadata = {},
      toolCallId,
      messageId,
    } = params;

    // 1. 验证 session 存在且属于正确的 organization
    // 同时确定 session 类型
    const sessionInfo = await this.verifySession(organizationId, sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found or does not belong to organization ${organizationId}`);
    }

    const { sessionType } = sessionInfo;

    // 2. 生成唯一的 asset ID 和文件路径
    const assetId = nanoid(12);
    let fileExtension = getFileExtension(fileName) || this.getExtensionFromMimeType(mimeType);
    // getFileExtension 返回的是带点号的，如 .jpg，需要去掉点号或直接使用
    if (fileExtension && !fileExtension.startsWith('.')) {
      fileExtension = `.${fileExtension}`;
    }
    const safeFileName = this.sanitizeFileName(fileName);
    const fileKey = `${organizationId}/assets/${sessionId}/${assetId}${fileExtension || ''}`;

    // 3. 上传文件到 OSS
    await storage.put(fileKey, fileContent, {
      contentType: mimeType,
    });

    // 4. 在数据库中创建 Asset 记录
    const asset = await prisma.assets.create({
      data: {
        organizationId,
        sessionId,
        sessionType,
        type,
        fileKey,
        fileName: safeFileName,
        fileSize: fileContent.length,
        mimeType,
        title: title || safeFileName,
        description,
        tags,
        metadata,
        toolCallId,
        messageId,
      },
    });

    // 5. 构建访问 URL
    const fileUrl = `/api/oss/${fileKey}`;

    return {
      id: asset.id,
      fileKey: asset.fileKey,
      fileUrl,
      type: asset.type as AssetType,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      sessionId: asset.sessionId,
      sessionType: asset.sessionType as 'chat' | 'flowcanvas',
    };
  }

  /**
   * 批量创建素材
   *
   * @param paramsList 创建素材的参数列表
   * @returns 创建的素材信息列表
   */
  static async createAssets(paramsList: CreateAssetParams[]): Promise<AssetResult[]> {
    // 验证所有 session 都属于同一个 organization（可选，根据需求）
    if (paramsList.length > 0) {
      const orgIds = new Set(paramsList.map(p => p.organizationId));
      if (orgIds.size > 1) {
        throw new Error('All assets must belong to the same organization');
      }
    }

    // 并行创建（注意：如果需要事务，可以改为顺序执行）
    const results = await Promise.all(paramsList.map(params => this.createAsset(params)));

    return results;
  }

  /**
   * 验证 session 存在且属于正确的 organization
   * 同时确定 session 类型
   *
   * @param organizationId 组织ID
   * @param sessionId 会话ID
   * @returns session 信息，如果不存在则返回 null
   */
  private static async verifySession(organizationId: string, sessionId: string): Promise<{ sessionType: 'chat' | 'flowcanvas' } | null> {
    // 同时查询两种 session 类型
    const [chatSession, flowcanvasSession] = await Promise.all([
      prisma.chatSessions.findUnique({
        where: { id: sessionId },
        select: { organizationId: true },
      }),
      prisma.flowCanvasProjectAgentSessions.findUnique({
        where: { id: sessionId },
        select: { organizationId: true },
      }),
    ]);

    // 检查是否是 chat session
    if (chatSession) {
      if (chatSession.organizationId !== organizationId) {
        return null;
      }
      return { sessionType: 'chat' };
    }

    // 检查是否是 flowcanvas session
    if (flowcanvasSession) {
      if (flowcanvasSession.organizationId !== organizationId) {
        return null;
      }
      return { sessionType: 'flowcanvas' };
    }

    // session 不存在
    return null;
  }

  /**
   * 从 MIME 类型获取文件扩展名
   */
  private static getExtensionFromMimeType(mimeType: string): string | null {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'text/html': 'html',
      'text/css': 'css',
      'application/javascript': 'js',
      'text/plain': 'txt',
      'application/json': 'json',
    };

    return mimeToExt[mimeType.toLowerCase()] || null;
  }

  /**
   * 清理文件名，移除不安全字符
   */
  private static sanitizeFileName(fileName: string): string {
    // 移除路径分隔符和其他不安全字符
    return fileName
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255); // 限制长度
  }

  /**
   * 为已存在的文件创建 Assets 记录（不重新上传文件）
   *
   * 适用于文件已经存储在 OSS 中的情况（如 AIGC 工具生成的结果）
   *
   * @param params 创建素材的参数（不需要 fileContent）
   * @returns 创建的素材信息
   */
  static async createAssetFromExistingFile(
    params: Omit<CreateAssetParams, 'fileContent'> & { fileKey: string; fileSize?: number },
  ): Promise<AssetResult> {
    const {
      organizationId,
      sessionId,
      fileKey,
      fileName,
      mimeType,
      type,
      title,
      description,
      tags = [],
      metadata = {},
      toolCallId,
      messageId,
      fileSize,
    } = params;

    // 1. 验证 session 存在且属于正确的 organization
    const sessionInfo = await this.verifySession(organizationId, sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found or does not belong to organization ${organizationId}`);
    }

    const { sessionType } = sessionInfo;

    // 2. 验证文件是否存在（可选，如果 fileSize 已提供则跳过）
    let actualFileSize = fileSize;
    if (!actualFileSize) {
      try {
        const storage = (await import('./storage')).default;
        const fileData = await storage.getBytes(fileKey);
        if (!fileData) {
          throw new Error(`File not found at ${fileKey}`);
        }
        actualFileSize = fileData.length;
      } catch (error) {
        console.error(`Failed to verify file existence: ${fileKey}`, error);
        // 如果无法获取文件大小，使用 0 或抛出错误
        throw new Error(`File not found or inaccessible at ${fileKey}`);
      }
    }

    // 3. 在数据库中创建 Asset 记录
    const asset = await prisma.assets.create({
      data: {
        organizationId,
        sessionId,
        sessionType,
        type,
        fileKey,
        fileName: this.sanitizeFileName(fileName),
        fileSize: actualFileSize,
        mimeType,
        title: title || this.sanitizeFileName(fileName),
        description,
        tags,
        metadata,
        toolCallId,
        messageId,
      },
    });

    // 4. 构建访问 URL
    const fileUrl = `/api/oss/${fileKey}`;

    return {
      id: asset.id,
      fileKey: asset.fileKey,
      fileUrl,
      type: asset.type as AssetType,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      sessionId: asset.sessionId,
      sessionType: asset.sessionType as 'chat' | 'flowcanvas',
    };
  }

  /**
   * 根据文件扩展名推断素材类型
   */
  static inferAssetType(fileName: string, mimeType: string): AssetType {
    const ext = getFileExtension(fileName);
    // getFileExtension 返回带点号的扩展名，去掉点号
    const extension = ext ? ext.replace(/^\./, '').toLowerCase() : null;

    // 图片类型
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension || '')) {
      return 'image';
    }

    // 视频类型
    if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension || '')) {
      return 'video';
    }

    // 音频类型
    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(extension || '')) {
      return 'audio';
    }

    // 演示文稿类型
    if (mimeType.includes('presentation') || ['ppt', 'pptx', 'key'].includes(extension || '')) {
      return 'presentation';
    }

    // 代码类型
    if (
      ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'swift', 'kt'].includes(extension || '') ||
      mimeType.includes('javascript') ||
      mimeType.includes('typescript')
    ) {
      return 'code';
    }

    // 文档类型（PDF、Word、Excel等）
    if (
      mimeType.includes('document') ||
      mimeType === 'application/pdf' ||
      ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'md', 'rtf'].includes(extension || '')
    ) {
      return 'document';
    }

    // 默认返回 other
    return 'other';
  }
}
