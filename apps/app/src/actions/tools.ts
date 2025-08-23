'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { encryptTextWithPublicKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { readmeFetcher } from '@/lib/server/readme-fetcher';
import { to } from '@/lib/shared/to';
import { mcpServerSchema } from '@/lib/shared/tools';
import Ajv from 'ajv';
import fs from 'fs';
import { JSONSchema } from 'json-schema-to-ts';
import path from 'path';
import { z } from 'zod';

const ajv = new Ajv();

export const listAgentTools = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
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

export const installTool = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ toolId: string; env: Record<string, string> }>) => {
  const publicKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'public.pem'), 'utf8');
  const { toolId, env } = args;
  const tool = await prisma.toolSchemas.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    throw new Error('Tool not found');
  }

  const validate = ajv.compile(tool.envSchema);
  const isValid = validate(env);

  if (!isValid) {
    throw new Error(`Invalid environment variables config: ${JSON.stringify(validate.errors)}`);
  }

  const existing = await prisma.agentTools.findUnique({
    where: { schemaId_organizationId: { schemaId: toolId, organizationId: orgId } },
  });

  if (existing) {
    await prisma.agentTools.update({
      where: { schemaId_organizationId: { schemaId: toolId, organizationId: orgId } },
      data: { env: encryptTextWithPublicKey(JSON.stringify(env), publicKey) },
    });
  } else {
    await prisma.agentTools.create({
      data: {
        source: 'STANDARD',
        organizationId: orgId,
        schemaId: toolId,
        env: encryptTextWithPublicKey(JSON.stringify(env), publicKey),
      },
    });
  }
});

export const installCustomTool = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ name: string; config: string }>) => {
  const { name, config } = args;
  const [err, json] = await to<z.infer<typeof mcpServerSchema>>(JSON.parse(config));
  if (err) {
    throw new Error('Invalid config, config should be a valid JSON object');
  }

  const validationResult = mcpServerSchema.safeParse(json);
  if (!validationResult.success) {
    throw new Error(`Invalid config: ${validationResult.error.message}`);
  }

  const publicKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'public.pem'), 'utf8');
  await prisma.agentTools.create({
    data: {
      source: 'CUSTOM',
      organizationId: orgId,
      name,
      customConfig: encryptTextWithPublicKey(config, publicKey),
    },
  });

  return { message: 'Tool installed successfully' };
});

export const removeTool = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ toolId: string }>) => {
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
export const listToolSchemas = withUserAuth(async ({}: AuthWrapperContext<{}>) => {
  const tools = await prisma.toolSchemas.findMany({});
  return tools;
});

/**
 * register a new tool
 * only root user can register a new tool
 * @deprecated
 */
export const registerTool = withUserAuth(
  async ({}: AuthWrapperContext<{ name: string; description: string; repoUrl?: string; command: string; args: string[]; envSchema: JSONSchema }>) => {
    throw new Error('Deprecated');
  },
);

export const refreshToolMetadata = withUserAuth(async ({ args }: AuthWrapperContext<{ toolId: string }>) => {
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
