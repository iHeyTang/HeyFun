'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey, encryptTextWithPublicKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import AIGC from '@repo/llm/aigc';
import { LLMFactory } from '@repo/llm/chat';
import zodToJsonSchema, { JsonSchema7ArrayType, JsonSchema7EnumType, JsonSchema7ObjectType, JsonSchema7StringType } from 'zod-to-json-schema';

/**
 * Get all model providers
 */
export const getModelProviders = withUserAuth(async ({}: AuthWrapperContext<{}>) => {
  const providers = LLMFactory.getAvailableProviders();
  return Object.keys(providers).map(provider => ({
    provider: provider,
    displayName: providers[provider]?.displayName ?? 'Unknown Provider',
    homepage: providers[provider]?.homepage ?? '',
  }));
});

/**
 * Get all models of a provider by provider id
 */
export const getModelsByProvider = withUserAuth(async ({ args }: AuthWrapperContext<{ provider: string }>) => {
  const provider = LLMFactory.getAvailableProviders()[args.provider];
  if (!provider) {
    return;
  }
  return await provider.getModels();
});

/**
 * Get all available models
 */
export const getAvailableModels = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const providers = LLMFactory.getAvailableProviders();
  const configs = await prisma.modelProviderConfigs.findMany({
    where: { organizationId: orgId },
  });
  const availableProviders = Object.keys(providers).filter(
    provider => provider === 'builtin' || configs.some(config => config.provider === provider),
  );
  const models = await Promise.all(availableProviders.map(provider => providers[provider]?.getModels()));
  return models.filter(model => model !== undefined).flat();
});

/**
 * Get all model provider configs
 */
export const getModelProviderConfigs = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const configs = await prisma.modelProviderConfigs.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      provider: true,
    },
  });
  return [{ id: '', provider: 'builtin', config: {} }, ...configs];
});

/**
 * Update model provider config
 */
export const updateModelProviderConfig = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ provider: string; config: any }>) => {
  const encryptedConfig = args.config ? encryptTextWithPublicKey(JSON.stringify(args.config)) : '';

  const config = await prisma.modelProviderConfigs.findFirst({
    where: { organizationId: orgId, provider: args.provider, isDefault: true },
  });

  if (!config) {
    await prisma.modelProviderConfigs.create({
      data: { organizationId: orgId, provider: args.provider, config: encryptedConfig, isDefault: true },
    });
  } else {
    await prisma.modelProviderConfigs.update({ where: { id: config.id, organizationId: orgId }, data: { config: encryptedConfig } });
  }

  return config;
});

/**
 * Test model provider connection
 */
export const testModelProviderConnection = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ provider: string }>) => {
  const config = await prisma.modelProviderConfigs.findFirst({
    where: { organizationId: orgId, provider: args.provider },
  });
  if (!config) {
    return { success: false, error: 'Config not found' };
  }

  const provider = LLMFactory.getProvider(args.provider);
  if (!provider) {
    return { success: false, error: 'Provider not found' };
  }

  provider.setConfig(JSON.parse(decryptTextWithPrivateKey(config.config)));
  const res = await provider.testConnection();
  if (res.success) {
    return { success: true, error: null };
  }
  return { success: false, error: res.error };
});

/**
 * Get all AIGC models
 */
export const getAigcModels = withUserAuth(async () => {
  const models = await AIGC.getAllServiceModels();
  return models.map(model => ({
    name: model.name,
    displayName: model.displayName,
    description: model.description,
    costDescription: model.costDescription,
    generationTypes: model.generationTypes,
    paramsSchema: zodToJsonSchema(model.paramsSchema) as JsonSchema7ObjectType & {
      properties: {
        prompt: JsonSchema7StringType;
        referenceImage: JsonSchema7ArrayType;
        aspectRatio: JsonSchema7EnumType;
        duration: JsonSchema7EnumType;
      };
    },
  }));
});

/**
 * Get all voices of a model
 */
export const getAigcVoiceList = withUserAuth(async ({ args }: AuthWrapperContext<{ modelName: string }>) => {
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

    const voices = await model.getVoiceList();
    return voices;
  } catch (error) {
    console.error('Error getting voice list:', error);
    throw new Error((error as Error).message);
  }
});
