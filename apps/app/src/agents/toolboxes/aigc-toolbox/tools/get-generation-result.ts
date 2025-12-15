import { ToolResult } from '@/agents/core/tools/tool-definition';
import { AigcToolboxContext } from '../context';
import { prisma } from '@/lib/server/prisma';

const executor = async (args: any, context: AigcToolboxContext): Promise<ToolResult> => {
  try {
    const { taskId } = args;

    if (!taskId || typeof taskId !== 'string') {
      return {
        success: false,
        error: 'Task ID is required and must be a string',
      };
    }

    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    // 查询任务
    const task = await prisma.paintboardTasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return {
        success: false,
        error: 'Task not found',
      };
    }

    // 检查权限
    if (task.organizationId !== context.organizationId) {
      return {
        success: false,
        error: 'Unauthorized: Task does not belong to your organization',
      };
    }

    // 直接返回结果，包含 key，前端可以根据需要获取 signedUrl
    const results = task.results;

    return {
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        model: task.model,
        generationType: task.generationType,
        results: results || [],
        error: task.error || null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const getGenerationResultTool = {
  toolName: 'get_generation_result',
  executor,
};

