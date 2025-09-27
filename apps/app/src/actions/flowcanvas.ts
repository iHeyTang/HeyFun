'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

// 创建 FlowCanvas 项目
export const createFlowCanvasProject = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ name: string; schema?: any }>) => {
  const { name, schema = { nodes: [], edges: [] } } = args;

  try {
    const project = await prisma.flowCanvasProjects.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        schema,
      },
    });

    return project;
  } catch (error) {
    console.error('Error creating FlowCanvas project:', error);
    throw error;
  }
});

// 获取 FlowCanvas 项目列表
export const getFlowCanvasProjects = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ page?: number; pageSize?: number }>) => {
  const { page = 1, pageSize = 12 } = args || {};

  try {
    const projects = await prisma.flowCanvasProjects.findMany({
      where: {
        organizationId: orgId,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        schema: true,
      },
    });

    const total = await prisma.flowCanvasProjects.count({
      where: {
        organizationId: orgId,
      },
    });

    return { projects, total };
  } catch (error) {
    console.error('Error getting FlowCanvas projects:', error);
    throw error;
  }
});

// 获取单个 FlowCanvas 项目
export const getFlowCanvasProject = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ projectId: string }>) => {
  const { projectId } = args;

  try {
    const project = await prisma.flowCanvasProjects.findUnique({
      where: {
        id: projectId,
        organizationId: orgId,
      },
    });

    if (!project) {
      throw new Error('项目不存在');
    }

    return project;
  } catch (error) {
    console.error('Error getting FlowCanvas project:', error);
    throw error;
  }
});

// 更新 FlowCanvas 项目
export const updateFlowCanvasProject = withUserAuth(
  async ({ orgId, args }: AuthWrapperContext<{ projectId: string; name?: string; schema?: any }>) => {
    const { projectId, name, schema } = args;

    try {
      // 验证项目存在
      const existingProject = await prisma.flowCanvasProjects.findUnique({
        where: {
          id: projectId,
          organizationId: orgId,
        },
      });

      if (!existingProject) {
        throw new Error('项目不存在');
      }

      // 如果更新名称，检查是否与其他项目重名
      if (name && name.trim() !== existingProject.name) {
        const duplicateProject = await prisma.flowCanvasProjects.findFirst({
          where: {
            organizationId: orgId,
            name: name.trim(),
            id: { not: projectId },
          },
        });

        if (duplicateProject) {
          throw new Error('项目名称已存在');
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (schema !== undefined) updateData.schema = schema;

      const project = await prisma.flowCanvasProjects.update({
        where: { id: projectId },
        data: updateData,
      });

      return project;
    } catch (error) {
      console.error('Error updating FlowCanvas project:', error);
      throw error;
    }
  },
);

// 删除 FlowCanvas 项目
export const deleteFlowCanvasProject = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ projectId: string }>) => {
  const { projectId } = args;

  try {
    // 验证项目存在
    const existingProject = await prisma.flowCanvasProjects.findUnique({
      where: {
        id: projectId,
        organizationId: orgId,
      },
    });

    if (!existingProject) {
      throw new Error('项目不存在');
    }

    await prisma.flowCanvasProjects.delete({
      where: { id: projectId },
    });

    return;
  } catch (error) {
    console.error('Error deleting FlowCanvas project:', error);
    throw error;
  }
});
