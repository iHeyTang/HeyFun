import { OpenAIModel } from './openai';
import { AnthropicModel } from './anthropic';
import { ModelInstructType } from '../../types';


type Model = AnthropicModel | OpenAIModel;

/**
 * Model Registry - 注册所有可用的model客户端
 * 所有客户端都提供OpenAI兼容的接口
 */
const modelClasses: Record<ModelInstructType, (new (config: Partial<Model['config']>) => Model)> = {
  anthropic: AnthropicModel,
  openai: OpenAIModel,
}


/**
 * Get model client instance by instruct type
 */
export function getModel(instructType: string, config: Partial<Model['config']>): Model | null {
  const ModelClass = modelClasses[instructType as keyof typeof modelClasses];
  if (!ModelClass) {
    console.warn(`Unknown instruct type: ${instructType}`);
    return null;
  }
  return new ModelClass(config) as unknown as Model;
}

export type { Chat } from './types';
