/**
 * Upstash Vector 提供者实现
 */

import { Index } from '@upstash/vector';
import type { VectorProvider, VectorQueryResult } from '../types';

export interface UpstashVectorConfig {
  url: string;
  token: string;
}

/**
 * Upstash Vector 提供者
 */
export class UpstashVectorProvider implements VectorProvider {
  readonly type = 'upstash';
  readonly name: string;
  private index: Index;

  constructor(name: string, config: UpstashVectorConfig) {
    this.name = name;
    this.index = new Index({
      url: config.url,
      token: config.token,
    });
  }

  isAvailable(): boolean {
    return !!this.index;
  }

  async query(vector: number[], topK: number, filter?: Record<string, any>): Promise<VectorQueryResult[]> {
    const result = await this.index.query({
      vector,
      topK,
      includeMetadata: true,
      filter: filter ? this.buildFilter(filter) : undefined,
    });

    return result.map((item: any) => ({
      id: String(item.id),
      score: item.score,
      metadata: item.metadata || {},
    }));
  }

  async upsert(id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    await this.index.upsert([
      {
        id,
        vector,
        metadata: metadata || {},
      },
    ]);
  }

  async upsertBatch(
    items: Array<{ id: string; vector: number[]; metadata?: Record<string, any> }>,
  ): Promise<void> {
    await this.index.upsert(
      items.map(item => ({
        id: item.id,
        vector: item.vector,
        metadata: item.metadata || {},
      })),
    );
  }

  async delete(id: string): Promise<void> {
    await this.index.delete([id]);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    await this.index.delete(ids);
  }

  /**
   * 构建 Upstash 过滤条件
   * Upstash 使用类似 SQL 的过滤语法
   */
  private buildFilter(filter: Record<string, any>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (Array.isArray(value)) {
        conditions.push(`${key} IN (${value.map(v => `'${v}'`).join(', ')})`);
      } else if (typeof value === 'string') {
        conditions.push(`${key} = '${value}'`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        conditions.push(`${key} = ${value}`);
      }
    }

    return conditions.join(' AND ');
  }
}

