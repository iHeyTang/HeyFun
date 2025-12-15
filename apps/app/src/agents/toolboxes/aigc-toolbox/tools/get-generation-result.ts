import { ToolResult } from '@/agents/core/tools/tool-definition';
import { AigcToolboxContext } from '../context';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';

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

    let results = task.results;
    if (results && Array.isArray(results) && results.length > 0) {
      results = await Promise.all(
        (results as any[]).map(async (result: any) => {
          if (result.key) {
            try {
              return {
                ...result,
                url: `/api/oss/${result.key}`,
              };
            } catch (error) {
              console.error('Error getting signed URL:', error);
              return result;
            }
          }
          return result;
        }),
      );
    }

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
