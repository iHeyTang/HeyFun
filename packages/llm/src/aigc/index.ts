import z from 'zod';
import { BaseAigcModel, ModelParameterLimits, SubmitTaskParams } from './core/base-model';
import { DashscopeWanProvider, dashscopeWanServiceConfigSchema } from './providers/aliyun-dashscope';
import { VolcengineArkProvider, volcengineArkServiceConfigSchema } from './providers/volcengine-ark';
import { VolcengineJimengProvider, volcengineJimengServiceConfigSchema } from './providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from './types';

// 豆包模型
import { DoubaoSeedance10LiteVideo } from './models/doubao-seedance-1-0-lite-video';
import { DoubaoSeedance10Pro250528 } from './models/doubao-seedance-1-0-pro-250528';
import { DoubaoSeededit30I2i250628 } from './models/doubao-seededit-3-0-i2i-250628';
import { DoubaoSeedream30T2i250415 } from './models/doubao-seedream-3-0-t2i-250415';
import { DoubaoSeedream40 } from './models/doubao-seedream-4-0-250828';

// 即梦模型
import { Jimeng40 } from './models/jimeng-4-0-image';
import { Jimeng30ProVideo } from './models/jimeng-3-0-pro-video';

const aigcProviderConfigSchema = z.object({
  doubao: volcengineArkServiceConfigSchema.optional(),
  jimeng: volcengineJimengServiceConfigSchema.optional(),
  wan: dashscopeWanServiceConfigSchema.optional(),
});

class AIGCHost {
  private models: Map<string, BaseAigcModel> = new Map();
  public providers: {
    'dashscope-wan'?: DashscopeWanProvider;
    'volcengine-ark'?: VolcengineArkProvider;
    'volcengine-jimeng'?: VolcengineJimengProvider;
  } = {};

  constructor(config: z.infer<typeof aigcProviderConfigSchema>) {
    if (config.wan) {
      const provider = new DashscopeWanProvider(config.wan);
      this.providers['dashscope-wan'] = provider;
    }
    if (config.doubao) {
      const provider = new VolcengineArkProvider(config.doubao);
      this.providers['volcengine-ark'] = provider;
    }
    if (config.jimeng) {
      const provider = new VolcengineJimengProvider(config.jimeng);
      this.providers['volcengine-jimeng'] = provider;
    }
  }

  // 获取所有服务模型信息
  public async getAllServiceModels(): Promise<BaseAigcModel[]> {
    return Array.from(this.models.values());
  }

  // 提交生成任务
  public async submitGenerationTask(modelName: string, params: SubmitTaskParams): Promise<string> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`不支持的服务: ${modelName}`);
    }
    return await model.submitTask(params);
  }

  // 获取任务结果
  public async getTaskResult(params: { modelName: string; taskId: string }): Promise<GenerationTaskResult> {
    const { modelName, taskId } = params;
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`不支持的服务: ${modelName}`);
    }

    return await model.getTaskResult({ model: modelName, taskId });
  }

  public async registerModel(fn: (providers: typeof this.providers) => BaseAigcModel | null): Promise<void> {
    const model = fn(this.providers);
    if (!model) {
      return;
    }
    this.models.set(model.name, model);
  }

  // 获取模型实例
  public getModel(modelName: string): BaseAigcModel | null {
    return this.models.get(modelName) || null;
  }
}

const AIGC = new AIGCHost({
  wan: {
    apiKey: process.env.ALIYUN_DASHSCOPE_API_KEY || '',
  },
  doubao: {
    apiKey: process.env.VOLCENGINE_ARK_ACCESS_KEY_ID || '',
  },
  jimeng: {
    accessKeyId: process.env.VOLCENGINE_JIMENG_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VOLCENGINE_JIMENG_SECRET_ACCESS_KEY || '',
  },
});

// 豆包模型注册
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedance10LiteVideo(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedance10Pro250528(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeededit30I2i250628(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedream30T2i250415(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedream40(providers['volcengine-ark']) : null));

// 即梦模型注册
AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new Jimeng40(providers['volcengine-jimeng']) : null));
AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new Jimeng30ProVideo(providers['volcengine-jimeng']) : null));

export default AIGC;
export type { GenerationType, BaseAigcModel, ModelParameterLimits };
