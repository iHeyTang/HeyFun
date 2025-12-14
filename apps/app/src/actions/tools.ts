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

const ajv = new Ajv();

export const listAgentTools = withUserAuth('tools/listAgentTools', async ({ orgId }: AuthWrapperContext<{}>) => {
  // Get organization custom tools
  const tools = await prisma.agentTools
    .findMany({
      where: {
        organizationId: orgId,
      },
      include: { schema: { select: { id: true, name: true, description: true } } },
    })
    .then(res =>
      res.map(r => ({
        id: r.id,
        name: r.name || r.schema?.name || r.id,
        type: 'mcp',
        description: r.schema?.description,
        source: r.source,
        schema: {
          id: r.schema?.id,
          name: r.schema?.name,
        },
      })),
    );

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

  const existing = await prisma.agentTools.findUnique({
    where: { schemaId_organizationId: { schemaId: toolId, organizationId: orgId } },
  });

  if (existing) {
    await prisma.agentTools.update({
      where: { schemaId_organizationId: { schemaId: toolId, organizationId: orgId } },
      data: {
        env: encryptTextWithPublicKey(JSON.stringify(env)),
        query: Object.keys(query).length > 0 ? encryptTextWithPublicKey(JSON.stringify(query)) : null,
        headers: Object.keys(headers).length > 0 ? encryptTextWithPublicKey(JSON.stringify(headers)) : null,
      },
    });
  } else {
    await prisma.agentTools.create({
      data: {
        source: 'STANDARD',
        organizationId: orgId,
        schemaId: toolId,
        env: encryptTextWithPublicKey(JSON.stringify(env)),
        query: Object.keys(query).length > 0 ? encryptTextWithPublicKey(JSON.stringify(query)) : null,
        headers: Object.keys(headers).length > 0 ? encryptTextWithPublicKey(JSON.stringify(headers)) : null,
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

    await prisma.agentTools.create({
      data: {
        source: 'CUSTOM',
        organizationId: orgId,
        name,
        customConfig: encryptTextWithPublicKey(config),
      },
    });

    return { message: 'Tool installed successfully' };
  },
);

export const removeTool = withUserAuth('tools/removeTool', async ({ orgId, args }: AuthWrapperContext<{ toolId: string }>) => {
  const { toolId } = args;
  const tool = await prisma.agentTools.findFirst({
    where: { id: toolId, organizationId: orgId },
  });

  if (!tool) {
    throw new Error('Tool not found');
  }

  await prisma.agentTools.delete({
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
