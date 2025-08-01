'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey, encryptTextWithPublicKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { LLMFactory } from '@repo/llm';
import fs from 'fs';
import path from 'path';

const privateKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'private.pem'), 'utf8');

export const getModelProviders = withUserAuth(async ({ organization }: AuthWrapperContext<{}>) => {
  const providers = LLMFactory.getAvailableProviders();
  return Object.keys(providers).map(provider => ({
    provider: provider,
    displayName: providers[provider]?.displayName ?? 'Unknown Provider',
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

export const getModelProviderConfigs = withUserAuth(async ({ organization }: AuthWrapperContext<{}>) => {
  const configs = await prisma.modelProviderConfigs.findMany({
    where: { organizationId: organization.id },
    select: {
      id: true,
      provider: true,
    },
  });
  return configs;
});

export const getModelProviderConfig = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ provider: string }>) => {
  const privateKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'private.pem'), 'utf8');
  const config = await prisma.modelProviderConfigs.findFirst({
    where: { organizationId: organization.id, provider: args.provider },
  });
  return config ? JSON.parse(decryptTextWithPrivateKey(config.config, privateKey)) : null;
});

export const updateModelProviderConfig = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ provider: string; config: any }>) => {
  const publicKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'public.pem'), 'utf8');
  const encryptedConfig = args.config ? encryptTextWithPublicKey(JSON.stringify(args.config), publicKey) : '';

  const config = await prisma.modelProviderConfigs.findFirst({
    where: { organizationId: organization.id, provider: args.provider, isDefault: true },
  });

  if (!config) {
    await prisma.modelProviderConfigs.create({
      data: { organizationId: organization.id, provider: args.provider, config: encryptedConfig },
    });
  } else {
    await prisma.modelProviderConfigs.update({ where: { id: config.id, organizationId: organization.id }, data: { config: encryptedConfig } });
  }

  return config;
});

export const testModelProviderConnection = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ provider: string }>) => {
  const config = await prisma.modelProviderConfigs.findFirst({
    where: { organizationId: organization.id, provider: args.provider },
  });
  if (!config) {
    return { success: false, error: 'Config not found' };
  }

  const provider = LLMFactory.getProvider(args.provider);
  if (!provider) {
    return { success: false, error: 'Provider not found' };
  }

  provider.setConfig(JSON.parse(decryptTextWithPrivateKey(config.config, privateKey)));
  const res = await provider.testConnection();
  if (res.success) {
    return { success: true, error: null };
  }
  return { success: false, error: res.error };
});
