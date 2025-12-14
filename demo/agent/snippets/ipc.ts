/**
 * Snippets IPC 模块
 *
 * 提供 snippets 管理的 IPC 接口
 * 包括本地 snippets 管理和云端 snippets 同步
 */

import { ipcMain } from 'electron';
import { IPCModule } from '~/core/ipc/IPCModule';
import { cloudSnippetService } from '~/modules/agent/snippets/cloud-snippet-service';
import { SnippetRecord } from '~/modules/agent/snippets/snippet-store';
import { PromptFragmentConfig } from '~/modules/agent/snippets/types';
import { getSnippetStore, loadFragmentsFromDatabase, setFragmentEnabled } from '.';

class SnippetsIPCModule extends IPCModule {
  readonly name = 'Snippets';

  async setup(): Promise<void> {
    /**
     * 获取所有本地 snippets
     */
    ipcMain.handle('snippets:getAllLocal', async () => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }
        const snippets = store.getAllLocal();
        return snippets.map((record) => this.recordToConfig(record));
      } catch (error: any) {
        console.error('[Snippets IPC] 获取本地 snippets 失败:', error);
        throw error;
      }
    });

    /**
     * 获取所有启用的本地 snippets
     */
    ipcMain.handle('snippets:getEnabledLocal', async () => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }
        return store.getEnabledLocalFragments();
      } catch (error: any) {
        console.error('[Snippets IPC] 获取启用的本地 snippets 失败:', error);
        throw error;
      }
    });

    /**
     * 获取单个 snippet
     */
    ipcMain.handle('snippets:get', async (_, snippetId: string) => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }
        const record = store.get(snippetId);
        if (!record || record.source !== 'local') {
          return null;
        }
        return this.recordToConfig(record);
      } catch (error: any) {
        console.error('[Snippets IPC] 获取 snippet 失败:', error);
        throw error;
      }
    });

    /**
     * 更新 snippet
     */
    ipcMain.handle('snippets:update', async (_, snippetId: string, updates: Partial<PromptFragmentConfig>) => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }

        const success = store.update(snippetId, {
          name: updates.name,
          description: updates.description,
          enabled: updates.enabled,
          content: updates.content,
          version: updates.version,
          author: updates.author,
          category: updates.category,
          priority: updates.priority,
          section: updates.section,
        });

        if (success) {
          // 重新加载到内存缓存
          loadFragmentsFromDatabase();
        }

        return { success };
      } catch (error: any) {
        console.error('[Snippets IPC] 更新 snippet 失败:', error);
        throw error;
      }
    });

    /**
     * 设置 snippet 启用状态
     */
    ipcMain.handle('snippets:setEnabled', async (_, snippetId: string, enabled: boolean) => {
      try {
        const success = setFragmentEnabled(snippetId, enabled);
        return { success };
      } catch (error: any) {
        console.error('[Snippets IPC] 设置 snippet 启用状态失败:', error);
        throw error;
      }
    });

    /**
     * 删除 snippet
     */
    ipcMain.handle('snippets:delete', async (_, snippetId: string) => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }
        const success = store.delete(snippetId);
        return { success };
      } catch (error: any) {
        console.error('[Snippets IPC] 删除 snippet 失败:', error);
        throw error;
      }
    });

    /**
     * 获取云端 snippets 列表
     */
    ipcMain.handle('snippets:fetchCloud', async (_, options?: { category?: PromptFragmentConfig['category']; limit?: number; offset?: number }) => {
      try {
        const response = await cloudSnippetService.fetchCloudSnippets(options);
        return response;
      } catch (error: any) {
        console.error('[Snippets IPC] 获取云端 snippets 失败:', error);
        throw error;
      }
    });

    /**
     * 同步云端 snippet 到本地
     */
    ipcMain.handle('snippets:syncFromCloud', async (_, cloudSnippetId: string) => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }

        // 先获取云端 snippet
        const cloudResponse = await cloudSnippetService.fetchCloudSnippets();
        const cloudSnippet = cloudResponse.snippets.find((s) => s.id === cloudSnippetId);

        if (!cloudSnippet) {
          throw new Error(`云端 snippet ${cloudSnippetId} 不存在`);
        }

        // 转换为 SnippetRecord 并同步
        const record = cloudSnippetService.convertToRecord(cloudSnippet);
        const localId = store.syncFromCloud(record);

        // 重新加载到内存缓存
        loadFragmentsFromDatabase();

        return { success: true, localId };
      } catch (error: any) {
        console.error('[Snippets IPC] 同步云端 snippet 失败:', error);
        throw error;
      }
    });

    /**
     * 批量同步云端 snippets 到本地
     */
    ipcMain.handle('snippets:syncManyFromCloud', async (_, cloudSnippetIds: string[]) => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }

        // 获取所有云端 snippets
        const cloudResponse = await cloudSnippetService.fetchCloudSnippets();
        const cloudSnippets = cloudResponse.snippets.filter((s) => cloudSnippetIds.includes(s.id));

        if (cloudSnippets.length === 0) {
          return { success: 0, failed: 0, message: '没有找到要同步的 snippets' };
        }

        // 转换为 SnippetRecord 并批量同步
        const records = cloudSnippetService.convertManyToRecords(cloudSnippets);
        const result = store.syncManyFromCloud(records);

        // 重新加载到内存缓存
        loadFragmentsFromDatabase();

        return result;
      } catch (error: any) {
        console.error('[Snippets IPC] 批量同步云端 snippets 失败:', error);
        throw error;
      }
    });

    /**
     * 刷新云端 snippets（重新拉取）
     */
    ipcMain.handle('snippets:refreshCloud', async () => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }

        // 清空现有云端 snippets
        store.clearCloudSnippets();

        // 重新拉取
        const response = await cloudSnippetService.fetchCloudSnippets();
        const records = cloudSnippetService.convertManyToRecords(response.snippets);

        // 保存到数据库（作为云端 snippets）
        for (const record of records) {
          store.save(record);
        }

        return { success: true, count: records.length };
      } catch (error: any) {
        console.error('[Snippets IPC] 刷新云端 snippets 失败:', error);
        throw error;
      }
    });

    /**
     * 获取所有云端 snippets（已拉取的）
     */
    ipcMain.handle('snippets:getAllCloud', async () => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }
        const snippets = store.getAllCloud();
        return snippets.map((record) => this.recordToConfig(record));
      } catch (error: any) {
        console.error('[Snippets IPC] 获取云端 snippets 失败:', error);
        throw error;
      }
    });

    /**
     * 检查云端 snippet 是否已同步到本地
     */
    ipcMain.handle('snippets:checkSynced', async (_, cloudSnippetId: string) => {
      try {
        const store = getSnippetStore();
        if (!store) {
          throw new Error('SnippetStore 未初始化');
        }
        const existing = store.findByCloudId(cloudSnippetId);
        return { synced: existing !== undefined, localId: existing?.id };
      } catch (error: any) {
        console.error('[Snippets IPC] 检查同步状态失败:', error);
        throw error;
      }
    });
  }

  cleanup(): void {
    // 清理 IPC 处理器
    ipcMain.removeHandler('snippets:getAllLocal');
    ipcMain.removeHandler('snippets:getEnabledLocal');
    ipcMain.removeHandler('snippets:get');
    ipcMain.removeHandler('snippets:update');
    ipcMain.removeHandler('snippets:setEnabled');
    ipcMain.removeHandler('snippets:delete');
    ipcMain.removeHandler('snippets:fetchCloud');
    ipcMain.removeHandler('snippets:syncFromCloud');
    ipcMain.removeHandler('snippets:syncManyFromCloud');
    ipcMain.removeHandler('snippets:refreshCloud');
    ipcMain.removeHandler('snippets:getAllCloud');
    ipcMain.removeHandler('snippets:checkSynced');
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
}

export const snippetsIPCModule = new SnippetsIPCModule();
