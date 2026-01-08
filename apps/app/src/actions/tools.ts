'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { encryptTextWithPublicKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { readmeFetcher } from '@/lib/server/readme-fetcher';
import { to } from '@/lib/shared/to';
import { mcpServerSchema } from '@/lib/shared/tools';
import Ajv from 'ajv';
import { JSONSchema } from 'json-schema-to-ts';
import { z } from 'zod';
import { toolRegistry } from '@/agents/tools';

const ajv = new Ajv();

export const listAgentTools = withUserAuth('tools/listAgentTools', async ({ orgId }: AuthWrapperContext<{}>) => {
  // 获取 McpServerConfigs
  const mcpConfigs = await prisma.mcpServerConfigs.findMany({
    where: {
      organizationId: orgId,
    },
  });

  // 获取所有 ToolSchemas（用于匹配）
  const allToolSchemas = await prisma.toolSchemas.findMany({
    select: { id: true, name: true, description: true },
  });

  // 创建 name -> schema 映射
  const schemaMap = new Map(allToolSchemas.map(s => [s.name, s]));

  // 转换为工具列表
  const tools = mcpConfigs.map(mcpConfig => {
    const matchedSchema = schemaMap.get(mcpConfig.name);
    return {
      id: mcpConfig.id,
      name: mcpConfig.name,
      type: 'mcp',
      description: matchedSchema?.description || null,
      mcpConfigId: mcpConfig.id,
      schema: matchedSchema
        ? {
            id: matchedSchema.id,
            name: matchedSchema.name,
          }
        : undefined,
    };
  });

  return tools;
});

type ToolConfig = {
  toolId: string;
  env: Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, any>;
};
export const installTool = withUserAuth('tools/installTool', async ({ orgId, args }: AuthWrapperContext<ToolConfig>) => {
  const { toolId, env, query = {}, headers = {} } = args;
  const tool = await prisma.toolSchemas.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    throw new Error('Tool not found');
  }

  const validateEnv = ajv.compile(tool.envSchema);
  const isEnvValid = validateEnv(env);

  if (!isEnvValid) {
    throw new Error(`Invalid environment variables config: ${JSON.stringify(validateEnv.errors)}`);
  }

  if (tool.querySchema && typeof tool.querySchema === 'object' && Object.keys(query).length > 0) {
    const validateQuery = ajv.compile(tool.querySchema);
    const isQueryValid = validateQuery(query);

    if (!isQueryValid) {
      throw new Error(`Invalid query parameters config: ${JSON.stringify(validateQuery.errors)}`);
    }
  }

  if (tool.headersSchema && typeof tool.headersSchema === 'object' && Object.keys(headers).length > 0) {
    const validateHeaders = ajv.compile(tool.headersSchema);
    const isHeadersValid = validateHeaders(headers);

    if (!isHeadersValid) {
      throw new Error(`Invalid headers config: ${JSON.stringify(validateHeaders.errors)}`);
    }
  }

  // 构建 MCP 配置（兼容新系统）
  const mcpConfig: z.infer<typeof mcpServerSchema> = {
    command: tool.command || undefined,
    args: Array.isArray(tool.args) ? (tool.args as string[]) : undefined,
    env: Object.keys(env).length > 0 ? env : undefined,
    url: tool.url || undefined,
    query: Object.keys(query).length > 0 ? query : undefined,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };

  // 验证 MCP 配置
  const validationResult = mcpServerSchema.safeParse(mcpConfig);
  if (!validationResult.success) {
    throw new Error(`Invalid MCP config: ${validationResult.error.message}`);
  }

  // 加密 MCP 配置
  const encryptedMcpConfig = encryptTextWithPublicKey(JSON.stringify(validationResult.data));

  // 检查是否已存在 McpServerConfigs（通过 name 匹配）
  const existingMcpConfig = await prisma.mcpServerConfigs.findFirst({
    where: {
      organizationId: orgId,
      name: tool.name,
    },
  });

  // 更新或创建 McpServerConfigs
  if (existingMcpConfig) {
    await prisma.mcpServerConfigs.update({
      where: { id: existingMcpConfig.id },
      data: {
        encryptedConfig: encryptedMcpConfig,
      },
    });
  } else {
    await prisma.mcpServerConfigs.create({
      data: {
        organizationId: orgId,
        name: tool.name,
        encryptedConfig: encryptedMcpConfig,
      },
    });
  }
});

