/**
 * Snippets 数据库存储
 *
 * 使用统一的数据库管理器 API
 * 本地 snippets：用户已同步到本地的片段，agent 使用时只从本地获取
 * 云端 snippets：从官方接口拉取的片段市场，需要同步到本地才能使用
 */

import { getDb } from '../../../core/db';
import { PromptFragmentConfig } from './types';

export interface SnippetRecord {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  content: string;
  version?: string;
  author?: string;
  category?: PromptFragmentConfig['category'];
  priority?: number;
  section?: string;
  source: 'local' | 'cloud'; // 来源：本地或云端
  cloud_id?: string; // 云端 ID（如果是云端同步的，记录云端原始 ID）
  created_at: number;
  updated_at: number;
  synced_at?: number; // 同步时间（从云端同步到本地的时间）
}

export class SnippetStore {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    // 表结构由 Drizzle 迁移管理，无需手动初始化
  }

  private get db() {
    return getDb(this.workspacePath);
  }

  /**
   * 保存 snippet（本地或云端）
   */
  save(snippet: SnippetRecord): void {
    this.db.snippets.save({
      id: snippet.id,
      name: snippet.name,
      description: snippet.description,
      enabled: snippet.enabled,
      content: snippet.content,
      version: snippet.version || null,
      author: snippet.author || null,
      category: snippet.category || null,
      priority: snippet.priority ?? 0,
      section: snippet.section || null,
      source: snippet.source,
      cloudId: snippet.cloud_id || null,
      createdAt: snippet.created_at,
      updatedAt: snippet.updated_at,
      syncedAt: snippet.synced_at || null,
    });
  }

  /**
   * 从 PromptFragmentConfig 创建并保存本地 snippet
   */
  saveFromConfig(config: PromptFragmentConfig, source: 'local' | 'cloud' = 'local', cloudId?: string): void {
    const now = Date.now();
    const record: SnippetRecord = {
      id: config.id,
      name: config.name,
      description: config.description,
      enabled: config.enabled,
      content: config.content,
      version: config.version,
      author: config.author,
      category: config.category,
      priority: config.priority,
      section: config.section,
      source,
      cloud_id: cloudId,
      created_at: now,
      updated_at: now,
      synced_at: source === 'local' && cloudId ? now : undefined,
    };
    this.save(record);
  }

  /**
   * 获取 snippet
   */
  get(id: string): SnippetRecord | undefined {
    const row = this.db.snippets.get(id);
    if (!row) return undefined;
    return this.rowToRecord(row);
  }

  /**
   * 获取所有本地 snippets（agent 使用）
   */
  getAllLocal(): SnippetRecord[] {
    return this.db.snippets.getBySource('local').map((row) => this.rowToRecord(row));
  }

  /**
   * 获取所有云端 snippets（片段市场）
   */
  getAllCloud(): SnippetRecord[] {
    return this.db.snippets.getBySource('cloud').map((row) => this.rowToRecord(row));
  }

  /**
   * 获取所有启用的本地 snippets（转换为 PromptFragmentConfig）
   */
  getEnabledLocalFragments(): PromptFragmentConfig[] {
    const enabled = this.db.snippets.getEnabled();
    return enabled
      .filter((s) => s.source === 'local')
      .map((row) => this.recordToConfig(this.rowToRecord(row)));
  }

  /**
   * 根据 cloud_id 查找本地 snippet（用于检查是否已同步）
   */
  findByCloudId(cloudId: string): SnippetRecord | undefined {
    const row = this.db.snippets.getByCloudId(cloudId);
    if (!row) return undefined;
    return this.rowToRecord(row);
  }

  /**
   * 同步云端 snippet 到本地
   * @param cloudSnippet 云端 snippet
   * @returns 同步后的本地 snippet ID
   */
  syncFromCloud(cloudSnippet: SnippetRecord): string {
    const now = Date.now();

    // 检查是否已存在（通过 cloud_id）
    const existing = cloudSnippet.cloud_id ? this.findByCloudId(cloudSnippet.cloud_id) : null;

    const localId = existing?.id || cloudSnippet.id;

    const localRecord: SnippetRecord = {
      ...cloudSnippet,
      id: localId,
      source: 'local',
      cloud_id: cloudSnippet.cloud_id || cloudSnippet.id,
      created_at: existing?.created_at || now,
      updated_at: now,
      synced_at: now,
    };

    this.save(localRecord);
    return localId;
  }

  /**
   * 批量同步云端 snippets 到本地
   */
  syncManyFromCloud(cloudSnippets: SnippetRecord[]): { success: number; failed: number } {
    let success = 0;
    let failed = 0;

    // 使用 Drizzle 事务
    this.db.drizzleDb.transaction(() => {
      for (const snippet of cloudSnippets) {
        try {
          const now = Date.now();
          const existing = snippet.cloud_id ? this.findByCloudId(snippet.cloud_id) : null;
          const localId = existing?.id || snippet.id;

          const localRecord: SnippetRecord = {
            ...snippet,
            id: localId,
            source: 'local',
            cloud_id: snippet.cloud_id || snippet.id,
            created_at: existing?.created_at || now,
            updated_at: now,
            synced_at: now,
          };

          // 在事务中使用统一的 API
          this.db.snippets.save({
            id: localRecord.id,
            name: localRecord.name,
            description: localRecord.description,
            enabled: localRecord.enabled,
            content: localRecord.content,
            version: localRecord.version || null,
            author: localRecord.author || null,
            category: localRecord.category || null,
            priority: localRecord.priority ?? 0,
            section: localRecord.section || null,
            source: localRecord.source,
            cloudId: localRecord.cloud_id || null,
            createdAt: localRecord.created_at,
            updatedAt: localRecord.updated_at,
            syncedAt: localRecord.synced_at || null,
          });

          success++;
        } catch (error) {
          console.error(`同步 snippet ${snippet.id} 失败:`, error);
          failed++;
        }
      }
    });

    return { success, failed };
  }

  /**
   * 更新 snippet
   */
  update(
    id: string,
    updates: Partial<Pick<SnippetRecord, 'name' | 'description' | 'enabled' | 'content' | 'version' | 'author' | 'category' | 'priority' | 'section'>>
  ): boolean {
    return this.db.snippets.update(id, updates);
  }

  /**
   * 删除 snippet
   */
  delete(id: string): boolean {
    return this.db.snippets.delete(id);
  }

  /**
   * 清空所有云端 snippets（用于重新拉取）
   */
  clearCloudSnippets(): void {
    this.db.snippets.deleteBySource('cloud');
  }

  /**
   * 将数据库行转换为 SnippetRecord
   */
  private rowToRecord(row: import('../../../core/db/schemas').Snippet): SnippetRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      content: row.content,
      version: row.version || undefined,
      author: row.author || undefined,
      category: (row.category as PromptFragmentConfig['category']) || undefined,
      priority: row.priority ?? 0,
      section: row.section || undefined,
      source: row.source as 'local' | 'cloud',
      cloud_id: row.cloudId || undefined,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      synced_at: row.syncedAt || undefined,
    };
  }

  /**
   * 将 SnippetRecord 转换为 PromptFragmentConfig
   */
  private recordToConfig(record: SnippetRecord): PromptFragmentConfig {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      enabled: record.enabled,
      content: record.content,
      version: record.version,
      author: record.author,
      category: record.category,
      priority: record.priority,
      section: record.section,
    };
  }

  /**
   * 关闭数据库连接
   * 注意：数据库连接由 getDb 统一管理，通常不需要手动关闭
   */
  close(): void {
    // 数据库连接由 getDb 统一管理，这里不做任何操作
  }
}
