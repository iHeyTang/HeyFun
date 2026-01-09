'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { VoiceCloneParams } from '@/llm/aigc';

// ============= 音色列表查询 =============

export type GetVoicesArgs = {
  provider?: string;
  type?: string;
  language?: string;
  status?: string;
  skip?: number;
  take?: number;
};

export const getVoices = withUserAuth(async ({ orgId, args }: AuthWrapperContext<GetVoicesArgs>) => {
  const voices = await prisma.voices.findMany({
    where: {
      organizationId: orgId,
      ...(args.provider && { provider: args.provider }),
      ...(args.type && { type: args.type }),
      ...(args.language && { language: args.language }),
      ...(args.status && { status: args.status }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: args.skip || 0,
    take: args.take || 20,
  });

  return voices;
});

// ============= 获取单个音色 =============

export type GetVoiceArgs = {
  id: string;
};

export const getVoice = withUserAuth(async ({ orgId, args }: AuthWrapperContext<GetVoiceArgs>) => {
  const voice = await prisma.voices.findFirst({
    where: {
      id: args.id,
      organizationId: orgId,
    },
  });

  return voice;
});

// ============= 创建音色 =============

export type CreateVoiceArgs = {
  name: string;
  description?: string;
  provider: string;
  model?: string;
  tags?: string[];
  previewAudio?: string;
  sourceAudio?: string;
  externalVoiceId?: string;
  extra?: Record<string, any>;
};

export const createVoice = withUserAuth(async ({ orgId, args }: AuthWrapperContext<CreateVoiceArgs>) => {
  const voice = await prisma.voices.create({
    data: {
      organizationId: orgId,
      name: args.name,
      description: args.description,
      provider: args.provider,
      model: args.model,
      tags: args.tags || [],
      previewAudio: args.previewAudio,
      sourceAudio: args.sourceAudio,
      externalVoiceId: args.externalVoiceId,
      extra: args.extra,
      status: 'active',
    },
  });

  return voice;
});

// ============= 更新音色 =============

export type UpdateVoiceArgs = {
  id: string;
  name?: string;
  description?: string;
  gender?: string;
  tags?: string[];
  previewAudio?: string;
  status?: string;
  extra?: Record<string, any>;
};

export const updateVoice = withUserAuth(async ({ orgId, args }: AuthWrapperContext<UpdateVoiceArgs>) => {
  const voice = await prisma.voices.updateMany({
    where: {
      id: args.id,
      organizationId: orgId,
    },
    data: {
      ...(args.name && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.gender !== undefined && { gender: args.gender }),
      ...(args.tags && { tags: args.tags }),
      ...(args.previewAudio !== undefined && { previewAudio: args.previewAudio }),
      ...(args.status && { status: args.status }),
      ...(args.extra && { extra: args.extra }),
    },
  });

  return voice;
});

// ============= 删除音色 =============

export type DeleteVoiceArgs = {
  id: string;
};

export const deleteVoice = withUserAuth(async ({ orgId, args }: AuthWrapperContext<DeleteVoiceArgs>) => {
  await prisma.voices.deleteMany({
    where: {
      id: args.id,
      organizationId: orgId,
    },
  });

  return { success: true };
});

// ============= 音色克隆任务 =============

export type CreateVoiceCloneTaskArgs = {
  name: string;
  description?: string;
  provider: string;
  audioFiles: string[];
  params?: Record<string, any>;
};

export const createVoiceCloneTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<CreateVoiceCloneTaskArgs>) => {
  const task = await prisma.voiceCloneTasks.create({
    data: {
      organizationId: orgId,
      name: args.name,
      description: args.description,
      provider: args.provider,
      audioFiles: args.audioFiles,
      params: args.params,
      status: 'pending',
    },
  });

  return task;
});

// ============= 获取音色克隆任务列表 =============

export type GetVoiceCloneTasksArgs = {
  status?: string;
  skip?: number;
  take?: number;
};

export const getVoiceCloneTasks = withUserAuth(async ({ orgId, args }: AuthWrapperContext<GetVoiceCloneTasksArgs>) => {
  const tasks = await prisma.voiceCloneTasks.findMany({
    where: {
      organizationId: orgId,
      ...(args.status && { status: args.status }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: args.skip || 0,
    take: args.take || 20,
  });

  return tasks;
});

// ============= 获取单个克隆任务 =============

export type GetVoiceCloneTaskArgs = {
  id: string;
};

export const getVoiceCloneTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<GetVoiceCloneTaskArgs>) => {
  const task = await prisma.voiceCloneTasks.findFirst({
    where: {
      id: args.id,
      organizationId: orgId,
    },
  });

  return task;
});

// ============= 更新克隆任务状态 =============

export type UpdateVoiceCloneTaskArgs = {
  id: string;
  status?: string;
  voiceId?: string;
  externalVoiceId?: string;
  error?: string;
};

export const updateVoiceCloneTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<UpdateVoiceCloneTaskArgs>) => {
  const task = await prisma.voiceCloneTasks.updateMany({
    where: {
      id: args.id,
      organizationId: orgId,
    },
    data: {
      ...(args.status && { status: args.status }),
      ...(args.voiceId !== undefined && { voiceId: args.voiceId }),
      ...(args.externalVoiceId !== undefined && { externalVoiceId: args.externalVoiceId }),
      ...(args.error !== undefined && { error: args.error }),
    },
  });

  return task;
});

// ============= 删除克隆任务 =============

export type DeleteVoiceCloneTaskArgs = {
  id: string;
};

