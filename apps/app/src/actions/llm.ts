'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import AIGC, { SubmitTaskParamsJsonSchema } from '@repo/llm/aigc';
import CHAT from '@repo/llm/chat';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * Get all available models
 */
export const getChatModels = withUserAuth(async () => {
  const models = CHAT.getModels();
  return models;
});

/**
 * Get all AIGC models
 */
export const getAigcModels = withUserAuth(async () => {
  const models = await AIGC.getAllServiceModels();
  return models.map(model => ({
    name: model.name,
    provider: model.providerName,
    displayName: model.displayName,
    description: model.description,
    costDescription: model.costDescription,
    generationTypes: model.generationTypes,
    paramsSchema: zodToJsonSchema(model.paramsSchema) as { properties: SubmitTaskParamsJsonSchema },
  }));
});

/**
 * Get all voices of a model
 */
export const getAigcVoiceList = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ provider: string; modelName: string }>) => {
  const { modelName } = args;

  try {
    const model = AIGC.getModel(modelName);

    if (!model) {
      throw new Error('Model not found');
    }

    // 检查模型是否有 getAigcVoiceList 方法
    if (typeof model.getVoiceList !== 'function') {
      throw new Error('Model does not support voice selection');
    }

    // 获取自定义音色
    const customVoices = await prisma.voices
      .findMany({
        where: { organizationId: orgId, model: modelName },
        select: { externalVoiceId: true, name: true, description: true, previewAudio: true },
      })
      .then(voices =>
        voices.map(voice => ({
          id: voice.externalVoiceId!,
          name: voice.name,
          description: voice.description || '',
          audio: voice.previewAudio || '',
          custom: true,
        })),
      );

    // 获取模型自带音色
    const voices = await model.getVoiceList();
    const systemVoices = await prisma.systemVoices.findMany({
      where: { provider: model.providerName },
      select: { externalVoiceId: true, name: true, description: true, audio: true },
    });
    return [
      ...customVoices,
      ...voices.map(voice => {
        const systemVoice = systemVoices.find(v => v.externalVoiceId === voice.id);
        const description = voice.description || systemVoice?.description || '';
        return { id: voice.id, name: voice.name, description: description, audio: systemVoice?.audio || '', custom: false };
      }),
    ];
  } catch (error) {
    console.error('Error getting voice list:', error);
    throw new Error((error as Error).message);
  }
});
