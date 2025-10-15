import { ModelDefinition, ModelFilter } from './types';
import { modelDefinitions } from '../definitions';

export class ModelRegistry {
  private models: Map<string, ModelDefinition> = new Map();

  constructor(definitions: ModelDefinition[] = modelDefinitions) {
    definitions.forEach(model => this.registerModel(model));
  }

  registerModel(model: ModelDefinition): void {
    if (this.models.has(model.id)) {
      console.warn(`Model ${model.id} is already registered, overwriting...`);
    }
    this.models.set(model.id, model);
  }

  registerModels(models: ModelDefinition[]): void {
    models.forEach(model => this.registerModel(model));
  }

  getModel(modelId: string): ModelDefinition | null {
    return this.models.get(modelId) || null;
  }

  hasModel(modelId: string): boolean {
    return this.models.has(modelId);
  }

  getAllModels(): ModelDefinition[] {
    return Array.from(this.models.values());
  }

  filterModels(filter: ModelFilter): ModelDefinition[] {
    let models = this.getAllModels();

    if (filter.providerId) models = models.filter(m => m.providerId === filter.providerId);
    if (filter.family) models = models.filter(m => m.family === filter.family);
    if (filter.capabilities) {
      models = models.filter(m => Object.entries(filter.capabilities!).every(([key, value]) => m.capabilities[key] === value));
    }
    if (filter.tags && filter.tags.length > 0) {
      models = models.filter(m => filter.tags!.every(tag => m.tags?.includes(tag)));
    }
    if (filter.maxPrice !== undefined) {
      models = models.filter(m => Math.max(m.pricing.input, m.pricing.output) <= filter.maxPrice!);
    }
    if (filter.minContextLength !== undefined) {
      models = models.filter(m => m.contextLength >= filter.minContextLength!);
    }

    return models;
  }

  groupByFamily(): Map<string, ModelDefinition[]> {
    const groups = new Map<string, ModelDefinition[]>();
    this.getAllModels().forEach(model => {
      const family = model.family || 'other';
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family)!.push(model);
    });
    return groups;
  }

  groupByProvider(): Map<string, ModelDefinition[]> {
    const groups = new Map<string, ModelDefinition[]>();
    this.getAllModels().forEach(model => {
      if (!groups.has(model.providerId)) groups.set(model.providerId, []);
      groups.get(model.providerId)!.push(model);
    });
    return groups;
  }

  getFreeModels(): ModelDefinition[] {
    return this.getAllModels().filter(m => m.pricing.input === 0 && m.pricing.output === 0);
  }

  getModelsWithCapability(capability: string): ModelDefinition[] {
    return this.getAllModels().filter(m => m.capabilities[capability] === true);
  }

  searchModels(query: string): ModelDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllModels().filter(m =>
      m.id.toLowerCase().includes(lowerQuery) ||
      m.name.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery) ||
      m.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
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

