import { ToolResult } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { prisma } from '@/lib/server/prisma';

export async function getCanvasStateExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { projectId } = args;
    if (!projectId || typeof projectId !== 'string') {
      return {
        success: false,
        error: 'Project ID is required and must be a string',
      };
    }

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
    const nodeList = (schema.nodes || [])
      .map((node: any, index: number) => `${index + 1}. ${node.data?.label || 'Unnamed'} (ID: ${node.id}, 类型: ${node.type})`)
      .join('\n');

    return {
      success: true,
      message: `📊 画布状态：\n📦 节点数量: ${schema.nodes?.length || 0}\n🔗 连接数量: ${schema.edges?.length || 0}\n\n📌 节点列表：\n${nodeList || '(无节点)'}`,
      data: {
        nodes: schema.nodes || [],
        edges: schema.edges || [],
        nodeCount: schema.nodes?.length || 0,
        edgeCount: schema.edges?.length || 0,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