export const deleteVoiceCloneTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<DeleteVoiceCloneTaskArgs>) => {
  await prisma.voiceCloneTasks.deleteMany({
    where: {
      id: args.id,
      organizationId: orgId,
    },
  });

  return { success: true };
});

// ============= AIGC 集成功能 =============

/**
 * 从 AIGC 模型同步音色列表到数据库
 */
export type SyncVoicesFromModelArgs = {
  modelName: string;
};

export const syncVoicesFromModel = withUserAuth(async ({ orgId, args }: AuthWrapperContext<SyncVoicesFromModelArgs>) => {
  try {
    const model = AIGC.getModel(args.modelName);
    if (!model) {
      throw new Error(`模型 ${args.modelName} 不存在`);
    }

    // 获取模型的音色列表
    const aigcVoices = await model.getVoiceList();

    // 同步到数据库
    let createdCount = 0;
    let updatedCount = 0;

    for (const aigcVoice of aigcVoices) {
      // 检查是否已存在
      const existingVoice = await prisma.voices.findFirst({
        where: {
          organizationId: orgId,
          externalVoiceId: aigcVoice.id,
          provider: model.name.split('-')[0], // 从模型名提取 provider，如 minimax-2-5-speech -> minimax
        },
      });

      if (existingVoice) {
        // 更新现有音色
        await prisma.voices.update({
          where: { id: existingVoice.id },
          data: {
            name: aigcVoice.name,
            description: aigcVoice.description,
          },
        });
        updatedCount++;
      } else {
        // 创建新音色
        await prisma.voices.create({
          data: {
            organizationId: orgId,
            name: aigcVoice.name,
            description: aigcVoice.description || '',
            provider: model.name.split('-')[0] || 'unknown',
            model: args.modelName,
            externalVoiceId: aigcVoice.id,
            status: 'active',
          },
        });
        createdCount++;
      }
    }

    return {
      success: true,
      created: createdCount,
      updated: updatedCount,
      total: aigcVoices.length,
    };
  } catch (error) {
    console.error('同步音色列表失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '同步失败',
    };
  }
});

/**
 * 使用 AIGC 模型克隆音色 - 异步workflow版本
 */
export type CloneVoiceWithModelArgs = {
  modelName: string;
  name: string;
  description?: string;
  audio: string; // 音频文件 URL 或 base64
  text: string; // 试听文本
};

export const cloneVoiceWithModel = withUserAuth(async ({ orgId, args }: AuthWrapperContext<CloneVoiceWithModelArgs>) => {
  try {
    const model = AIGC.getModel(args.modelName);
    if (!model) {
      throw new Error(`模型 ${args.modelName} 不存在`);
    }

    // 创建克隆任务记录
    const task = await prisma.voiceCloneTasks.create({
      data: {
        organizationId: orgId,
        name: args.name,
        description: args.description,
        provider: model.name.split('-')[0] || 'unknown',
        audioFiles: [args.audio],
        status: 'pending',
        params: {
          modelName: args.modelName,
          text: args.text,
        },
      },
    });

    // 构建workflow配置
    const workflowConfig = {
      task_id: `${orgId}/${task.id}`,
      model_name: args.modelName,
      name: args.name,
      description: args.description,
      audio: args.audio,
      text: args.text,
    };

    // 触发workflow
    const { workflowRunId } = await workflow.trigger({
      url: '/api/workflow/voice-clone',
      body: workflowConfig,
    });

    console.log('Voice clone workflow triggered:', workflowRunId);

    return {
      success: true,
      taskId: task.id,
      workflowRunId,
    };
  } catch (error) {
    console.error('克隆音色失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '克隆失败',
    };
  }
});

/**
 * 使用 AIGC 模型删除音色
 */
export type DeleteVoiceFromModelArgs = {
  id: string;
};

export const deleteVoiceFromModel = withUserAuth(async ({ orgId, args }: AuthWrapperContext<DeleteVoiceFromModelArgs>) => {
  try {
    // 获取音色信息
    const voice = await prisma.voices.findFirst({
      where: {
        id: args.id,
        organizationId: orgId,
      },
    });

    if (!voice) {
      throw new Error('音色不存在');
    }

    // 只有克隆的音色才需要从第三方平台删除
    if (voice.externalVoiceId && voice.model) {
      const model = AIGC.getModel(voice.model);
      if (model) {
        // 从第三方平台删除
        const result = await model.deleteVoice(voice.externalVoiceId);
        if (!result.success) {
          console.warn(`从第三方平台删除音色失败: ${result.error}`);
          // 即使第三方删除失败，也继续删除本地记录
        }
      }
    }

    // 从数据库删除
    await prisma.voices.delete({
      where: { id: args.id },
    });

    return { success: true };
  } catch (error) {
    console.error('删除音色失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除失败',
    };
  }
});

/**
 * 获取支持音色功能的 AIGC 模型列表
 */
export const getVoiceSupportedModels = withUserAuth('voices/getVoiceSupportedModels', async () => {
  try {
    const allModels = await AIGC.getAllServiceModels();

    // 筛选支持 text-to-speech 的模型
    const voiceModels = allModels.filter(model => model.generationTypes.includes('text-to-speech'));

    return voiceModels.map(model => ({
      name: model.name,
      displayName: model.displayName,
      description: model.description,
      provider: model.name.split('-')[0],
      supportsVoiceList: typeof model.getVoiceList === 'function',
      supportsCloning: typeof model.cloneVoice === 'function',
      supportsDeletion: typeof model.deleteVoice === 'function',
    }));
  } catch (error) {
    console.error('获取音色支持模型列表失败:', error);
    return [];
  }
});
