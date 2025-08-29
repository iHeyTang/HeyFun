'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey, encryptTextWithPublicKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { LLMFactory } from '@repo/llm/chat';

export const getModelProviders = withUserAuth(async ({}: AuthWrapperContext<{}>) => {
  const providers = LLMFactory.getAvailableProviders();
  return Object.keys(providers).map(provider => ({
    provider: provider,
    displayName: providers[provider]?.displayName ?? 'Unknown Provider',
    homepage: providers[provider]?.homepage ?? '',
  }));
});

export const getModelProviderInfo = withUserAuth(async ({ args }: AuthWrapperContext<{ provider: string }>) => {
  const provider = LLMFactory.getAvailableProviders()[args.provider];
  if (!provider) {
    return { success: false, error: 'Provider not found' };
  }
  return {
    provider: provider.provider,
    displayName: provider.displayName,
    homepage: provider.homepage,
  };
});

export const getModelProviderModels = withUserAuth(async ({ args }: AuthWrapperContext<{ provider: string }>) => {
  const provider = LLMFactory.getAvailableProviders()[args.provider];
  if (!provider) {
    return;
  }
  return await provider.getModels();
});

export const getAllAvailableModelProviderModels = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
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

export const getModelProviderConfig = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ provider: string }>) => {
  const config = await prisma.modelProviderConfigs.findFirst({
    where: { organizationId: orgId, provider: args.provider },
  });
  return config ? JSON.parse(decryptTextWithPrivateKey(config.config)) : null;
});

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
