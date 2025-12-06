import { ModelInfo, ModelFilter } from './types';
import { modelDefinitions } from '../definitions';

export class ModelRegistry {
  private models: Map<string, ModelInfo> = new Map();

  constructor(definitions: ModelInfo[] = modelDefinitions) {
    definitions.forEach(model => this.registerModel(model));
  }

  registerModel(model: ModelInfo): void {
    if (this.models.has(model.id)) {
      console.warn(`Model ${model.id} is already registered, overwriting...`);
    }
    this.models.set(model.id, model);
  }

  registerModels(models: ModelInfo[]): void {
    models.forEach(model => this.registerModel(model));
  }

  getModel(modelId: string): ModelInfo | null {
    return this.models.get(modelId) || null;
  }

  hasModel(modelId: string): boolean {
    return this.models.has(modelId);
  }

  getAllModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  filterModels(filter: ModelFilter): ModelInfo[] {
    let models = this.getAllModels();

    if (filter.provider) models = models.filter(m => m.provider === filter.provider);
    if (filter.family) models = models.filter(m => m.family === filter.family);
    if (filter.type) models = models.filter(m => m.type === filter.type);
    if (filter.supportsStreaming !== undefined) {
      models = models.filter(m => m.supportsStreaming === filter.supportsStreaming);
    }
    if (filter.supportsFunctionCalling !== undefined) {
      models = models.filter(m => m.supportsFunctionCalling === filter.supportsFunctionCalling);
    }
    if (filter.supportsVision !== undefined) {
      models = models.filter(m => m.supportsVision === filter.supportsVision);
    }
    if (filter.maxPrice !== undefined) {
      models = models.filter(m => {
        const inputPrice = m.pricing?.input || 0;
        const outputPrice = m.pricing?.output || 0;
        return Math.max(inputPrice, outputPrice) <= filter.maxPrice!;
      });
    }
    if (filter.minContextLength !== undefined) {
      models = models.filter(m => (m.contextLength || 0) >= filter.minContextLength!);
    }

    return models;
  }

  groupByFamily(): Map<string, ModelInfo[]> {
    const groups = new Map<string, ModelInfo[]>();
    this.getAllModels().forEach(model => {
      const family = model.family || 'other';
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family)!.push(model);
    });
    return groups;
  }

  groupByProvider(): Map<string, ModelInfo[]> {
    const groups = new Map<string, ModelInfo[]>();
    this.getAllModels().forEach(model => {
      if (!groups.has(model.provider)) groups.set(model.provider, []);
      groups.get(model.provider)!.push(model);
    });
    return groups;
  }

  getFreeModels(): ModelInfo[] {
    return this.getAllModels().filter(m => {
      const inputPrice = m.pricing?.input || 0;
      const outputPrice = m.pricing?.output || 0;
      return inputPrice === 0 && outputPrice === 0;
    });
  }

  getModelsWithCapability(capability: string): ModelInfo[] {
    return this.getAllModels().filter(m => {
      switch (capability) {
        case 'streaming':
          return m.supportsStreaming;
        case 'tools':
        case 'functionCalling':
          return m.supportsFunctionCalling;
        case 'vision':
          return m.supportsVision;
        default:
          return false;
      }
    });
  }

  searchModels(query: string): ModelInfo[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllModels().filter(m =>
      m.id.toLowerCase().includes(lowerQuery) ||
      m.name.toLowerCase().includes(lowerQuery) ||
      (m.description && m.description.toLowerCase().includes(lowerQuery))
    );
  }

  removeModel(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  clear(): void {
    this.models.clear();
  }

  getModelCount(): number {
    return this.models.size;
  }
}

export const defaultModelRegistry = new ModelRegistry();

