import { prisma } from './prisma';
import type { ModelInfo } from '@/llm/chat';

/**
 * 验证系统 API Key
 */
export function verifySystemApiKey(authHeader: string | null): boolean {
  return authHeader === `Bearer ${process.env.SYSTEM_API_KEY}`;
}

/**
 * 模型定义输入类型（用于创建和更新）
 */
export interface ModelDefinitionInput {
  modelId: string;
  name: string;
  provider: string;
  family: string;
  type?: string;
  description?: string;
  contextLength?: number;
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  supportsVision?: boolean;
  pricing?: any;
  enabled?: boolean;
  metadata?: any;
}

/**
 * 模型定义更新类型（所有字段可选，除了 modelId）
 */
export interface ModelDefinitionUpdate extends Partial<Omit<ModelDefinitionInput, 'modelId'>> {
  modelId: string;
}

/**
 * Vercel 格式的模型定义
 */
export interface VercelModelDefinition {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  name: string;
  description?: string;
  context_window?: number;
  max_tokens?: number;
  type?: string;
  tags?: string[];
  pricing?: {
    input?: string | number;
    output?: string | number;
    currency?: string;
  };
}

/**
 * 从 Vercel 格式转换为内部格式
 */
export function convertVercelToInternal(vercelModel: VercelModelDefinition, defaultProvider = 'vercel'): ModelDefinitionInput {
  // 从 id 中提取 provider 和 family
  // 格式通常是: provider/model-name 或 provider/family/model-name
  const idParts = vercelModel.id.split('/');
  let provider = defaultProvider;
  let family: string;

  // 如果 id 包含 provider 信息，尝试提取
  if (idParts.length >= 1 && idParts[0]) {
    // 常见的 provider 名称
    const knownProviders = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'cohere', 'alibaba', 'deepseek', 'qwen', 'xai'];
    const firstPart = idParts[0].toLowerCase();

    if (knownProviders.includes(firstPart)) {
      provider = firstPart;
      family = firstPart;

      // 特殊处理：某些模型可能需要不同的 family
      // 例如：alibaba/qwen-* 可能 family 应该是 qwen
      if (firstPart === 'alibaba' && idParts.length > 1 && idParts[1]) {
        const modelName = idParts[1].toLowerCase();
        if (modelName.includes('qwen')) {
          family = 'qwen';
        }
      }
    } else {
      // 如果第一部分不是已知 provider，使用它作为 family
      family = firstPart;
    }
  } else {
    // 如果无法从 id 提取，使用默认值
    family = defaultProvider;
  }

  // 从 tags 中推断能力
  const tags = vercelModel.tags || [];
  const supportsFunctionCalling = tags.includes('tool-use') || tags.includes('function-calling');
  const supportsVision = tags.includes('vision') || tags.includes('multimodal');
  const supportsStreaming = true; // Vercel 模型通常支持流式输出

  // 转换定价格式
  const pricing = vercelModel.pricing
    ? {
        input: vercelModel.pricing.input?.toString(),
        output: vercelModel.pricing.output?.toString(),
        currency: vercelModel.pricing.currency || 'USD',
      }
    : undefined;

  return {
    modelId: vercelModel.id,
    name: vercelModel.name,
    provider,
    family,
    type: vercelModel.type || 'language',
    description: vercelModel.description,
    contextLength: vercelModel.context_window || vercelModel.max_tokens || undefined,
    supportsStreaming,
    supportsFunctionCalling,
    supportsVision,
    pricing,
    enabled: false, // 默认未启用
    metadata: {
      vercelFormat: true,
      ownedBy: vercelModel.owned_by,
      tags: vercelModel.tags,
      maxTokens: vercelModel.max_tokens,
    },
  };
}

/**
 * 标准化模型定义输入（根据指定格式转换）
 */
export function normalizeModelInput(data: any, format: 'internal' | 'vercel', defaultProvider = 'vercel'): ModelDefinitionInput {
  switch (format) {
    case 'vercel':
      return convertVercelToInternal(data as VercelModelDefinition, defaultProvider);
    case 'internal':
      return data as ModelDefinitionInput;
    default:
      throw new Error(`Unsupported model format. Expected 'internal' or 'vercel' format.`);
  }
}

/**
 * 构建 Prisma 创建数据
 */
export function buildCreateData(input: ModelDefinitionInput) {
  return {
    modelId: input.modelId,
    name: input.name,
    provider: input.provider,
    family: input.family,
    type: input.type || null,
    description: input.description || null,
    contextLength: input.contextLength || null,
    supportsStreaming: input.supportsStreaming ?? false,
    supportsFunctionCalling: input.supportsFunctionCalling ?? false,
    supportsVision: input.supportsVision ?? false,
    pricing: input.pricing ? JSON.parse(JSON.stringify(input.pricing)) : null,
    enabled: input.enabled ?? false,
    metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : null,
  };
}

/**
 * 构建 Prisma 更新数据
 */
export function buildUpdateData(input: Partial<ModelDefinitionInput>) {
  const updateData: any = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.provider !== undefined) updateData.provider = input.provider;
  if (input.family !== undefined) updateData.family = input.family;
  if (input.type !== undefined) updateData.type = input.type || null;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.contextLength !== undefined) updateData.contextLength = input.contextLength || null;
  if (input.supportsStreaming !== undefined) updateData.supportsStreaming = input.supportsStreaming;
  if (input.supportsFunctionCalling !== undefined) updateData.supportsFunctionCalling = input.supportsFunctionCalling;
  if (input.supportsVision !== undefined) updateData.supportsVision = input.supportsVision;
  if (input.pricing !== undefined) updateData.pricing = input.pricing ? JSON.parse(JSON.stringify(input.pricing)) : null;
  if (input.enabled !== undefined) updateData.enabled = input.enabled;
  if (input.metadata !== undefined) updateData.metadata = input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : null;

  return updateData;
}

/**
 * 验证模型定义输入
 */
export function validateModelInput(input: ModelDefinitionInput): { valid: boolean; error?: string } {
  if (!input.modelId) {
    return { valid: false, error: 'Missing required field: modelId' };
  }
  if (!input.name) {
    return { valid: false, error: 'Missing required field: name' };
  }
  if (!input.provider) {
    return { valid: false, error: 'Missing required field: provider' };
  }
  if (!input.family) {
    return { valid: false, error: 'Missing required field: family' };
  }
  return { valid: true };
}
