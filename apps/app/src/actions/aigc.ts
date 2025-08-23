'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey, encryptTextWithPublicKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { AdapterManager, aigcProviderConfigSchema } from '@repo/llm/aigc';
import fs from 'fs';
import path from 'path';

const privateKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'private.pem'), 'utf8');
const publicKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'public.pem'), 'utf8');

// AIGC提供商信息
const aigcProviders = {
  doubao: {
    provider: 'doubao',
    displayName: 'Volcengine Ark',
    homepage: 'https://www.volcengine.com/docs/82379/1330310',
    description: '火山引擎方舟 AI，支持文生图、图生图、文生视频、图生视频等多种AI生成功能',
  },
  jimeng: {
    provider: 'jimeng',
    displayName: 'Volcengine Jimeng',
    homepage: 'https://www.volcengine.com/docs/85621/1544716/',
    description: '火山引擎即梦AI，支持文生图、图生图、文生视频、图生视频等多种AI生成功能',
  },
  wan: {
    provider: 'wan',
    displayName: 'Aliyun Bailian',
    homepage: 'https://bailian.console.aliyun.com/',
    description: '阿里云万相AI，支持文生图、图生视频、文生视频、关键帧生视频等多种AI生成功能',
  },
};

// 获取所有AIGC提供商信息
export const getAigcProviders = withUserAuth(async ({}: AuthWrapperContext<{}>) => {
  return Object.values(aigcProviders);
});

// 获取特定AIGC提供商信息
export const getAigcProviderInfo = withUserAuth(async ({ args }: AuthWrapperContext<{ provider: string }>) => {
  const { provider } = args;
  const providerInfo = aigcProviders[provider as keyof typeof aigcProviders];
  return providerInfo;
});

// 获取AIGC提供商配置
export const getAigcProviderConfig = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ provider: string }>) => {
  const { provider } = args;

  const config = await prisma.aigcProviderConfigs.findUnique({
    where: {
      organizationId_provider: {
        organizationId: orgId,
        provider,
      },
    },
  });

  if (!config) {
    return null;
  }

  const decryptedConfig = JSON.parse(decryptTextWithPrivateKey(config.config, privateKey));
  return decryptedConfig;
});

// 更新AIGC提供商配置
export const updateAigcProviderConfig = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ provider: string; config: any }>) => {
  const { provider, config } = args;

  try {
    const encryptedConfig = encryptTextWithPublicKey(JSON.stringify(config), publicKey);

    await prisma.aigcProviderConfigs.upsert({
      where: {
        organizationId_provider: {
          organizationId: orgId,
          provider,
        },
      },
      update: {
        config: encryptedConfig,
      },
      create: {
        organizationId: orgId,
        provider,
        config: encryptedConfig,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating AIGC provider config:', error);
    return { success: false, error: 'Failed to update config' };
  }
});

// 获取AIGC提供商配置列表
export const getAigcProviderConfigs = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const configs = await prisma.aigcProviderConfigs.findMany({
    where: { organizationId: orgId },
  });

  return configs.map(config => ({
    id: config.id,
    provider: config.provider,
  }));
});

// 获取AIGC提供商支持的模型
export const getAigcProviderModels = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ provider: string }>) => {
  const { provider } = args;

  const configs = await prisma.aigcProviderConfigs.findMany({ where: { organizationId: orgId } });
  const configMap = aigcProviderConfigSchema.parse(
    configs.reduce(
      (acc, config) => {
        acc[config.provider] = JSON.parse(decryptTextWithPrivateKey(config.config, privateKey));
        return acc;
      },
      {} as Record<string, any>,
    ),
  );

  const manager = AdapterManager.getInstance(configMap);
  const models = await manager.getAllServiceModels();

  // 过滤出指定provider的模型
  const providerModels = models.filter(model => model.service === provider);

  return providerModels;
});

// 测试AIGC提供商连接
export const testAigcProviderConnection = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ provider: string }>) => {
  const { provider } = args;

  try {
    const configs = await prisma.aigcProviderConfigs.findMany({ where: { organizationId: orgId } });
    const configMap = aigcProviderConfigSchema.parse(
      configs.reduce(
        (acc, config) => {
          acc[config.provider] = JSON.parse(decryptTextWithPrivateKey(config.config, privateKey));
          return acc;
        },
        {} as Record<string, any>,
      ),
    );

    const manager = AdapterManager.getInstance(configMap);

    // 尝试获取模型列表来测试连接
    const models = await manager.getAllServiceModels();
    const providerModels = models.filter(model => model.service === provider);

    if (providerModels.length > 0) {
      return { success: true, data: { success: true } };
    } else {
      return { success: true, data: { success: false, error: 'No models found' } };
    }
  } catch (error) {
    console.error('Error testing AIGC provider connection:', error);
    return { success: true, data: { success: false, error: (error as Error).message } };
  }
});
