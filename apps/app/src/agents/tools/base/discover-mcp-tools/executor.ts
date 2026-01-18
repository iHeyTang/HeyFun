import { mcpDiscoverToolsParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { ensureMCP, getOrganizationMCPs } from '@/lib/server/mcp/utils';
import { getMCPRuntimeManager } from '@/lib/server/mcp/providers/base';
import { Tool } from '../../registry';

export const mcpDiscoverToolsExecutor = definitionToolExecutor(mcpDiscoverToolsParamsSchema, async (args, context) => {
  try {
    if (!context.sessionId || !context.organizationId) {
      return {
        success: false,
        error: 'Session ID and Organization ID are required',
      };
    }

    const { configId } = args;
    const mrm = getMCPRuntimeManager();

    // 如果指定了 configId，只发现该 MCP 的工具
    if (configId) {
      const handle = await ensureMCP(context.sessionId, context.organizationId, configId);
      const instance = await mrm.get(handle);

      // 发现工具
      const toolsResult = await instance.discoverTools();

      // 注册工具到 ToolRegistry
      const toolsToRegister: Tool[] = toolsResult.tools.map(toolSchema => {
        // 提取原始 MCP 工具名称
        const mcpToolName = toolSchema.metadata?.mcpToolName as string | undefined;
        if (!mcpToolName) {
          throw new Error(`Missing mcpToolName in tool metadata: ${toolSchema.name}`);
        }

        return {
          schema: toolSchema,
          executor: async (args, ctx) => {
            // 调用 MCP 工具（使用原始工具名称）
            const result = await instance.callTool(mcpToolName, args);
            if (!result.success) {
              return {
                success: false,
                error: result.error || 'MCP tool call failed',
              };
            }
            return {
              success: true,
              data: result.data,
            };
          },
        };
      });

      // 延迟导入 toolRegistry 以避免循环依赖
      const { toolRegistry } = await import('@/agents/tools');
      toolRegistry.registerTools(toolsToRegister);

      return {
        success: true,
        data: {
          tools: toolsResult.tools.map(t => ({
            name: t.name,
            description: t.description,
            category: t.category,
          })),
          count: toolsResult.tools.length,
        },
      };
    } else {
      // 发现所有已配置的 MCP 工具
      const mcpConfigs = await getOrganizationMCPs(context.organizationId);
      const allTools: Array<{ name: string; description: string; category?: string }> = [];

      for (const config of mcpConfigs) {
        try {
          const handle = await ensureMCP(context.sessionId, context.organizationId, config.id);
          const instance = await mrm.get(handle);
          const toolsResult = await instance.discoverTools();

          // 注册工具
          const toolsToRegister: Tool[] = toolsResult.tools.map(toolSchema => {
            // 提取原始 MCP 工具名称
            const mcpToolName = toolSchema.metadata?.mcpToolName as string | undefined;
            if (!mcpToolName) {
              throw new Error(`Missing mcpToolName in tool metadata: ${toolSchema.name}`);
            }

            return {
              schema: toolSchema,
              executor: async (args, ctx) => {
                const result = await instance.callTool(mcpToolName, args);
                if (!result.success) {
                  return {
                    success: false,
                    error: result.error || 'MCP tool call failed',
                  };
                }
                return {
                  success: true,
                  data: result.data,
                };
              },
            };
          });

          // 延迟导入 toolRegistry 以避免循环依赖
          const { toolRegistry } = await import('@/agents/tools');
          toolRegistry.registerTools(toolsToRegister);

          allTools.push(
            ...toolsResult.tools.map(t => ({
              name: t.name,
              description: t.description,
              category: t.category,
            })),
          );
        } catch (error) {
          console.error(`[MCPDiscoverTools] Failed to discover tools for ${config.id}:`, error);
          // 继续处理其他 MCP
        }
      }

      return {
        success: true,
        data: {
          tools: allTools,
          count: allTools.length,
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
