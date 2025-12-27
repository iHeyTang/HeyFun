import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import AIGC from '@repo/llm/aigc';
import { getCanvasCapabilitiesParamsSchema } from './schema';

export const getCanvasCapabilitiesExecutor = definitionToolExecutor(
  getCanvasCapabilitiesParamsSchema,
  async (args, context) => {
    return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
      try {
        const { projectId } = args;

    // 构建画布能力信息
    const capabilities: any = {
      features: {
        supportAutoLayout: true,
        supportBatchOperations: true,
        supportGrouping: true,
        supportWorkflowExecution: true,
      },
      supportedNodeTypes: ['text', 'image', 'video', 'audio', 'music', 'group'],
    };

    // 如果提供了projectId，从数据库获取项目信息
    if (projectId && context.organizationId) {
      const { prisma } = await import('@/lib/server/prisma');
      const project = await prisma.flowCanvasProjects.findUnique({
        where: {
          id: projectId,
          organizationId: context.organizationId,
        },
      });

      if (project) {
        const schema = (project.schema as any) || { nodes: [], edges: [] };
        // 从项目schema中提取已使用的节点类型
        const usedNodeTypes = new Set<string>();
        if (schema.nodes) {
          schema.nodes.forEach((node: any) => {
            if (node.type) {
              usedNodeTypes.add(node.type);
            }
          });
        }
        // 合并已使用的节点类型
        capabilities.usedNodeTypes = Array.from(usedNodeTypes);
      }
    }

    // 获取AIGC模型列表
    try {
      const models = await AIGC.getAllServiceModels();
      capabilities.aigcModels = models.map(model => ({
        name: model.name,
        provider: model.providerName,
        displayName: model.displayName,
        description: model.description || '',
        generationTypes: model.generationTypes,
      }));
    } catch (e) {
      capabilities.aigcModels = [];
      capabilities.modelsFetchError = '无法获取 AIGC 模型列表';
    }

    // 格式化能力信息为可读文本
    const lines: string[] = [];
    if (capabilities.supportedNodeTypes && capabilities.supportedNodeTypes.length > 0) {
      lines.push('\n📦 支持的节点类型:');
      lines.push(`  ${capabilities.supportedNodeTypes.join(', ')}`);
    }

    if (capabilities.aigcModels && capabilities.aigcModels.length > 0) {
      lines.push('\n🤖 可用 AIGC 模型:');
      const groupedModels: Record<string, any[]> = {};
      capabilities.aigcModels.forEach((model: any) => {
        const types = model.generationTypes || ['other'];
        types.forEach((type: string) => {
          if (!groupedModels[type]) {
            groupedModels[type] = [];
          }
          if (!groupedModels[type].some(m => m.name === model.name)) {
            groupedModels[type].push(model);
          }
        });
      });

      Object.entries(groupedModels).forEach(([type, models]) => {
        lines.push(`  • ${type}:`);
        models.forEach((m: any) => {
          lines.push(`    - ${m.name} (${m.provider || 'unknown'})`);
          if (m.description) {
            lines.push(`      ${m.description}`);
          }
        });
      });
    } else {
      lines.push('\n⚠️ 暂无可用 AIGC 模型');
      if (capabilities.modelsFetchError) {
        lines.push(`  原因: ${capabilities.modelsFetchError}`);
      }
    }

    if (capabilities.features) {
      lines.push('\n✨ 功能特性:');
      Object.entries(capabilities.features).forEach(([key, value]) => {
        lines.push(`  • ${key}: ${value ? '✅' : '❌'}`);
      });
    }

    return {
      success: true,
      message: `📋 画布能力信息：${lines.join('\n')}`,
      data: capabilities,
    };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });
  },
);

