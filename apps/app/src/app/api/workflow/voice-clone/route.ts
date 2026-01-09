import { prisma } from '@/lib/server/prisma';
import storage, { downloadFile } from '@/lib/server/storage';
import { to } from '@/lib/shared/to';
import { toJson } from '@/lib/utils';
import AIGC from '@/llm/aigc';
import { serve } from '@upstash/workflow/nextjs';
import { nanoid } from 'nanoid';

export interface VoiceCloneWorkflowConfig {
  task_id: string;
  model_name: string;
  name: string;
  description?: string;
  audio: string;
  text: string;
}

export const { POST } = serve<VoiceCloneWorkflowConfig>(async context => {
  const { orgId, taskId } = parseTaskId(context.requestPayload.task_id);

  await context.run('voice-clone-start', async () => {
    // 更新任务状态为处理中
    await prisma.voiceCloneTasks.update({
      where: { id: taskId },
      data: { status: 'processing' },
    });
  });

  await context.run('voice-clone-process', async () => {
    const model = AIGC.getModel(context.requestPayload.model_name);
    if (!model) {
      throw new Error(`模型 ${context.requestPayload.model_name} 不存在`);
    }

    // 调用克隆API - 返回task_id
    const cloneParams = {
      name: context.requestPayload.name,
      description: context.requestPayload.description,
      audio: await storage.getSignedUrl(context.requestPayload.audio),
      text: context.requestPayload.text,
    };

    const [error, cloneTaskId] = await to(model.cloneVoice(cloneParams));
    if (error) {
      await prisma.voiceCloneTasks.update({
        where: { id: taskId },
        data: { status: 'failed', error: error.message },
      });
      return;
    }

    // 轮询获取克隆结果
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询60次，每次等待10秒
    let result;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒

      try {
        result = await model.getCloneVoiceResult(cloneTaskId);

        if (result.success) {
          // 克隆成功，跳出循环
          break;
        } else if (result.error) {
          console.error('克隆失败:', result.error);
          break;
        }

        // 还在处理中，继续轮询
        attempts++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Task not found')) {
          // 任务不存在，可能还在处理中
          attempts++;
          continue;
        }
        throw error;
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error('音色克隆超时，请稍后重试');
    }

    if (!result || !result.success) {
      await prisma.voiceCloneTasks.update({
        where: { id: taskId },
        data: { status: 'failed', error: result?.error || '音色克隆失败' },
      });
      return;
    }

    // 处理预览音频：如果是URL类型，下载并上传到自己的storage
    let previewAudioKey: string | undefined;
    let demoAudioExtra: any;

    if (result.demo_audio?.type === 'url') {
      const [downloadError, fileData] = await to(downloadFile(result.demo_audio.data));
      if (!downloadError && fileData) {
        // 生成存储key
        const key = `${orgId}/voices/preview/${Date.now()}_${nanoid(8)}.${fileData.extension}`;

        // 上传到storage
        const [uploadError] = await to(storage.put(key, fileData.buffer));
        if (!uploadError) {
          previewAudioKey = key;
        } else {
          console.error('上传预览音频失败:', uploadError);
          // 如果上传失败，保存到extra字段
          demoAudioExtra = { demo_audio: result.demo_audio };
        }
      } else {
        console.error('下载预览音频失败:', downloadError);
        // 如果下载失败，保存到extra字段
        demoAudioExtra = { demo_audio: result.demo_audio };
      }
    } else if (result.demo_audio) {
      // 非URL类型，保存到extra字段
      demoAudioExtra = { demo_audio: result.demo_audio };
    }

    // 创建音色记录
    const voice = await prisma.voices.create({
      data: {
        organizationId: orgId,
        name: context.requestPayload.name,
        description: context.requestPayload.description || '',
        provider: model.name.split('-')[0] || 'unknown',
        model: context.requestPayload.model_name,
        externalVoiceId: result.voiceId,
        sourceAudio: context.requestPayload.audio,
        previewAudio: previewAudioKey,
        tags: [],
        status: 'active',
        extra: demoAudioExtra,
      },
    });

    // 更新任务状态为完成
    await prisma.voiceCloneTasks.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        voiceId: voice.id,
        externalVoiceId: result.voiceId,
      },
    });
  });
});

const parseTaskId = (taskId: string) => {
  return { orgId: taskId.split('/')[0]!, taskId: taskId.split('/')[1]! };
};
