import { webSearchParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { searchProviderManager } from './provider-manager';

/**
 * Web Search Executor
 * 使用搜索提供者管理器执行搜索，支持多个搜索API提供者
 */
export const webSearchExecutor = definitionToolExecutor(webSearchParamsSchema, async (args, context) => {
  // 使用 workflow.run 包裹执行逻辑，避免重复调用
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      const { query, maxResults = 50, searchType = 'general', engine = 'auto' } = args;

      // 使用提供者管理器执行搜索
      // 如果指定了 engine，使用指定的提供者；否则自动选择最优的可用提供者
      // 如果失败会自动降级到其他提供者
      const providerName = engine === 'auto' ? undefined : engine;
      const { results, provider } = await searchProviderManager.search(
        {
          query,
          maxResults,
          searchType,
        },
        providerName,
      );

      // 如果仍然没有结果，返回错误
      if (!results || results.length === 0) {
        return {
          success: false,
          error: 'No search results found. Please try a different query or check your search API configuration.',
        };
      }

      return {
        success: true,
        data: {
          query,
          results,
          count: results.length,
          searchType,
          provider, // 返回实际使用的提供者
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
});
