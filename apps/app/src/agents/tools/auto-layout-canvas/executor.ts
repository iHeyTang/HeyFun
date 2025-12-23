import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getLayoutElements } from '@/components/block/flowcanvas/utils/layout';
import { prisma } from '@/lib/server/prisma';
import { autoLayoutCanvasParamsSchema } from './schema';

export const autoLayoutCanvasExecutor = definitionToolExecutor(autoLayoutCanvasParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { projectId, direction = 'LR' } = args;

    // 从数据库获取项目
    const project = await prisma.flowCanvasProjects.findUnique({
      where: {
        id: projectId,
        organizationId: context.organizationId,
      },
    });

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    const schema = (project.schema as any) || { nodes: [], edges: [] };
    const nodes = schema.nodes || [];
    const edges = schema.edges || [];

    if (nodes.length === 0) {
      return {
        success: true,
        message: '画布为空，无需布局',
        data: { direction },
      };
    }

    // 使用布局算法计算新位置
    const { nodes: layoutNodes } = getLayoutElements(nodes, edges, direction);

    // 更新数据库
    const newSchema = {
      nodes: layoutNodes,
      edges: schema.edges,
    };

    await prisma.flowCanvasProjects.update({
      where: { id: projectId },
      data: {
        schema: newSchema as any,
      },
    });

    return {
      success: true,
      message: `✅ 已应用 ${direction} 布局`,
      data: {
        direction,
        nodeCount: layoutNodes.length,
      },
    };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
});
