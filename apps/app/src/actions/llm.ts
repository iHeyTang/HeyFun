'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import AIGC, { SubmitTaskParamsJsonSchema } from '@/llm/aigc';
import type { ModelInfo } from '@/llm/chat';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 从数据库加载所有模型定义
 */
export async function loadModelDefinitionsFromDatabase(): Promise<ModelInfo[]> {
  const definitions = await prisma.systemModelDefinitions.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return definitions.map(def => ({
    id: def.modelId,
    name: def.name,
    provider: def.provider,
    family: def.family,
    type: (def.type as 'language' | 'embedding' | 'image') || undefined,
    description: def.description || undefined,
    contextLength: def.contextLength || undefined,
    supportsStreaming: def.supportsStreaming,
    supportsFunctionCalling: def.supportsFunctionCalling,
    supportsVision: def.supportsVision,
    pricing: def.pricing as ModelInfo['pricing'] | undefined,
    enabled: def.enabled,
    metadata: (def.metadata as Record<string, any>) || undefined,
  }));
}

/**
 * Get all available models
 */
export const getChatModels = withUserAuth('llm/getChatModels', async () => {
  const models = await loadModelDefinitionsFromDatabase();
  return models;
});

/**
 * Get all AIGC models
 */
export const getAigcModels = withUserAuth('llm/getAigcModels', async () => {
  const models = await AIGC.getAllServiceModels();
  return models.map(model => ({
    name: model.name,
    provider: model.providerName,
    displayName: model.displayName,
    description: model.description,
    costDescription: model.costDescription,
    generationTypes: model.generationTypes,
    tags: model.tags,
    paramsSchema: zodToJsonSchema(model.paramsSchema) as { properties: SubmitTaskParamsJsonSchema },
  }));
});

/**
 * Get all voices of a model
 */
export const getAigcVoiceList = withUserAuth(
  'llm/getAigcVoiceList',
  async ({ orgId, args }: AuthWrapperContext<{ provider: string; modelName: string }>) => {
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
  },
);

/**
 * Get supported languages of a speech-to-text model
 */
export const getAigcSupportedLanguages = withUserAuth(
  'llm/getAigcSupportedLanguages',
  async ({ args }: AuthWrapperContext<{ modelName: string }>) => {
    const { modelName } = args;

    try {
      const model = AIGC.getModel(modelName);

      if (!model) {
        throw new Error('Model not found');
      }

      // 检查模型是否有 getSupportedLanguages 方法
      if (typeof model.getSupportedLanguages !== 'function') {
        // 如果不支持，返回空数组或默认语言列表
        return [];
      }

      // 获取支持的语言列表
      const languages = await model.getSupportedLanguages();
      return languages;
    } catch (error) {
      console.error('Error getting supported languages:', error);
      throw new Error((error as Error).message);
    }
  },
);