export const installCustomTool = withUserAuth(
  'tools/installCustomTool',
  async ({ orgId, args }: AuthWrapperContext<{ name: string; config: string }>) => {
    const { name, config } = args;
    const [err, json] = await to<z.infer<typeof mcpServerSchema>>(JSON.parse(config));
    if (err) {
      throw new Error('Invalid config, config should be a valid JSON object');
    }

    const validationResult = mcpServerSchema.safeParse(json);
    if (!validationResult.success) {
      throw new Error(`Invalid config: ${validationResult.error.message}`);
    }

    // 加密 MCP 配置
    const encryptedMcpConfig = encryptTextWithPublicKey(JSON.stringify(validationResult.data));

    // 检查是否已存在
    const existingMcpConfig = await prisma.mcpServerConfigs.findFirst({
      where: {
        organizationId: orgId,
        name,
      },
    });

    if (existingMcpConfig) {
      await prisma.mcpServerConfigs.update({
        where: { id: existingMcpConfig.id },
        data: {
          encryptedConfig: encryptedMcpConfig,
        },
      });
    } else {
      await prisma.mcpServerConfigs.create({
        data: {
          organizationId: orgId,
          name,
          encryptedConfig: encryptedMcpConfig,
        },
      });
    }

    return { message: 'Tool installed successfully' };
  },
);

export const removeTool = withUserAuth('tools/removeTool', async ({ orgId, args }: AuthWrapperContext<{ toolId: string }>) => {
  const { toolId } = args;
  const mcpConfig = await prisma.mcpServerConfigs.findFirst({
    where: { id: toolId, organizationId: orgId },
  });

  if (!mcpConfig) {
    throw new Error('Tool not found');
  }

  // 删除 McpServerConfigs
  await prisma.mcpServerConfigs.delete({
    where: { id: toolId, organizationId: orgId },
  });

  return { message: 'Tool removed successfully' };
});

/**
 * list all ToolSchemas from marketplace
 */
export const listToolSchemas = withUserAuth('tools/listToolSchemas', async ({}: AuthWrapperContext<{}>) => {
  const tools = await prisma.toolSchemas.findMany({});
  return tools;
});

/**
 * register a new tool
 * only root user can register a new tool
 * @deprecated
 */
export const registerTool = withUserAuth(
  'tools/registerTool',
  async ({}: AuthWrapperContext<{ name: string; description: string; repoUrl?: string; command: string; args: string[]; envSchema: JSONSchema }>) => {
    throw new Error('Deprecated');
  },
);

export const refreshToolMetadata = withUserAuth('tools/refreshToolMetadata', async ({ args }: AuthWrapperContext<{ toolId: string }>) => {
  const { toolId } = args;

  if (!toolId) {
    throw new Error('Tool ID is required');
  }

  // Fetch the tool to ensure it exists
  const tool = await prisma.toolSchemas.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    throw new Error('Tool not found');
  }

  let metadata;

  if (tool.repoUrl?.includes('github.com')) {
    metadata = await readmeFetcher.fetchGitHubMetadata(tool.repoUrl);
  } else if (tool.repoUrl?.includes('npmjs.com')) {
    metadata = await readmeFetcher.fetchNpmMetadata(tool.repoUrl);
  } else {
    throw new Error('Unsupported URL type. Only GitHub and npm URLs are supported.');
  }

  // Update the tool with fetched metadata
  const updatedTool = await prisma.toolSchemas.update({
    where: { id: toolId },
    data: {
      readme: metadata.readme,
      logoUrl: metadata.logoUrl,
      sourceUrl: metadata.stars ? tool.repoUrl : undefined, // Use original URL as source
      author: metadata.author,
      version: metadata.version,
      license: metadata.license,
      category: metadata.category,
      tags: metadata.tags || [],
      capabilities: metadata.capabilities || [],
      downloads: metadata.downloads,
      stars: metadata.stars,
      lastUpdated: metadata.lastUpdated,
      metadata: {
        fetchedAt: new Date(),
        source: tool.repoUrl?.includes('github.com') ? 'github' : 'npm',
      },
    },
  });

  return updatedTool;
});

/**
 * 获取所有内置工具信息
 * @param locale 语言代码，用于返回对应语言的工具显示名称
 */
export const getBuiltinTools = withUserAuth('tools/getBuiltinTools', async ({ args }: AuthWrapperContext<{ locale?: string }>) => {
  const { locale = 'en' } = args || {};
  const allSchemas = toolRegistry.getAllToolSchemas();

  return allSchemas.map(schema => ({
    name: schema.name,
    displayName: schema.displayName?.[locale] || schema.displayName?.['en'] || schema.name,
    description: schema.description,
    category: schema.category,
    parameters: schema.parameters,
    returnSchema: schema.returnSchema,
    manual: schema.manual,
    displayNameMap: schema.displayName || {},
  }));
});

/**
 * 获取指定内置工具信息
 * @param toolName 工具名称
 * @param locale 语言代码，用于返回对应语言的工具显示名称
 */
export const getBuiltinTool = withUserAuth('tools/getBuiltinTool', async ({ args }: AuthWrapperContext<{ toolName: string; locale?: string }>) => {
  const { toolName, locale = 'en' } = args;
  const schema = toolRegistry.getToolDefinition(toolName);

  if (!schema) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  return {
    name: schema.name,
    displayName: schema.displayName?.[locale] || schema.displayName?.['en'] || schema.name,
    description: schema.description,
    category: schema.category,
    parameters: schema.parameters,
    returnSchema: schema.returnSchema,
    manual: schema.manual,
    displayNameMap: schema.displayName || {},
  };
});
